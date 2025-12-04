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

// ============= RENDER =============
function renderMarket(markets) {
  const marketIcon = document.getElementById("market-icons");
  const marketSelect = document.getElementById("market-select");

  if (!marketIcon) return console.error("❌ #market-icons not found");
  if (!marketSelect) return console.error("❌ #market-select not found");

  // Reset select
  marketSelect.innerHTML = `<option value="">--- Select Market ---</option>`;

  // Đổ option vào select (dùng alias để user dễ thấy)
  markets.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.alias || m.name || m.id;
    marketSelect.appendChild(opt);
  });

  // Hàm trả về SVG icon theo alias (dùng lại code cũ của bạn)
  function getIconUrlByAlias(alias) {
    if (!alias) return "";
    switch (alias.toLowerCase()) {
      case "vietnam":
        return "data:image/svg+xml;utf8," +
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 480'>" +
          "<rect width='640' height='480' fill='%23da251d'/>" +
          "<polygon fill='%23ff0' points='320,120 345,240 480,240 360,300 400,420 320,340 240,420 280,300 160,240 295,240'/>" +
          "</svg>";
      case "philippines":
        return "data:image/svg+xml;utf8," +
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 480'>" +
          "<rect width='640' height='240' fill='%23007bff'/>" +
          "<rect y='240' width='640' height='240' fill='%23fff'/>" +
          "<polygon fill='%23ffd700' points='0,0 320,240 0,480'/>" +
          "</svg>";
      default:
        // icon quả địa cầu
        return "data:image/svg+xml;utf8," +
          "<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 64 64'>" +
          "<circle cx='32' cy='32' r='30' fill='%234FC3F7' stroke='%231976D2' stroke-width='2'/>" +
          "<path d='M32 2 A30 30 0 0 1 32 62 A30 30 0 0 1 32 2 Z' fill='%2381C784'/>" +
          "<path d='M2 32 H62 M32 2 V62' stroke='%23fff' stroke-width='2'/>" +
          "</svg>";
    }
  }

  // Clear icon ban đầu
  marketIcon.innerHTML = "";

  // Khi select thay đổi → update icon
  marketSelect.addEventListener("change", async function () {
    const selectedId = this.value;

    if (!selectedId) {
      // Không chọn gì → clear icon
      marketIcon.innerHTML = "";
      document.getElementById("filters-container").style.display = "none";
      return;
    }

    const selectedMarket = markets.find(m => String(m.id) === String(selectedId));
    if (!selectedMarket) {
      marketIcon.innerHTML = "";
      return;
    }

    const iconUrl = getIconUrlByAlias(selectedMarket.alias || "");

    // Chỉ show đúng 1 icon
    marketIcon.innerHTML =
      `<div class="market-icon selected">
         <img src="${iconUrl}" alt="${selectedMarket.name}" title="${selectedMarket.name}">
       </div>`;

    // Gọi logic cũ (nếu bạn đã có)
    if (typeof onMarketClick === "function") {
      await onMarketClick(selectedId);
    }
  });
}

function renderCategory(categories) {
  document.getElementById("category").style.display = "grid";
  const sel = document.getElementById("category-select");
  const selLabel = document.querySelector("label[for='category-select']");
  if (!sel) return console.error("❌ #category-select not found");
  if (selLabel) selLabel.textContent = (lang === "vi") ? "Danh mục" : "Category";

  sel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn danh mục ---" : "--- Select Category ---"}</option>` +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  sel.onchange = onCategoryChange;
}

function renderVersion(versions) {
  document.getElementById("version").style.display = "grid";
  const sel = document.getElementById("version-select");
  const selLabel = document.querySelector("label[for='version-select']");
  if (!sel) return console.error("❌ #version-select not found");
  if (selLabel) selLabel.textContent = (lang === "vi") ? "Phiên bản" : "Version";

  sel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Phiên bản ---" : "--- Select Version ---"}</option>` +
    versions.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");

  sel.onchange = onVersionChange;
}

function renderType(pricebook) {
  const container = document.getElementById("type-subtype-container");
  const typeSel = document.getElementById("type-select");
  const subtypeSel = document.getElementById("subtype-select");
  const typeLabel = document.getElementById("type-label");
  const subtypeLabel = document.getElementById("subtype-label");

  typeLabel.textContent = (lang === "vi") ? "Loại" : "Type";

  const typeWrapper = typeSel.parentElement;
  const subtypeWrapper = subtypeSel.parentElement;

  const types = sortByNumericValue([...new Set(pricebook.map(p => p.type).filter(Boolean))]);

  typeSel.innerHTML = `<option value="">${lang === "vi" ? "--- Chọn nhóm ---" : "--- Select Type ---"}</option>`;

  if (!types.length) {
    container.style.display = "none";
    typeWrapper.style.display = "none";
    subtypeWrapper.style.display = "none";
    typeLabel.classList.add("hidden");
    subtypeLabel.classList.add("hidden");
    typeSel.classList.add("hidden");
    subtypeSel.classList.add("hidden");
    return false; // ❗ báo cho onVersionChange biết là không có type
  }

  container.style.display = "grid";
  typeWrapper.style.display = "block";
  typeLabel.classList.remove("hidden");
  typeSel.classList.remove("hidden");

  // ẩn subtype cho đến khi biết có subtype
  subtypeWrapper.style.display = "none";
  subtypeLabel.classList.add("hidden");
  subtypeSel.classList.add("hidden");

  typeSel.innerHTML += types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  // ❗ gán handler (không gọi hàm)
  typeSel.onchange = onTypeChange;

  return true;
}

function renderSubtype(pricebook, type) {
  const container = document.getElementById("type-subtype-container");
  //const typeSel = document.getElementById("type-select");
  const subtypeSel = document.getElementById("subtype-select");
  const subtypeLabel = document.getElementById("subtype-label");
  subtypeLabel.textContent = (lang === "vi") ? "Phân loại" : "Sub Type";

  if (!container || !subtypeSel) return;

  // Nếu không có type được chọn → lấy toàn bộ subtype của pricebook
  let source = pricebook || [];
  if (type) {
    source = source.filter(p => String(p.type) === String(type));
  }

  const subtypes = sortByNumericValue(
    [...new Set(source.map(p => p.subType).filter(Boolean))]
  );

  // Reset option
  subtypeSel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn loại chi tiết ---" : "--- Select SubType ---"}</option>`;

  const subtypeWrapper = subtypeSel.parentElement;

  if (!subtypes.length) {
    // Không có subtype → ẩn riêng phần Subtype, nhưng vẫn giữ Type
    subtypeWrapper.style.display = "none";
    subtypeLabel.classList.add("hidden");
    subtypeSel.classList.add("hidden");
    return;
  }

  // Có subtype → hiển thị
  subtypeWrapper.style.display = "block";
  subtypeLabel.classList.remove("hidden");
  subtypeSel.classList.remove("hidden");

  subtypeSel.innerHTML += subtypes
    .map(st => `<option value="${escapeHtml(st)}">${escapeHtml(st)}</option>`)
    .join("");

  // onchange subtype thì m vẫn filter product như cũ
  subtypeSel.onchange = onSubtypeChange;
}

function renderLicense(pricebook) {
  document.getElementById("license").style.display = "grid";
  const sel = document.getElementById("license-select");
  const selLabel = document.getElementById("license-label");
  if (!sel) return;
  if (selLabel) selLabel.textContent = (lang === "vi") ? "Giấy phép" : "License";

  const licenses = [...new Set(pricebook.map(p => p.license).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  sel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Giấy phép ---" : "--- Select License ---"}</option>` +
    licenses.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");

  sel.onchange = onLicenseChange;
}

function renderPriceType(pricebook) {
  document.getElementById("price-type").style.display = "grid";
  const sel = document.getElementById("price-type-select");
  const selLabel = document.getElementById("price-type-label");
  if (!sel) return;
  if (selLabel) selLabel.textContent = (lang === "vi") ? "Loại giá" : "Price type";

  const priceType = [...new Set(pricebook.map(p => p.priceType).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  sel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Loại giá ---" : "--- Select Price type ---"}</option>` +
    priceType.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");

  sel.onchange = onPriceTypeChange;
}

function renderPackageSelect(pricebook) {
  const container = document.getElementById("duration-package-container");
  const quantitative = document.getElementById("quantitative");
  const durationWrapper = document.getElementById("package-duration-wrapper");
  const durationLabel = document.getElementById("package-duration-label");
  const durationInput = document.getElementById("package-duration-input");
  const packageUnit = document.getElementById("package-unit");
  const packageLabel = document.getElementById("package-label");
  const packageSelect = document.getElementById("package-select");

  if (!container || !packageUnit || !packageSelect || !quantitative) return;

  const license = document.getElementById("license-select")?.value || "";
  const isPerpetual = license.toLowerCase() === "perpetual";

  // đảm bảo quantitative visible khi cần
  quantitative.classList.remove("hidden");
  quantitative.style.display = "block";

  // Text label
  packageLabel.textContent = (lang === "vi") ? "Đơn vị" : "Package Unit";
  durationLabel.textContent = (lang === "vi") ? "Thời hạn" : "Duration";

  // ----- Perpetual: auto-select perpetual và cập nhật ngay -----
  if (isPerpetual) {
    container.classList.remove("grid-3");
    container.classList.add("grid-2");

    if (durationWrapper) { durationWrapper.classList.add("hidden"); durationWrapper.style.display = "none"; }
    if (packageUnit) { packageUnit.classList.remove("hidden"); packageUnit.style.display = "block"; }

    // chỉ có 1 option perpetual — set value = "perpetual"
    packageSelect.innerHTML =
      `<option value="">${lang === "vi" ? "--- Chọn Đơn vị ---" : "--- Select Package Unit ---"}</option>
       <option value="perpetual">${lang === "vi" ? "Vĩnh viễn" : "Perpetual"}</option>`;

    // Auto-select ONLY for perpetual case (by your request)
    packageSelect.value = "perpetual";

    // ensure durationInput not constrained by max
    if (durationInput) durationInput.removeAttribute("max");

    // trigger update so quantitative/product reflect perpetual mode
    updateProductDisplay();

    // attach change handler (in case user changes it later)
    packageSelect.onchange = () => {
      updateProductDisplay();
    };

    return;
  }

  // ----- Non-perpetual: DO NOT auto-select, wait for user change -----
  container.classList.remove("grid-2");
  container.classList.add("grid-3");

  if (durationWrapper) { durationWrapper.classList.remove("hidden"); durationWrapper.style.display = "block"; }
  if (packageUnit) { packageUnit.classList.remove("hidden"); packageUnit.style.display = "block"; }
  if (quantitative) { quantitative.classList.remove("hidden"); quantitative.style.display = "block"; }
  if (durationInput) durationInput.classList.remove("hidden");

  const rawPackage = [...new Set(pricebook.map(p => p.package).filter(Boolean))];

  if (!rawPackage.length) {
    if (durationWrapper) { durationWrapper.classList.add("hidden"); durationWrapper.style.display = "none"; }
    if (packageUnit) { packageUnit.classList.add("hidden"); packageUnit.style.display = "none"; }
    renderProduct([]);
    return;
  }

  let options = [];
  if (rawPackage.includes("time")) {
    options = ["time"];
  } else if (rawPackage.some(p => p === "year" || p === "month")) {
    options = ["year", "month"];
  }

  // Render options but DO NOT set packageSelect.value -> wait for user
  packageSelect.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Đơn vị ---" : "--- Select Package Unit ---"}</option>` +
    options.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");

  // onChange will handle duration max + update product display
  packageSelect.onchange = () => {
    const selectedPackage = packageSelect.value;
    if (selectedPackage === "month" && durationInput) {
      durationInput.max = 12;
      if (+durationInput.value > 12) durationInput.value = 12;
    } else if (durationInput) {
      durationInput.removeAttribute("max");
    }
    updateProductDisplay();
  };
}

function renderProduct(products) {
  const containerEl = document.getElementById("product-table");
  if (!containerEl) return;

  // Clear trước khi render
  containerEl.innerHTML = "";

  // Nếu không có product -> show empty state (hoặc ẩn)
  if (!products || !products.length) {
    containerEl.style.display = "block";
    return;
  }

  containerEl.style.display = "block";

  // Lấy giá trị UI
  const license = document.getElementById("license-select")?.value || "";
  const isPerpetual = (license || "").toLowerCase() === "perpetual";

  let quantitative = 1;
  const quantitativeInput = document.getElementById("quantitative-input");
  if (quantitativeInput) {
    const val = parseFloat(quantitativeInput.value);
    if (!isNaN(val)) quantitative = val;
    else if (quantitativeInput.min) quantitative = parseFloat(quantitativeInput.min);
  }

  const selectedPackage = document.getElementById("package-select")?.value || "";
  const packageQty = document.getElementById("package-duration-input") ? parseFloat(document.getElementById("package-duration-input").value) || 1 : 1;

  // build table header once + body rows
  const rowsHtml = products.map((p, idx) => {
    // tính giá điều chỉnh theo package
    let adjustedPrice = p.price ?? 0;
    if (p.package && selectedPackage) {
      if (p.package === "year" && selectedPackage === "month") adjustedPrice /= 12;
      else if (p.package === "month" && selectedPackage === "year") adjustedPrice *= 12;
    }

    const quantityBasedPrice = p.isQuantityBased ? adjustedPrice * quantitative : adjustedPrice;
    const subtotal = quantityBasedPrice * packageQty;
    const rangeText = formatUnitRange(p.min, p.max, p.unit);
    const currentCurrency = p.currency || "USD";

    // duration display
    let durationDisplay;
    if (isPerpetual) durationDisplay = (lang === "vi") ? "Vĩnh viễn" : "Perpetual";
    else durationDisplay = `${packageQty} ${selectedPackage || "-"}`;

    const maxDiscount = p.maxDiscount ?? 0;
    const unit = p.unit || "";

    return `
      <tr data-idx="${idx}">
        <td>
          <textarea class="form-control form-control-sm product-name"
            data-index="${idx}"
            style="resize: vertical; min-height:40px; white-space: normal; word-break: break-word;">${escapeHtml(p.name)}</textarea>
        </td>
        <td>${rangeText}</td>
        <td>${maxDiscount} %</td>
        <td>${formatPrice(adjustedPrice, currentCurrency)}</td>
        <td>${quantitative} ${unit}</td>
        <td>${durationDisplay}</td>
        <td>${formatPrice(subtotal, currentCurrency)}</td>
        <td>
          <button style="margin-top: 10px; padding: 6px; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;
            border: none; border-radius: 4px; background-color: #ffffff; color: #004085; cursor: pointer; font-weight: bold;"
            onclick="pushToQuote()">
            <fw-icon name="circle-plus" size="18" color="#004085"></fw-icon>
            Add
          </button>        
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <table class="table table-sm table-bordered">
      <thead>
        <tr>
          <th>${lang === "vi" ? "Tên sản phẩm" : "Product Name"}</th>
          <th>${lang === "vi" ? "Định lượng tiêu chuẩn" : "Quantitative standard"}</th>
          <th>${lang === "vi" ? "Giảm giá tối đa" : "Max discount"}</th>
          <th>${lang === "vi" ? "Đơn giá" : "Unit Price"}</th>
          <th>${lang === "vi" ? "Định lượng" : "Quantitative"}</th>
          <th>${lang === "vi" ? "Thời hạn" : "Duration"}</th>
          <th>${lang === "vi" ? "Thành tiền" : "Total"}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  containerEl.innerHTML = html;

  // Gắn handler cho textarea — dùng oninput (gán, không addEventListener nhiều lần)
  containerEl.querySelectorAll("textarea.product-name").forEach(inputEl => {
    inputEl.oninput = (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (!isNaN(idx)) products[idx].name = e.target.value;
    };
  });
}

function renderPriceTable(targetId = "price-table") {
  const container = document.getElementById(targetId);
  const btnSaveSection2 = document.getElementById("btn-save-section2");
  if (!container) return;
  container.style.display = "block";

  const validItems = listItems.filter(item => item && item.basePrice !== null && !isNaN(item.basePrice));
  if (!validItems.length) {
    container.innerHTML = `
      <div style="text-align:center; color:#555;">
        <img src="https://img.icons8.com/ios/100/box.png" alt="no product" style="opacity:0.5; margin-bottom:16px;">
        <p style="margin:8px 0;">${lang === "vi" ? "Hiện chưa có sản phẩm nào." : "There are no products yet."}</p>
      </div>
    `;
    btnSaveSection2.style.display = "none";
    return;
  }

  const displayCurrency = validItems[0].currency || currentCurrency;
  const totalAfterItemDiscount = validItems.reduce((sum, it) => sum + (it.finalTotal || 0), 0);

  const rows = validItems.map((item, idx) => {
    const lic = String(item.license || '').toLowerCase();
    const pkg = String(item.package || '').toLowerCase();
    const durationCell = (lic === "perpetual" && pkg === "perpetual")
      ? `<div style="background:#f5f5f5; padding:4px 6px; color:#666; border:1px solid #ccc; white-space:nowrap;">${lang === "vi" ? "Vĩnh viễn" : "Perpetual"}</div>`
      : `
                <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; overflow:hidden; height: 32px;line-height: 32px;">
                    <input 
                        id="duration-input-${idx}"
                        type="number" 
                        value="${item.duration || 1}" 
                        min="1"
                        ${pkg === "month" ? 'max="12"' : ""}
                        oninput="commitDuration(${idx}, this.value, '${pkg}')" 
                        style="flex:1; border:none; text-align:center; font-size:14px; outline:none; min-width:50px; padding: 4px 6px; height: 32px; line-height: 32px;" 
                    />
                    <span style="background:#f5f5f5; padding:4px 6px; color:#666; border-left:1px solid #ccc; white-space:nowrap;">
                        ${pkg}${item.duration > 1 ? "s" : ""}
                    </span>
                </div>
            `;

    return `
            <tr id="row-${idx}">
                <td style="font-weight: 500; color: #333;">${item.name}</td>
                <td style="width:13%; text-align:center;">
                    <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; overflow:hidden; height: 32px;line-height: 32px;">
                        <span style="background:#f5f5f5; padding:4px 6px; color:#666; border-right:1px solid #ccc; white-space:nowrap;">
                            ${item.currency || currentCurrency}
                        </span>
                        <input 
                            type="text"
                            value="${Number(item.basePrice).toLocaleString('en-US')}" 
                            oninput="formatPriceInput(this)" 
                            onblur="commitPrice(${idx}, this.value)" 
                            style="flex:1; border:none; padding:4px 6px; text-align:center; font-size:14px; outline:none; min-width:50px; height: 32px;line-height: 32px;" 
                        />
                    </div>
                </td>
                <td style="width:13%; text-align:center;">
                    <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; overflow:hidden; height: 32px;line-height: 32px;">
                        <input 
                            type="number"
                            value="${item.quantitative}" 
                            min="${item.min || 1}"
                            ${item.max ? `max="${item.max}"` : ""}
                            oninput="commitQuantity(${idx}, this.value)"
                            onblur="commitQuantity(${idx}, this.value, true)"
                            style="flex:1; border:none; padding:4px 6px; text-align:center; font-size:14px; outline:none; min-width:50px; height: 32px; line-height: 32px;" 
                        />
                        ${item.subType === "IP tĩnh" ? "" : `
                            <span style="background:#f5f5f5; padding:4px 6px; color:#666; border-left:1px solid #ccc; white-space:nowrap;">
                                ${item.unit || ""}
                            </span>`}
                    </div>
                </td>
                <td style="width:10%; text-align:center;">${durationCell}</td>
                <td style="width:15%; text-align:center;">
                  <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; overflow:hidden; height:32px; line-height:32px; background:#fff;">
                    <select id="discount-type-${idx}" 
                        onchange="handleDiscountTypeChange('discount-input-${idx}','discount-type-${idx}', ${idx})"
                        style="flex:0 0 30%; max-width:30%; border:none; outline:none; text-align:center; background:#f5f5f5; height:100%;">
                        <option value="percent" ${item.discountType === "percent" ? "selected" : ""}>%</option>
                        <option value="amount" ${item.discountType === "amount" ? "selected" : ""}>${item.currency || currentCurrency}</option>
                    </select>
                    <input 
                        id="discount-input-${idx}"
                        type="text"
                        value="${Number(item.discount || 0).toLocaleString('en-US')}" 
                        oninput="handleDiscountInput('discount-input-${idx}','discount-type-${idx}', ${idx})"
                        style="flex:0 0 70%; max-width:70%; border:none; outline:none; text-align:right; padding:4px 6px; height:100%;">
                  </div>
                </td>
                <td id="amount-${idx}" style="text-align:right;">
                    <span style="font-weight:500; color:#333;">${formatPrice(item.finalTotal, item.currency || currentCurrency)}</span>
                </td>
                <td style="width: 10px; text-align:center;">
                    <button onclick="removeQuoteItem(${idx})">
                        <fw-icon name="circle-cross" size="16" color="#666"></fw-icon>
                    </button>
                </td>
            </tr>
        `;
  });

  const total = totalAfterItemDiscount - (globalDiscount.type === "percent"
    ? totalAfterItemDiscount * (globalDiscount.value / 100)
    : globalDiscount.value);

  container.innerHTML = `
    <table style="width:100%; table-layout:fixed;">
      <thead>
        <tr>
          <th style="width:35%; text-align:left;">${lang === "vi" ? "Tên sản phẩm" : "Name"}</th>
          <th style="width:13%; text-align:center;">${lang === "vi" ? "Đơn giá" : "Price"}</th>
          <th style="width:13%; text-align:center;">${lang === "vi" ? "Số lượng" : "Quantity"}</th>
          <th style="width:10%; text-align:center;">${lang === "vi" ? "Thời giạn" : "Duration"}</th>
          <th style="width:15%; text-align:center;">${lang === "vi" ? "Giảm giá" : "Discount"}</th>
          <th style="width:12%; text-align:right;">${lang === "vi" ? "Thành tiền" : "Amount"}</th>
          <th style="width:2%; text-align:center;"></th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
        <tr class="subtotal-row">
          <td colspan="5" style="text-align:right;">${lang === "vi" ? "Tạm tính" : "Subtotal"}</td>
          <td id="subtotal-cell" style="text-align:right;">${formatPrice(totalAfterItemDiscount, displayCurrency)}</td>
          <td></td>
        </tr>
        <tr class="global-discount-row">
          <td colspan="4"></td>
          <!-- Discount + Amount -->
          <td colspan="2" id="global-discount-form" style="text-align:right;">
            ${(!globalDiscount.value || Number(globalDiscount.value) === 0)
      ? `<button onclick="openGlobalDiscount()" 
                          style="color: #0070f3; cursor: pointer; user-select: none; margin-left: auto; display:flex; align-items:center; justify-content:flex-end; gap:4px; font-weight:500; font-size:14px;">
                    <fw-icon name="circle-plus" size="16" color="#0070f3"></fw-icon> ${lang === "vi" ? "Thêm giảm giá" : "Add discount"}
                  </button>`
      : (globalDiscount.type === "percent"
        ? `${globalDiscount.value} %`
        : formatCurrency(globalDiscount.value, displayCurrency))
    }
          </td>
          <!-- Action -->
          <td id="global-discount-action" style="text-align:right;">
            ${(globalDiscount.value && Number(globalDiscount.value) !== 0)
      ? `<button onclick="openGlobalDiscount()" 
                          style="border:none; background:none; cursor:pointer; color:#0070f3; font-size:14px;">
                    ${lang === "vi" ? "Chỉnh sửa" : "Edit"}
                  </button>`
      : ``
    }
          </td>
        </tr>
        <tr class="total-row">
          <td colspan="5" style="text-align:right;">${lang === "vi" ? "Tổng cộng" : "Total"}</td>
          <td id="total-cell" style="text-align:right;">${formatPrice(total, displayCurrency)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}

function openGlobalDiscount() {
  const formCell = document.getElementById("global-discount-form");
  const actionCell = document.getElementById("global-discount-action");
  if (!formCell || !actionCell) return;

  const currencySymbol = listItems[0]?.currency || currentCurrency || "đ";

  // hiển thị input + select trong 2 cột (Discount + Amount)
  formCell.innerHTML = `
    <div style="display:flex; justify-content:flex-end; gap:6px; align-items:center;">
      <select id="global-discount-type"
              style="padding:6px; border:1px solid #ccc; border-radius:4px; background:#fff;"
              onchange="handleDiscountTypeChange('global-discount-input','global-discount-type')">
        <option value="percent" ${globalDiscount.type === "percent" ? "selected" : ""}>%</option>
        <option value="amount"  ${globalDiscount.type === "amount" ? "selected" : ""}>${currencySymbol}</option>
      </select>
      <input id="global-discount-input" type="number"
            value="${globalDiscount.value || ''}"
            min="0"
            oninput="handleDiscountInput('global-discount-input','global-discount-type')"
            placeholder="0"
            style="width:120px; text-align:right; padding:6px; border:1px solid #ccc; border-radius:4px;">
    </div>
  `;

  // action cột cuối: button Add
  actionCell.innerHTML = `
    <button onclick="applyGlobalDiscount()" 
            style="border:none; background:none; cursor:pointer; color:#0070f3; font-size:14px;">
      Add
    </button>
  `;
}

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

  if (productsToShow.length === 1) {
    currentProduct = productsToShow[0];
  } else {
    currentProduct = null;
  }

  renderProduct(productsToShow);
}

function packageMatches(productPackage, selectedPackage) {
  if (!selectedPackage) return false; // unit-select luôn có value
  if (!productPackage) return false;

  if (selectedPackage === "time" && productPackage === "time") return true;
  if (selectedPackage === "perpetual" && productPackage === "perpetual") return true;
  if ((selectedPackage === "year" || selectedPackage === "month") &&
    (productPackage === "year" || productPackage === "month")) return true;

  return false;
}

function findMatchingProducts(pricebook, filters) {
  const matched = pricebook.filter(p => {

    // Kiểm tra type/subtype tùy theo giá trị có tồn tại
    if (p.type && p.subType) {
      if (filters.type && p.type !== filters.type) return false;
      if (filters.subType && p.subType !== filters.subType) return false;
    } else if (p.type && !p.subType) {
      if (filters.type && p.type !== filters.type) return false;
    }

    // License bắt buộc
    if (filters.license && p.license !== filters.license) return false;

    // priceType bắt buộc
    if (filters.priceType && p.priceType !== filters.priceType) return false;

    // package theo logic conversion
    if (filters.unit && !packageMatches(p.package, filters.package)) return false;

    // Quantitative nằm trong min-max
    const min = p.min !== null ? p.min : -Infinity;
    const max = p.max !== null ? p.max : Infinity;
    if (filters.quantitative < min || filters.quantitative > max) return false;

    return true;
  });

  // Loại trùng: dùng key kết hợp các trường quan trọng
  const unique = [];
  const seen = new Set();
  matched.forEach(p => {
    const key = `${p.name}|${p.license}|${p.package}|${p.type || ""}|${p.subType || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  });
  return unique;
}

function pushToQuote() {
  if (!currentProduct) return;
  const quantitativeInput = document.getElementById("quantitative-input");
  const packageInput = document.getElementById("package-select");
  const licenseInput = document.getElementById("license-select");
  const subtypeInput = document.getElementById("subtype-select");
  const durationInput = document.getElementById("package-duration-input");
  const quantitative = parseInt(quantitativeInput?.value) || 1;
  const packageType = packageInput ? packageInput.value : "";
  const duration = parseInt(durationInput?.value) || 1;
  let allocationDuration = duration;

  if (packageType === "year") allocationDuration = duration * 12;
  if (packageType.toLowerCase() === "perpetual") allocationDuration = 1;

  let adjustedPrice = currentProduct.price ?? 0;
  if (currentProduct.package && packageType) {
    if (currentProduct.package === "year" && packageType === "month") adjustedPrice /= 12;
    else if (currentProduct.package === "month" && packageType === "year") adjustedPrice *= 12;
  }
  const isQuantityBased = currentProduct.isQuantityBased;
  const maxDiscount = currentProduct.maxDiscount || 0;
  const currentCurrency = currentProduct.currencySymbol || "đ";
  const baseTotal = adjustedPrice * (isQuantityBased ? quantitative : 1) * duration;

  listItems.push({
    id: currentProduct.id,
    name: currentProduct.name,
    category: currentProduct.category,
    license: licenseInput?.value || "",
    quantitative,
    min: currentProduct.min ?? 1,
    max: currentProduct.max ?? null,
    unit: currentProduct.unit,
    package: packageType,
    priceType: currentProduct.priceType,
    duration,
    allocationDuration,
    allocationValue: baseTotal,
    isQuantityBased,
    maxDiscount,
    discount: 0,
    discountType: "percent",
    currency: currentCurrency,
    basePrice: adjustedPrice,
    baseTotal,
    finalTotal: baseTotal
  });

  // Reset lại form
  quantitativeInput.value = currentProduct.min || 1;
  if (packageInput) packageInput.value = "";
  if (durationInput) durationInput.value = 1;
  if (subtypeInput) subtypeInput.value = "";

  currentProduct = null;

  document.getElementById("product-table").style.display = "none";
  renderPriceTable();
  document.getElementById("btn-save-section2").style.display = "inline-block";
}

function applyGlobalDiscount() {
  const valEl = document.getElementById("global-discount-input");
  const typeEl = document.getElementById("global-discount-type");
  if (!valEl || !typeEl) return;

  let val = parseFloat(String(valEl.value).replace(/,/g, "")) || 0;
  const type = typeEl.value;

  // ép giá trị hợp lệ
  if (type === "percent") {
    if (val > 100) val = 100;
    if (val < 0) val = 0;
  } else {
    if (val < 0) val = 0;
  }

  globalDiscount.value = val;
  globalDiscount.type = type;

  // render lại bảng để cập nhật Subtotal / Total
  renderPriceTable();
}

function handleDiscountInput(inputId, typeId, idx = null) {
  const input = document.getElementById(inputId);
  const typeEl = document.getElementById(typeId);
  if (!input || !typeEl) return;

  let val = parseFloat(input.value);
  if (isNaN(val)) val = 0;

  if (typeEl.value === "percent") {
    if (val > 100) input.value = 100;
    else if (val < 0) input.value = 0;
  } else {
    if (val < 0) input.value = 0;
  }

  // ✅ Với product → commit ngay khi nhập
  if (idx !== null) {
    commitDiscount(idx, input.value, typeEl.value);
  }
}

function handleDiscountTypeChange(inputId, typeId, idx = null) {
  const input = document.getElementById(inputId);
  const typeEl = document.getElementById(typeId);
  if (!input || !typeEl) return;

  let val = parseFloat(input.value);
  if (isNaN(val)) val = 0;

  if (typeEl.value === "percent") {
    if (val > 100) input.value = 100;
    else if (val < 0) input.value = 0;
  } else {
    if (val < 0) input.value = 0;
  }

  // ✅ Commit ngay sau khi đổi type nếu là product
  if (idx !== null) {
    commitDiscount(idx, input.value, typeEl.value);
  }
}

function commitPrice(idx, value) {
  const val = parseFloat(value.replace(/,/g, '')) || 0;
  const item = listItems[idx];
  item.basePrice = val;
  recomputeBaseTotal(item);
  recalcItem(idx);
}

function commitQuantity(idx, rawVal, isFinal = false) {
  const item = listItems[idx];
  if (!item) return;

  let num = Number(rawVal);
  const min = Number(item.min) || 1;
  const max = item.max !== null ? Number(item.max) : Infinity;

  if (isFinal) {
    // blur → ép về min/max
    if (num < min) num = min;
    if (num > max) num = max;
    item.quantity = isNaN(num) ? min : num;

    const inputEl = document.querySelector(`#row-${idx} input[type="number"]`);
    if (inputEl) inputEl.value = item.quantity;
  } else {
    // đang nhập → chỉ cập nhật nếu trong range
    item.quantity = isNaN(num) ? 0 : num;
    if (num < min || num > max) {
      return; // ngoài range thì không tính lại
    }
  }

  recomputeBaseTotal(item);
  recalcItem(idx);
}

function commitDuration(idx, rawValue, pkg) {
  let val = parseInt(rawValue, 10);
  if (isNaN(val)) val = 1;
  if (val < 1) val = 1;

  // chỉ giới hạn khi là month
  const isMonth = pkg === "month" || pkg === "monthly";
  if (isMonth && val > 12) val = 12;

  // ghi ngược vào input nếu có thay đổi (đảm bảo UI không vượt quá 12)
  const inputEl = document.getElementById(`duration-input-${idx}`);
  if (inputEl && String(inputEl.value) !== String(val)) {
    inputEl.value = val;
  }

  if (!listItems[idx]) return;
  const item = listItems[idx];
  item.duration = val;

  if (pkg === "year") {
    item.allocationDuration = Number(val) * 12;
  } else if (pkg === "month") {
    item.allocationDuration = Number(val);
  } else {
    item.allocationDuration = 1;
  }

  recomputeBaseTotal(item);
  recalcItem(idx);
}

function commitDiscount(idx, value, type) {
  let raw = String(value || "");
  raw = raw.replace(/[^\d\.\-\,]/g, ""); // chỉ giữ số, ., -, ,
  let val = parseFloat(raw.replace(/,/g, '')) || 0;
  const item = listItems[idx];
  const inputEl = document.getElementById(`discount-input-${idx}`);

  // reset style mặc định
  if (inputEl) {
    inputEl.style.border = "1px solid #ccc";
    inputEl.style.backgroundColor = "#fff";
  }

  // cap percent nếu cần
  if (type === "percent") {
    if (val > 100) val = 100;
    if (val < 0) val = 0;
  } else {
    if (val < 0) val = 0;
  }

  // cập nhật vào item và tính lại tổng
  item.discount = val;
  item.discountType = type;
  try {
    if (typeof recalcItem === "function") recalcItem(idx);
  } catch (e) {
    console.warn("recalcItem error:", e);
  }

  // --- kiểm tra nếu không có maxDiscount thì bỏ qua ---
  if (!item.maxDiscount || isNaN(item.maxDiscount)) {
    if (inputEl) inputEl.value = val.toLocaleString('en-US');
    return;
  }

  // --- chuẩn hoá dữ liệu ---
  const baseTotalNum = Number(String(item.baseTotal || 0).replace(/,/g, '')) || 0;
  const maxDiscPct = Number(item.maxDiscount || 0);
  const allowedAmount = (baseTotalNum * maxDiscPct) / 100;
  const $maxdiscount = maxDiscPct; // để show trong thông báo

  let isExceed = false;
  if (type === "percent") {
    if (val > maxDiscPct) isExceed = true;
  } else {
    if (val > allowedAmount) isExceed = true;
  }

  // cập nhật hiển thị input
  if (inputEl) inputEl.value = val.toLocaleString('en-US');

  // --- nếu không vượt giới hạn ---
  if (!isExceed) {
    if (inputEl) {
      inputEl.style.border = "1px solid #ccc";
      inputEl.style.backgroundColor = "#fff";
    }
    return;
  }

  // --- nếu vượt giới hạn ---
  if (inputEl) {
    inputEl.style.border = "2px solid red";
    inputEl.style.backgroundColor = "#ffe5e5";
  }

  let message;
  if (type === "percent") {
    message = (lang === "vi")
      ? `⚠ Giảm giá vượt quá mức cho phép (tối đa ${$maxdiscount}%)`
      : `⚠ Discount exceeds the allowed limit (max ${$maxdiscount}%)`;
  } else {
    const displayAllowed = (typeof formatCurrency === "function")
      ? formatCurrency(allowedAmount, item.currency || currentCurrency)
      : `${allowedAmount.toLocaleString('en-US')} ${item.currency || currentCurrency}`;

    message = (lang === "vi")
      ? `⚠ Giảm giá vượt quá mức cho phép (tối đa ${$maxdiscount}%, tương đương ${displayAllowed})`
      : `⚠ Discount exceeds the allowed limit (max ${$maxdiscount}%, equivalent to ${displayAllowed})`;
  }

  // --- show alert ---
  try {
    showAlert(message, "warning");
  } catch (e) {
    console.error("Fallback to alert:", e);
  }

  // --- cập nhật downstream ---
  try {
    if (typeof recalcAllocationValues === "function") recalcAllocationValues();
  } catch (e) {
    console.warn("recalcAllocationValues error:", e);
  }
}

function recalcItem(idx) {
  const item = listItems[idx];
  if (!item) return;

  if (item.discountType === "percent") {
    item.finalTotal = item.baseTotal * (1 - (item.discount || 0) / 100);
    item.allocationValue = item.baseTotal * (1 - (item.discount || 0) / 100);;
  } else {
    item.finalTotal = item.baseTotal - (item.discount || 0);
    item.allocationValue = item.baseTotal - (item.discount || 0);
  }

  // update DOM dòng đó
  const amountCell = document.querySelector(`#amount-${idx}`);
  if (amountCell) {
    amountCell.innerHTML = `<div style="display:flex; align-items:center; justify-content:flex-end;">
            <span style="font-weight:500; color:#333;">${formatCurrency(item.finalTotal, item.currency || currentCurrency)}</span>
        </div>`;
  }

  // update summary (subtotal + total)
  updateSummary();
}

function updateSummary() {
  const subtotal = listItems.reduce((sum, item) => sum + (item.finalTotal || 0), 0);
  const globalDiscountAmount = globalDiscount.type === "percent" ? subtotal * (globalDiscount.value / 100) : globalDiscount.value;
  const total = subtotal - (globalDiscountAmount || 0);

  const displayCurrency = listItems[0]?.currency || currentCurrency;

  const subtotalCell = document.getElementById("subtotal-cell");
  if (subtotalCell) {
    subtotalCell.innerHTML = formatCurrency(subtotal, displayCurrency);
  }

  const totalCell = document.getElementById("total-cell");
  if (totalCell) {
    totalCell.innerHTML = formatCurrency(total, displayCurrency);
  }
}

function removeQuoteItem(index) {
  if (index >= 0 && index < listItems.length) {
    listItems.splice(index, 1);
    renderPriceTable();

    // Hiện cảnh báo cho user
    const notice = document.getElementById("update-notice");
    if (notice) {
      notice.textContent = (lang === "vi") ? `⚠ Bạn cần bấm 'Update Product' để lưu thay đổi.` : `⚠ You need to click 'Update Product to save changes.'`;
      notice.style.display = "block";
    }
  }
}