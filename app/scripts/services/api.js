// api.js - Các hàm gọi API
async function loadTerritory() {
  try {
    const stored = await client.db.get("territoryList").catch(() => null);
    if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
      cachedTerritories = stored.value;
      return cachedTerritories;
    }

    const res = await client.request.invokeTemplate("getTerritory");
    const raw = res.response || res.body || res.respData?.response;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const rawTerritories = Array.isArray(data.territories) ? data.territories : [];

    cachedTerritories = rawTerritories.map(t => ({
      id: String(t.id),
      name: t.name || ""
    }));

    if (cachedTerritories.length) {
      await client.db.set("territoryList", { value: cachedTerritories }).catch(err => console.error(err));
    }

    return cachedTerritories;
  } catch (err) {
    console.error("❌ loadTerritory error:", err);
    return [];
  }
}

async function loadMarket() {
  try {
    const stored = await client.db.get("marketList").catch(() => null);
    if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
      cachedMarkets = stored.value;
      renderMarket(cachedMarkets);
      return;
    }

    const res = await client.request.invokeTemplate("getMarket");
    const raw = res.response || res.body || res.respData?.response;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const rawMarkets = Array.isArray(data.cm_markets) ? data.cm_markets : [];

    cachedMarkets = rawMarkets.map(m => ({
      id: String(m.id),
      name: m.name,
      alias: m.custom_field?.cf_alias || m.name,
      currency: m.custom_field?.cf_currency || "",
      currencySymbol: m.custom_field?.cf_currency_symbol || ""
    }));

    await client.db.set("marketList", { value: cachedMarkets }).catch(err => console.error(err));
    renderMarket(cachedMarkets);
  } catch (err) {
    console.error("getMarket error:", err);
  }
}

async function loadCatalogByMarket(marketId) {
  if (!marketId) return [];
  try {
    const res = await client.request.invokeTemplate("getCatalog", {
      context: { q: marketId, f: "cf_market" }
    });

    const raw = res.response || res.body || res.respData?.response;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;

    const rawCatalog = Array.isArray(data.cm_catalog?.cm_catalog)
      ? data.cm_catalog.cm_catalog
      : [];
    if (!rawCatalog.length) return [];

    const activeCatalog = rawCatalog.filter(p => p.custom_field?.cf_active === true);

    return activeCatalog.map(p => ({
      id: String(p.id),
      name: p.name || "",
      category: p.custom_field?.cf_category || "",
      version: p.custom_field?.cf_version || "",
      item_type: p.custom_field?.cf_item_type || "",
      max_discount: p.custom_field?.cf_max_discount ?? null,
      active: Boolean(p.custom_field?.cf_active),
      market: String(marketId)
    }));
  } catch (err) {
    console.error("getCatalog API error:", err);
    return [];
  }
}

async function updateDeal(finalTotal) {
  const currencyMap = {
    "$": "USD",
    "đ": "VND",
    "¥": "JPY",
    "€": "EUR"
  };

  const currentCurrencyItem = listItems[0]?.currency || "$";
  const dealCurrency = currencyMap[currentCurrencyItem] || "USD";

  const categories = [...new Set(
    listItems.map(it => it.category).filter(Boolean)
  )].join(";");

  const maxDuration = Math.max(
    ...(listItems.map(it => {
      const dur = Number(it.duration) || 0;
      const pack = (it.package || "").toLowerCase();
      return pack === "year" ? dur * 12 : dur;
    }))
  ) || 0;

  const startDate = closedDate || expectedCloseDate;
  let expireDate = null;
  if (startDate instanceof Date && !isNaN(startDate)) {
    const expire = new Date(startDate);
    expire.setMonth(expire.getMonth() + maxDuration);
    expireDate = expire.toString();
  } else {
    expireDate = "";
  }

  try {
    await client.request.invokeTemplate("updateDeal", {
      context: { dealID: currentDealID },
      body: JSON.stringify({
        deal: {
          amount: String(finalTotal),
          custom_field: {
            cf__products: JSON.stringify(listItems),
            cf__allocated_products: JSON.stringify(allocatedItems),
            cf__allocated_records: JSON.stringify(allocatedRecords),
            cf__global_discount: JSON.stringify(globalDiscount),
            cf_interested_products: categories,
            cf__currency: dealCurrency,
            cf__duration: maxDuration,
            cf__expire_date: expireDate,
            cf__check_change: true
          }
        }
      })
    });
  } catch (err) {
    console.error("❌ Update deal failed:", err);
  }
}

async function updateRevenueRecord(body) {
  try {
    await client.request.invokeTemplate("updateDeal", {
      context: { dealID: currentDealID },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("❌ Lưu phân bổ thất bại:", err);
  }
}