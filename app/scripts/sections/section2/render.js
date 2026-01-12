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
    attachProductFilterEvents();

    // attach change handler (in case user changes it later)
    packageSelect.onchange = () => {
      attachProductFilterEvents();
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

  const options = [];
  if (rawPackage.includes("time")) options.push("time");
  if (rawPackage.some(p => p === "year" || p === "month")) {
    options.push("year");
    options.push("month");
  }

  // Render options but DO NOT set packageSelect.value -> wait for user
  packageSelect.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Đơn vị ---" : "--- Select Package Unit ---"}</option>` +
    options.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
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

  window.products = products;
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
        <td class="table-center-header">${rangeText}</td>
        <td class="table-center-header">${maxDiscount} %</td>
        <td class="table-center-header">${formatPrice(adjustedPrice, currentCurrency)}</td>
        <td class="table-center-header">${quantitative} ${unit}</td>
        <td class="table-center-header">${durationDisplay}</td>
        <td class="table-center-header">${formatPrice(subtotal, currentCurrency)}</td>
        <td class="table-center-header">
          <button style="margin-top: 10px; padding: 6px; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;
            border: none; border-radius: 4px; background-color: #ffffff; color: #004085; cursor: pointer; font-weight: bold;"
            onclick="pushToQuote(${idx})">
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
          <th class="table-center-header">${lang === "vi" ? "Tên sản phẩm" : "Product Name"}</th>
          <th class="table-center-header">${lang === "vi" ? "Định lượng tiêu chuẩn" : "Quantitative standard"}</th>
          <th class="table-center-header">${lang === "vi" ? "Giảm giá tối đa" : "Max discount"}</th>
          <th class="table-center-header">${lang === "vi" ? "Đơn giá" : "Unit Price"}</th>
          <th class="table-center-header">${lang === "vi" ? "Định lượng" : "Quantitative"}</th>
          <th class="table-center-header">${lang === "vi" ? "Thời hạn" : "Duration"}</th>
          <th class="table-center-header">${lang === "vi" ? "Thành tiền" : "Total"}</th>
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