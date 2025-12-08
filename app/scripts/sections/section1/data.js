// ============= DATA =============
async function loadProductsFromDeal() {
  try {
    const { deal } = await client.data.get("deal");
    currentDealID = deal?.id;
    currentCompanyID = deal?.sales_account_id;
    lockRevenue = deal?.custom_field?.cf_lock_revenue || false;
    periodicity = deal?.customField?.cf_periodicity || null;
    closedDate = deal?.closed_date ? new Date(deal.closed_date) : null;
    expectedCloseDate = deal?.expected_close ? new Date(deal?.expected_close) : null;
    facDate = deal?.custom_field?.cf__fac_date ? new Date(deal?.custom_field?.cf__fac_date) : null;
    tag = deal?.plain_tags;
    const btn = document.getElementById("btn-allocate");
    if (btn) {
      if (lockRevenue) {
        // Đã khóa revenue -> disable nút
        btn.disabled = true;
        btn.style.opacity = 0.5;
        btn.textContent = (lang === "vi") ? "Đã áp dụng" : "Applied";
      } else {
        // Chưa khóa revenue -> mở nút
        btn.disabled = false;
        btn.style.opacity = 1;
        btn.textContent = (lang === "vi") ? "Áp dụng" : "Apply";
      }
    }

    const oldGlobalDiscount = deal?.custom_field?.cf__global_discount || null;
    if (oldGlobalDiscount) {
      try {
        const parsed = JSON.parse(oldGlobalDiscount);
        if (parsed && typeof parsed === "object") {
          globalDiscount.value = parsed.value || 0;
          globalDiscount.type = parsed.type || "percent";
        }
      } catch (e) {
        console.error("❌ Parse globalDiscount failed:", e);
      }
    }

    const territoryId = deal?.territory_id || null;
    if (!territoryId) {
      lang = "en";
    } else {
      let territory = cachedTerritories.find(t => String(t.id) === String(territoryId));
      if (!territory) {
        try {
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

          territory = cachedTerritories.find(t => String(t.id) === String(territoryId));
        } catch (err) {
          console.error("❌ Failed to fetch territory list:", err);
        }
      }

      if (territory && (territory.name === "Miền Nam" || territory.name === "Miền Bắc")) {
        lang = "vi";
      } else {
        lang = "en";
      }
      currentTerritory = territory.name;
    }

    contractID = deal?.custom_field.cf_contract || "";
    market = deal?.custom_field.cf_market || "";
    const oldProducts = deal?.custom_field?.cf__products || "[]";
    const oldAllocatedProducts = deal?.custom_field?.cf__allocated_products || "[]";
    const oldQuotations = deal?.custom_field?.cf__quotations || "[]";

    // reset mảng
    listItems.length = 0;
    allocatedItems.length = 0;
    quoteItems.length = 0;

    // parse listItems để Section 1
    try {
      const products = JSON.parse(oldProducts);
      if (Array.isArray(products)) {
        products.forEach(p => {
          listItems.push({
            id: p.id,
            name: p.name,
            category: p.category || "",
            license: p.license || "",
            quantitative: Number(p.quantitative) || 1,
            allocationValue: Number(p.allocationValue),
            allocationDuration: Number(p.allocationDuration) || 1,
            isQuantityBased: p.isQuantityBased,
            min: Number(p.min),
            max: p.max === null ? null : Number(p.max),
            maxDiscount: Number(p.maxDiscount) || 0,
            vat: Number(p.vat) || 0,
            discount: Number(p.discount) || 0,
            discountType: p.discountType,
            priceType: p.priceType,
            currency: p.currency,
            unit: p.unit,
            duration: Number(p.duration) || 1,
            package: p.package,
            basePrice: Number(p.basePrice) || 0,
            baseTotal: Number(p.baseTotal) || 0,
            finalTotal: Number(p.finalTotal) || 0
          });
        });
      }
    } catch (err) {
      console.error("❌ Parse listItems failed:", err);
    }

    // parse allocatedItems để Section 3
    try {
      const allocated = JSON.parse(oldAllocatedProducts);
      if (Array.isArray(allocated)) {
        allocated.forEach(p => {
          allocatedItems.push({
            id: p.id,
            name: p.name,
            allocationValue: Number(p.allocationValue) || 0,
            allocationDuration: Number(p.allocationDuration) || 1,
            forecastDate: p.forecastDate || "",
            actualDate: p.actualDate || "",
            coefficient: p.coefficient,
            type: p.type || "one",
            productType: p.productType || "",
            spdvType: p.spdvType || "",
            region: p.region || "",
            currency: p.currency || "USD"
          });
        });
      }
    } catch (err) {
      console.error("❌ Parse allocatedItems failed:", err);
    }

    // Parse allocatedRecord để Section 3
    try {
      const rawAllocatedRecords = deal?.custom_field?.cf__allocated_records || "[]";
      let parsedRecords = [];
      try {
        parsedRecords = JSON.parse(rawAllocatedRecords);
      } catch {
        parsedRecords = [];
      }
      allocatedRecords.length = 0;
      expandedAllocatedRecords.length = 0;

      if (Array.isArray(parsedRecords) && parsedRecords.length) {
        parsedRecords.forEach(r => {
          const isValid = d => d instanceof Date && !isNaN(d);
          const fmt = d => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

          // === 🔹 Format mới (compact) ===
          if (parsedRecords.length > 0) {
            const forecastStart = r.forecastStart || r.startForecast;
            const actualStart = r.actualStart || r.startActual;
            const duration = Number(r.count) || 1;
            const forecastValue = Number(r.forecastValue) || 0;
            const actualValue = Number(r.actualValue) || 0;
            const overrides = Array.isArray(r.allocationOverrides) ? r.allocationOverrides : [];

            const allocations = [];
            let currFC = forecastStart ? new Date(forecastStart.split("/").reverse().join("-")) : null;
            let currAC = actualStart ? new Date(actualStart.split("/").reverse().join("-")) : null;

            for (let i = 0; i < duration; i++) {
              const ov = overrides.find(o => o.index === i) || {};
              allocations.push({
                forecastDate: currFC && isValid(currFC) ? fmt(currFC) : "",
                forecastValue,
                actualDate: currAC && isValid(currAC) ? fmt(currAC) : "",
                actualValue,
                acceptanceDate: ov.acceptanceDate || "",
                invoiceValue: Number(ov.invoiceValue || 0)
              });

              // advance +1 tháng
              if (currFC && isValid(currFC)) currFC = new Date(currFC.getFullYear(), currFC.getMonth() + 1, currFC.getDate());
              if (currAC && isValid(currAC)) currAC = new Date(currAC.getFullYear(), currAC.getMonth() + 1, currAC.getDate());
            }

            const expanded = {
              id: r.id,
              name: r.name,
              totalValue: Number(r.totalValue ?? 0),
              currency: r.currency || "đ",
              startForecast: r.forecastStart || r.startForecast,
              startActual: r.actualStart || r.startActual,
              allocations
            };

            allocatedRecords.push(r); // bản gốc (compact)
            expandedAllocatedRecords.push(expanded); // bản expanded để render
          }
        });
      } else {
        allocatedRecords.length = 0;
        expandedAllocatedRecords.length = 0;
      }
    } catch (err) {
      console.error("❌ Parse cf__allocated_records failed:", err);
      allocatedRecords.length = 0;
      expandedAllocatedRecords.length = 0;
    }

    // parse quoteItems để Section 4
    try {
      const quotations = JSON.parse(oldQuotations);
      if (Array.isArray(quotations)) {
        quotations.forEach(q => {
          quoteItems.push({
            quotation_id: q.quotation_id || "",
            created_at: q.created_at || "",
            status: q.status || "",
            tLang: q.tLang || "",
            currency: q.currency || "",
            global_discount: q.global_discount || 0,
            global_discountType: q.global_discountType || "",
            products: Array.isArray(q.products) ? q.products.map(p => ({
              name: p.name || "",
              basePrice: Number(p.basePrice) || 0,
              quantitative: Number(p.quantitative) || 0,
              unit: p.unit || "",
              duration: Number(p.duration) || 0,
              package: p.package || "",
              vat: Number(p.vat) || 0,
              discount: p.discount || 0,
              discountType: p.discountType || "percent",
              baseTotal: Number(p.baseTotal) || 0,
              finalTotal: Number(p.finalTotal) || 0
            })) : []
          });
        });
      }
    } catch (err) {
      console.error("❌ Parse quoteItems failed:", err);
    }

    // push companyInfo để Section 5
    const info = {
      companyName: deal?.custom_field?.cf__company,
      companyAddress: deal?.custom_field?.cf__address,
      companyProvince: deal?.custom_field?.cf__province,
      companyCountry: deal?.custom_field?.cf__country,
      contactName: deal?.custom_field?.cf__contact,
      contactEmail: deal?.custom_field?.cf__email,
      contactPhone: deal?.custom_field?.cf__phone
    };
    setInfoData(info, lang);
    ensureNormalLayout();
    ensureEditButtonState();
    window.currentInfo = info;
    window.currentLang = lang;
    return true;
  } catch (err) {
    console.error("❌ Lỗi khi load product:", err);
    renderNoProductMessage();
    return false;
  }
}