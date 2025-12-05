// ================= SECTION 2 =================

async function loadCatalogFromMarket(marketId) {
  if (!marketId) return [];

  // Lấy market info
  const selectedMarket = cachedMarkets.find(m => String(m.id) === String(marketId));
  if (!selectedMarket) {
    console.warn("❌ Market not found in cache:", marketId);
    return [];
  }
  const currencySymbol = selectedMarket.currencySymbol || "$";
  const cacheKey = `categoryList-${currencySymbol}`;

  // 1. Thử lấy từ DB trước
  const stored = await client.db.get(cacheKey).catch(() => null);
  if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
    return stored.value;
  }

  // 2. Nếu chưa có cache → gọi API
  const fresh = await loadCatalogByMarket(marketId);
  if (fresh?.length) {
    await client.db.set(cacheKey, { value: fresh }).catch(err => console.error(err));
  }

  return fresh;
}

async function loadPricebookFromCatalog(catalogId) {
  if (!catalogId) return [];
  const cacheKey = `pricebook-${catalogId}`;

  try {
    // 1. Thử lấy từ DB
    const stored = await client.db.get(cacheKey).catch(() => null);
    if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
      return stored.value;
    }

    // 2. Nếu chưa có cache → gọi API
    const res = await client.request.invokeTemplate("getPricebook", {
      context: { q: catalogId, f: "cf_catalog" }
    });

    const raw = res.response || res.body || res.respData?.response;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;

    const rawPricebook = Array.isArray(data.cm_pricebook?.cm_pricebook)
      ? data.cm_pricebook.cm_pricebook
      : [];

    // 3. Lookup catalog trong cache để lấy maxDiscount + currencySymbol
    const catalog = cachedCatalogs.find(c => String(c.id) === String(catalogId));
    const catalogMaxDiscount = catalog?.max_discount ?? 0;
    const category = catalog?.category;
    const market = cachedMarkets.find(m => String(m.id) === String(catalog.market));
    const currencySymbol = market?.currencySymbol || "$";

    const normalized = rawPricebook.map(p => {
      const base = {
        id: String(p.id),
        name: p.name || "",
        category: category || "",
        license: p.custom_field?.cf_license || "",
        priceType: p.custom_field?.cf_price_type || "",
        package: p.custom_field?.cf_package || "",
        price: p.custom_field?.cf_price ?? null,
        currency: p.custom_field?.cf_currency || "",
        min: p.custom_field?.cf_min ?? null,
        max: p.custom_field?.cf_max ?? null,
        unit: p.custom_field?.cf_unit || "",
        isQuantityBased: Boolean(p.custom_field?.cf_is_quantity_based),
        isRelatedCSMP: Boolean(p.custom_field?.cf_related_csmp),
        maxDiscount: catalogMaxDiscount,
        currencySymbol: currencySymbol
      };

      // chỉ khi isRelatedCSMP = true mới thêm discount fields
      if (base.isRelatedCSMP) {
        base.csmpDiscount = p.custom_field?.cf_csmp_discount ?? null;
        base.csmpDiscountSilver = p.custom_field?.cf_csmp_discount_silver ?? null;
        base.csmpDiscountGold = p.custom_field?.cf_csmp_discount_gold ?? null;
        base.csmpDiscountDiamond = p.custom_field?.cf_csmp_discount_diamond ?? null;
      }

      // 👉 nếu có cf_related_pricebook thì thêm vào
      if (p.custom_field?.cf_related_pricebook) {
        base.relatedPricebook = p.custom_field.cf_related_pricebook;
      }

      // 👉 nếu có cf_sub_type thì thêm vào
      if (p.custom_field?.cf_type) {
        base.type = p.custom_field.cf_type;
      }

      // 👉 nếu có cf_sub_type thì thêm vào
      if (p.custom_field?.cf_sub_type) {
        base.subType = p.custom_field.cf_sub_type;
      }

      return base;
    });

    if (normalized.length) {
      await client.db.set(cacheKey, { value: normalized }).catch(err => console.error(err));
    }
    return normalized;
  } catch (err) {
    console.error("getPricebook API error:", err);
    return [];
  }
}