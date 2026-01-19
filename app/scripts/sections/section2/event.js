// ============= EVENTS =============
async function onMarketClick(marketId) {
  selectedMarketId = marketId;
  if (!marketId) return;
  const catalogForMarket = await loadCatalogFromMarket(marketId);
  cachedCatalogs = catalogForMarket;

  const filteredByMarket = catalogForMarket.filter(p => String(p.market) === String(marketId));
  const categories = [...new Set(filteredByMarket.map(p => p.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  renderCategory(categories);

  // --- auto chọn category đầu tiên nếu có ---
  if (categories.length) {
    const categorySelect = document.getElementById("category-select");
    categorySelect.value = "";
    onCategoryChange({ target: categorySelect }, marketId);
  }

  // Show filters container sau khi chọn market
  document.getElementById("filters-container").style.display = "grid";
}

function onCategoryChange(e, marketIdParam) {
  const category = e?.target?.value ?? "";
  const marketId = marketIdParam || selectedMarketId;
  resetProductFilters("version");

  if (!marketId || !category) {
    document.getElementById("type").style.display = "none";
    document.getElementById("version").style.display = "none";
    document.getElementById("subtype").style.display = "none";
    document.getElementById("license").style.display = "none";
    document.getElementById("price-type").style.display = "none";
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
    return
  };

  const filtered = cachedCatalogs.filter(
    p => String(p.market) === String(marketId) && p.category === category
  );

  const versions = [...new Set(filtered.map(p => p.version).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  renderVersion(versions);
  renderProduct([]); // reset bảng product
}

async function onVersionChange(e) {
  const version = e?.target?.value ?? "";
  const marketId = selectedMarketId;
  const category = document.getElementById("category-select")?.value ?? "";
  resetProductFilters("type");

  if (!marketId || !category) return;
  if (!version) {
    document.getElementById("type").style.display = "none";
    document.getElementById("subtype").style.display = "none";
    document.getElementById("license").style.display = "none";
    document.getElementById("price-type").style.display = "none";
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
    cachedPricebook = [];
    return;
  }

  const matched = cachedCatalogs.filter(
    p => String(p.market) === String(marketId) &&
      p.category === category &&
      p.version === version
  );

  if (!matched.length) return;

  const catalogId = matched[0].id;
  const pricebook = await loadPricebookFromCatalog(catalogId);

  // Lưu vào cache
  cachedPricebook = pricebook;

  // 👉 Tìm min nhỏ nhất từ pricebook
  const mins = pricebook
    .map(p => (typeof p.min === "number" ? p.min : null))
    .filter(v => v !== null);
  const minQty = mins.length > 0 ? Math.min(...mins) : 1;

  // 👉 Cập nhật input quantitative
  const quantitativeInput = document.getElementById("quantitative-input");
  if (quantitativeInput) {
    quantitativeInput.min = minQty;
    quantitativeInput.value = minQty; // set mặc định
  }

  const hasType = renderType(pricebook);

  if (!hasType) {
    document.getElementById("license-select").style.display = "grid";
    document.getElementById("license-label").style.display = "grid";
    renderLicense(pricebook);
  } else {
    // Nếu có type thì chờ user chọn type/subtype rồi mới renderLicense
    document.getElementById("license").style.display = "none";
    document.getElementById("price-type").style.display = "none";
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
  }

  renderProduct([]);
  attachProductFilterEvents();
}

function onTypeChange(e) {
  const type = e?.target?.value ?? "";
  resetProductFilters("subtype");

  if (!type) {
    // chưa chọn type → clear subtype + license
    renderSubtype(cachedPricebook);
    renderProduct([]);
    return;
  }

  // xem type này có subtype không
  const filtered = cachedPricebook.filter(p => String(p.type) === String(type));
  const hasSubtype = filtered.some(p => p.subType);

  if (hasSubtype) {
    // Case 2: có subtype → renderSubtype, sau đó chờ onSubtypeChange
    renderSubtype(cachedPricebook, type);
  } else {
    // Case 1: không có subtype → renderLicense ngay với pricebook đã filter theo type
    renderLicense(filtered);
  }
}

function onSubtypeChange(e) {
  const type = document.getElementById("type-select")?.value || "";
  const subtype = e?.target?.value || document.getElementById("subtype-select")?.value || "";
  resetProductFilters("license");

  if (!subtype) {
    renderLicense([]); // clear
    renderProduct([]);
    return;
  }

  const filtered = cachedPricebook.filter(
    p => String(p.type) === String(type) &&
      String(p.subType) === String(subtype)
  );

  renderLicense(filtered);
}

function onLicenseChange(e) {
  const license = e?.target?.value ?? "";
  resetProductFilters("priceType");

  if (!license) {
    document.getElementById("price-type").style.display = "none";
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
    return;
  }

  const filtered = cachedPricebook.filter(p => String(p.license) === String(license));
  renderPriceType(filtered);
}

function onPriceTypeChange(e) {
  const priceType = e?.target?.value ?? "";
  resetProductFilters("package");

  if (!priceType) {
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
    return;
  }

  const filtered = cachedPricebook.filter(p => String(p.priceType) === String(priceType));
  
  // 👉 Cập nhật min quantitative từ filtered pricebook
  const mins = filtered
    .map(p => (typeof p.min === "number" ? p.min : null))
    .filter(v => v !== null);
  const minQty = mins.length > 0 ? Math.min(...mins) : 1;
  
  const quantitativeInput = document.getElementById("quantitative-input");
  if (quantitativeInput) {
    quantitativeInput.min = minQty;
    quantitativeInput.value = minQty;
  }
  
  renderPackageSelect(filtered);
}


function attachProductFilterEvents() {
  const inputs = [
    "type-select",
    "subtype-select",
    "license-select",
    "price-type-select",
    "quantitative-input",
    "package-duration-input",
    "package-select"
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventType = (id === "quantitative-input") ? "input" : "change";
    el.addEventListener(eventType, updateProductDisplay);
  });
}

function resetProductFilters(fromLevel = "category") {
  // ordered levels (từ trên xuống dưới)
  const levels = [
    "category",
    "version",
    "type",
    "subtype",
    "license",
    "priceType",
    "package",
    "quantitative"
  ];

  // mapping từ level -> element ids to clear/hide
  const levelToIds = {
    version: ["version-select", "version"],         // wrapper id 'version' và select id 'version-select'
    type: ["type-select", "type", "type-subtype-container"],
    subtype: ["subtype-select"],
    license: ["license-select", "license"],
    priceType: ["price-type-select", "price-type"],
    package: ["package-select", "package-unit", "package-duration-wrapper", "package-duration-input"],
    quantitative: ["quantitative-input", "quantitative"] // lưu ý id của div wrapper là 'quantitive' theo code cũ
  };

  // find index to start clearing (nếu fromLevel không hợp lệ -> start từ đầu)
  const startIdx = Math.max(0, levels.indexOf(fromLevel));

  // For each level from startIdx to end -> clear associated DOM
  for (let i = startIdx; i < levels.length; i++) {
    const lvl = levels[i];

    // nếu map có id list thì clear/hide
    if (levelToIds[lvl]) {
      levelToIds[lvl].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        // Nếu là select or input -> clear options/value
        const tag = el.tagName?.toLowerCase();
        if (tag === "select") {
          el.innerHTML = `<option value="">${lang === "vi" ? "--- Chọn ---" : "--- Select ---"}</option>`;
          el.value = "";
        } else if (tag === "input") {
          // nếu input number -> set default 1
          if (el.type === "number") el.value = 1;
          else el.value = "";
        } else {
          // wrapper div -> ẩn
          el.style.display = "none";
        }
      });
    }

    // Một số xử lý bổ sung cho level đặc thù
    if (lvl === "type") {
      const typeSel = document.getElementById("type-select");
      if (typeSel) {
        // reset type select options but keep the wrapper hidden
        typeSel.innerHTML = `<option value="">${lang === "vi" ? "--- Chọn nhóm ---" : "--- Select Type ---"}</option>`;
      }
    }
    if (lvl === "subtype") {
      const subtypeSel = document.getElementById("subtype-select");
      if (subtypeSel) {
        subtypeSel.innerHTML = `<option value="">${lang === "vi" ? "--- Chọn loại chi tiết ---" : "--- Select SubType ---"}</option>`;
      }
    }
  }

  // Clear product table always when resetting downstream
  renderProduct([]);
}

function updateProductDisplay() {
  const filters = {
    license: document.getElementById("license-select")?.value || "",
    type: document.getElementById("type-select")?.value || "",
    subType: document.getElementById("subtype-select")?.value || "",
    package: document.getElementById("package-select")?.value || "",
    quantitative: Number(document.getElementById("quantitative-input")?.value || 0),
    priceType: document.getElementById("price-type-select")?.value || ""
  };

  const isPerpetual = filters.license.toLowerCase() === "perpetual";

  if (isPerpetual) {
    filters.package = "perpetual";
  }

  // License & package & quantitative luôn bắt buộc
  if (!filters.license || (!isPerpetual && !filters.package) || !filters.quantitative || !filters.priceType) {
    renderProduct([]);
    return;
  }

  // Type/Subtype: chỉ check nếu product có type/subtype
  const matchedProducts = findMatchingProducts(cachedPricebook, filters);

  // Nếu product cần type/subtype mà user chưa chọn → không show
  const productsToShow = matchedProducts.filter(p => {
    if (p.type && !filters.type) return false;
    if (p.subType && !filters.subType) return false;
    return true;
  });

  renderProduct(productsToShow);
}