// ================= SECTION 1 =================
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
              quantity: Number(p.quantity) || 0,
              unit: p.unit || "",
              duration: Number(p.duration) || 0,
              package: p.package || "",
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

async function loadTerritory() {
  try {
    const stored = await client.db.get("territoryList").catch(() => null);
    if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
      cachedTerritories = stored.value;  // ✅ gán vào biến global
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

// ============= RENDER =============
function renderNoProductMessage() {
  const header = document.querySelector(".products-header");
  if (header) header.style.display = "none";

  const container = document.getElementById("product-list");
  if (!container) return;

  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";
  container.style.minHeight = "80vh";
  container.innerHTML = `
    <div style="text-align:center; color:#555;">
      <img src="https://img.icons8.com/ios/100/box.png" alt="no product" style="opacity:0.5; margin-bottom:16px;">
      <p style="margin:8px 0;">${lang === "vi" ? "Hiện chưa có sản phẩm nào." : "There are no products yet."}</p>
    </div>
  `;

  const btnEmptyAdd = document.getElementById("btn-empty-add");
  if (btnEmptyAdd) {
    btnEmptyAdd.addEventListener("click", openProductModal);
  }
}

function renderProductList(targetId = "product-list") {
  const container = document.getElementById(targetId);
  if (!container) return;

  ensureNormalLayout();

  // 👉 Nếu không có sản phẩm → ẩn Edit, Total, show icon
  if (!listItems.length) {
    const btnEdit = document.getElementById("btn-edit-products");
    if (btnEdit) btnEdit.style.display = "none";

    container.innerHTML = `
      <div style="text-align:center; color:#555; padding:40px 0;">
        <img src="https://img.icons8.com/ios/100/box.png" alt="no product" style="opacity:0.5; margin-bottom:16px;">
        <p style="margin:8px 0;">${lang === "vi" ? "Hiện chưa có sản phẩm nào." : "There are no products yet."}</p>
      </div>
    `;
    return;
  }

  // 👉 Có sản phẩm → hiện Edit, render như cũ
  ensureSection1EditButton();
  const btnEdit = document.getElementById("btn-edit-products");
  if (btnEdit) btnEdit.style.display = "inline-block";

  // TEXT MODE
  if (!section1EditMode) {
    let total = 0;
    const html = listItems.map((item) => {
      const quantitative = Number(item.quantitative) || 1;
      const basePrice = Number(item.basePrice) || 0;
      const discount = Number(item.discount) || 0;
      const discountType = item.discountType;
      const pkg = item.package || "";
      const duration = Number(item.duration) || 1;
      const finalTotal = Number(item.finalTotal) || 0;
      total += finalTotal;

      let discountDisplay = "--";
      if (discount) {
        discountDisplay =
          discountType === "percent"
            ? `${discount}%`
            : formatCurrency(discount, item.currency);
      }

      return `
        <div class="product-card" style="border:1px solid #ddd; border-radius:6px; padding:12px; margin-bottom:12px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:600; color:#1f6feb;">${item.name}</div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px;">
            <div><strong>${lang === "vi" ? "Đơn giá" : "Price"}</strong><div>${formatCurrency(basePrice, item.currency)}</div></div>
            <div><strong>${lang === "vi" ? "Số lượng" : "Quantity"}</strong><div>${quantitative} ${item.unit || ""}</div></div>
            <div><strong>${lang === "vi" ? "Thời hạn" : "Duration"}</strong>
              <div>
                ${item.package?.toLowerCase() === "perpetual"
          ? (lang === "vi" ? "Vĩnh viễn" : "Perpetual")
          : `${duration} ${pkg}`}
              </div>
            </div>
            <div><strong>${lang === "vi" ? "Giảm giá" : "Discount"}</strong><div>${discountDisplay}</div></div>
            <div><strong>${lang === "vi" ? "Thành tiền" : "Amount"}</strong><div>${formatCurrency(finalTotal, item.currency)}</div></div>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = html + `
      <div style="text-align:right; font-weight:600; margin-top:12px;">
        ${lang === "vi" ? "Tạm tính" : "Subtotal"}: ${formatCurrency(total, listItems[0]?.currency || "đ")}
      </div>
      <div style="text-align:right; margin-top:4px;">
        ${lang === "vi" ? "Giảm giá chung" : "Global Discount"}: ${globalDiscount.type === "percent"
        ? globalDiscount.value + " %"
        : formatCurrency(globalDiscount.value, listItems[0]?.currency || "đ")
      }
      </div>
      <div style="text-align:right; font-weight:700; margin-top:4px;">
        ${lang === "vi" ? "Tổng cộng" : "Total"}: ${formatCurrency(
        total - (globalDiscount.type === "percent" ? total * globalDiscount.value / 100 : globalDiscount.value),
        listItems[0]?.currency || "đ"
      )}
      </div>
    `;

    // 👉 clear Save/Cancel footer
    const footer = document.getElementById("edit-actions-footer");
    if (footer) footer.innerHTML = "";
    return;
  }

  // EDIT MODE
  if (!editDrafts) {
    editDrafts = listItems.map(it => ({ ...it }));
  }

  let total = 0;
  const html = editDrafts.map((d, idx) => {
    const isPerpetual = d.package === 'perpetual';
    const amt = computeDraftTotals(d).finalTotal;
    total += amt;
    const priceStr = Number(d.basePrice) ? Number(d.basePrice).toLocaleString('en-US') : "";
    const quantitativeStr = Number(d.quantitative) || 0;
    const durationStr = Number(d.duration) || 0;
    const discountStr = d.discount || 0;
    const discountType = d.discountType || "percent";

    return `
      <div class="product-card" style="border:1px solid #ddd; border-radius:6px; padding:12px; margin-bottom:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <input id="edit-name-${idx}" type="text"
            value="${escapeHtml(d.name)}"
            oninput="onEditDraftChange(${idx}, 'name', this.value)"
            style="flex:1; padding:6px; font-weight:600; color:#1f6feb; border:1px solid #ccc; border-radius:4px;">
            <button type="button"
              onclick="removeDraftProduct(${idx})"
              style="margin-left:8px; background:none; border:none; cursor:pointer; color:#dc3545;">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" 
                stroke-width="1.5" stroke="currentColor" style="width:20px; height:20px;">
                <path stroke-linecap="round" stroke-linejoin="round" 
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px;">
          <!-- Price -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">${lang === "vi" ? "Đơn giá" : "Price"}</label>
            <input id="edit-price-${idx}" value="${priceStr}" 
              oninput="onEditDraftChange(${idx}, 'basePrice', this.value)"
              style="padding:6px; text-align:right;">
          </div>

          <!-- Quantitative -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">${lang === "vi" ? "Định lượng" : "Quantitative"}</label>
            <input id="edit-qty-${idx}" type="number" value="${quantitativeStr}" min="${d.min || 1}" ${d.max ? `max="${d.max}"` : ""}
               oninput="onEditDraftChange(${idx}, 'quantitative', this.value, false)" 
               onblur="onEditDraftChange(${idx}, 'quantitative', this.value, true)" 
              style="padding:6px; text-align:right;">
          </div>

          <!-- Duration -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">
              ${lang === "vi" ? "Thời hạn" : "Duration"}
            </label>

            <input id="edit-duration-${idx}"
              type="${isPerpetual ? "text" : "number"}"
              min="1"
              max="${d.package === 'month' ? 12 : ''}"
              value="${isPerpetual
        ? (lang === "vi" ? "Vĩnh viễn" : "Perpetual")
        : durationStr}"
              ${isPerpetual ? "readonly" : `oninput=\"onEditDraftChange(${idx}, 'duration', this.value)\"`}
              data-value="${durationStr}"
              style="padding:6px; text-align:right; ${isPerpetual ? 'background:#f8f9fa;' : ''}">
          </div>

          <!-- Discount -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">${lang === "vi" ? "Giảm giá" : "Discount"}</label>
            <div style="display:flex; gap:6px;">
              <input id="edit-discount-${idx}" value="${discountStr}" 
                oninput="onEditDraftChange(${idx}, 'discount', this.value)" 
                style="padding:6px; text-align:right; flex:1;">
              <select id="edit-discount-type-${idx}" 
                onchange="onEditDraftChange(${idx}, 'discountType', this.value)" 
                style="padding:6px;">
                <option value="percent" ${discountType === "percent" ? "selected" : ""}>%</option>
                <option value="amount" ${discountType === "amount" ? "selected" : ""}>${d.currency || ''}</option>
              </select>
            </div>
          </div>

          <!-- Amount -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">${lang === "vi" ? "Thành tiền" : "Amount"}</label>
            <input id="edit-amount-${idx}" value="${formatCurrency(amt, d.currency)}" readonly 
              style="padding:6px; text-align:right; font-weight:600;">
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html + `
    <div id="edit-subtotal" style="text-align:right; font-weight:600; margin-top:12px;">
      ${lang === "vi" ? "Tạm tính:" : "Subtotal:"} ${formatCurrency(total, editDrafts[0]?.currency || "đ")}
    </div>
    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:8px; gap:6px;">
      <label>${lang === "vi" ? "Giảm giá chung:" : "Global Discount:"}</label>
      <input id="edit-global-discount" type="number" value="${globalDiscount.value}" style="width:100px; text-align:right;">
      <select id="edit-global-discount-type">
        <option value="percent" ${globalDiscount.type === "percent" ? "selected" : ""}>%</option>
        <option value="amount" ${globalDiscount.type === "amount" ? "selected" : ""}>${listItems[0]?.currency || "đ"}</option>
      </select>
    </div>
    <div id="edit-total" style="text-align:right; font-weight:700; margin-top:8px;">
      ${lang === "vi" ? "Tổng cộng:" : "Total:"} ${formatCurrency(
    total - (globalDiscount.type === "percent" ? total * globalDiscount.value / 100 : globalDiscount.value),
    editDrafts[0]?.currency || "đ"
  )}
    </div>
  `;

  document.getElementById("edit-global-discount").oninput = (e) => {
    let val = parseFloat(e.target.value) || 0;

    if (globalDiscount.type === "percent") {
      if (val < 0) val = 0;
      if (val > 100) val = 100;
    } else {
      if (val < 0) val = 0;
    }

    globalDiscount.value = val;
    e.target.value = val; // ép lại giá trị hiển thị nếu vượt range

    updateGlobalTotal();
  };

  // Khi đổi loại discount (% ↔ amount)
  document.getElementById("edit-global-discount-type").onchange = (e) => {
    const newType = e.target.value;

    // Nếu chuyển từ amount -> percent và value > 100 → ép về 100
    if (newType === "percent" && globalDiscount.value > 100) {
      globalDiscount.value = 100;
      const inputEl = document.getElementById("edit-global-discount");
      if (inputEl) inputEl.value = 100;
    }

    globalDiscount.type = newType;
    updateGlobalTotal();
  };

  // 👉 Save / Cancel ở footer
  const footer = document.getElementById("edit-actions-footer");
  if (footer) {
    footer.innerHTML = `
      <button id="btn-save-section1" class="btn btn-primary">Save</button>
      <button id="btn-cancel-section1" class="btn btn-secondary">Cancel</button>
    `;
    document.getElementById("btn-save-section1").onclick = () => exitSection1EditMode(true);
    document.getElementById("btn-cancel-section1").onclick = () => exitSection1EditMode(false);
  }
}

async function renderSection1() {
  const hasData = await loadProductsFromDeal();

  // Clear trạng thái nút trước
  const btnEdit = document.getElementById("btn-edit-products");
  btnEdit.style.display = "none";

  if (hasData && listItems.length > 0) {
    renderProductList();
    if (btnEdit) btnEdit.style.display = "inline-block";
  } else {
    renderNoProductMessage();
  }
}

// ============= HELPER =============
function toggleTag() {
  if (!Array.isArray(tag)) tag = [];

  let hasPending = false;
  let hasSuccess = false;

  tag = tag.map(t => {
    if (t.toLowerCase() === "revenue pending") {
      hasPending = true;
      return "Revenue Success";
    }
    if (t.toLowerCase() === "revenue success") {
      hasSuccess = true;
      return "Revenue Pending";
    }
    return t; // giữ nguyên tag khác
  });

  // nếu không có cả pending lẫn success → thêm mới pending
  if (!hasPending && !hasSuccess) {
    tag.push("Revenue Pending");
  }
}

function ensureNormalLayout() {
  const header = document.querySelector(".products-header");
  if (header) header.style.display = "flex";

  const container = document.getElementById("product-list");
  if (container) {
    container.style.display = "block";
    container.style.flexDirection = "";
    container.style.justifyContent = "";
    container.style.alignItems = "";
    container.style.height = "";
  }
}

function ensureEditButtonState() {
  const btnEdit = document.getElementById("btn-edit-products");
  if (!btnEdit) return;

  if (lockRevenue) {
    btnEdit.disabled = true;
  } else {
    btnEdit.disabled = false;
    btnEdit.title = "";
  }
}

function toggleEditButton(state) {
  const btnEdit = document.getElementById("btn-edit-products");
  const btnSave = document.getElementById("btn-save-section1");
  const btnCancel = document.getElementById("btn-cancel-section1");
  if (!btnEdit) return;

  if (state === "view") {
    btnEdit.className = "btn btn-success";
    btnEdit.textContent = (lang === "vi") ? "Chỉnh sửa" : "Edit";
    btnEdit.disabled = false;
  } else if (state === "editing") {
    btnEdit.className = "btn btn-warning";
    btnEdit.textContent = (lang === "vi") ? "Đang chỉnh sửa..." : "Editing...";
    btnSave.textContent = (lang === "vi") ? "Lưu" : "Save";
    btnCancel.textContent = (lang === "vi") ? "Hủy" : "Cancel";
    btnEdit.disabled = true; // khóa click khi đang edit
  }
}

function computeDraftTotals(draft) {
  const basePrice = Number(draft.basePrice) || 0;
  const quantitative = Number(draft.quantitative) || 1;
  const duration = Number(draft.duration) || 1;
  const effectiveQty = draft.isQuantityBased ? quantitative : 1;
  const tmp = basePrice * effectiveQty * duration;

  let finalTotal;
  if (draft.discountType === "percent") {
    const disc = Number(draft.discount) || 0;
    baseTotal = tmp * (1 - Math.min(Math.max(disc, 0), 100) / 100);
    finalTotal = tmp * (1 - Math.min(Math.max(disc, 0), 100) / 100);
  } else { // amount
    const disc = Number(draft.discount) || 0;
    baseTotal = tmp - disc;
    finalTotal = tmp - disc;;
  }
  if (finalTotal < 0) finalTotal = 0;
  return {
    baseTotal,
    finalTotal
  };
}

function enterSection1EditMode() {
  if (!Array.isArray(listItems) || listItems.length === 0) return;
  section1EditMode = true;

  // clone sâu để không làm thay đổi listItems gốc khi đang edit
  editDrafts = listItems.map(it => ({ ...it }));

  // bật nút Save / Cancel
  const btnSave = document.getElementById("btn-save-section1");
  const btnCancel = document.getElementById("btn-cancel-section1");
  if (btnSave) btnSave.style.display = "inline-block";
  if (btnCancel) btnCancel.style.display = "inline-block";

  renderProductList(); // render lại UI ở chế độ edit
}

async function exitSection1EditMode(save = false) {
  try {
    if (save && Array.isArray(editDrafts)) {
      // ✅ cập nhật lại listItems từ editDrafts
      listItems = editDrafts.map(d => {
        const { baseTotal, finalTotal } = computeDraftTotals(d);
        return {
          ...d,
          allocationValue: finalTotal,
          allocationDuration: d.package === "year" ? Number(d.duration) * 12 : (d.package === "month" ? Number(d.duration) : 1),
          basePrice: Number(d.basePrice) || 0,
          quantitative: Number(d.quantitative) || 1,
          duration: Number(d.duration) || 1,
          baseTotal,
          finalTotal
        };
      });

      // ✅ tính lại tổng mới
      const originalTotal = listItems.reduce(
        (sum, it) => sum + (Number(it.finalTotal) || 0),
        0
      );

      const afterTotal = Math.max(
        0,
        globalDiscount.type === "percent"
          ? originalTotal * (1 - (Number(globalDiscount.value) || 0) / 100)
          : originalTotal - (Number(globalDiscount.value) || 0)
      );

      // ✅ lưu lên deal
      await updateDeal(afterTotal);

      const notice = document.getElementById("update-notice");
      if (notice) {
        notice.textContent = "⚠ Bạn cần bấm 'Update Product' để lưu thay đổi vào deal.";
        notice.style.display = "block";
      }
    }

  } catch (err) {
    console.error("❌ exitSection1EditMode failed:", err);
  } finally {
    // ✅ reset edit mode state
    section1EditMode = false;
    editDrafts = [];

    // ẩn nút Save/Cancel
    const btnSave = document.getElementById("btn-save-section1");
    const btnCancel = document.getElementById("btn-cancel-section1");
    if (btnSave) btnSave.style.display = "none";
    if (btnCancel) btnCancel.style.display = "none";

    toggleEditButton("view");
    renderProductList();
  }
}

function onEditDraftChange(idx, field, rawValue, isFinal = false) {
  if (!editDrafts[idx]) return;

  const numeric = ["basePrice", "quantitative", "duration", "discount"];
  if (numeric.includes(field)) {
    const cleaned = String(rawValue).replace(/,/g, "");
    let num = Number(cleaned);

    if (field === "quantitative") {
      const min = Number(editDrafts[idx].min) || 1;
      const max = editDrafts[idx].max === null ? Infinity : Number(editDrafts[idx].max);

      if (isFinal) {
        // Khi blur → ép về min/max
        if (num < min) num = min;
        if (num > max) num = max;
        editDrafts[idx][field] = isNaN(num) ? 0 : num;

        const inputEl = document.getElementById(`edit-${field}-${idx}`);
        if (inputEl) inputEl.value = editDrafts[idx][field];
      } else {
        // Khi đang nhập → chỉ recalc nếu trong range
        editDrafts[idx][field] = isNaN(num) ? 0 : num;
        if (num < min || num > max) {
          return; // ngoài range → không recalc
        }
      }
    } else if (field === "duration") {
      if (num < 1) num = 1;
      if (editDrafts[idx].package === "month" && num > 12) {
        num = 12;
      }
      editDrafts[idx][field] = isNaN(num) ? null : num;

      const inputEl = document.getElementById(`edit-${field}-${idx}`);
      if (inputEl) inputEl.value = editDrafts[idx][field];
    } else if (field === "basePrice") {
      if (num < 0) num = 0;
      editDrafts[idx][field] = isNaN(num) ? 0 : num;

      const inputEl = document.getElementById(`edit-${field}-${idx}`);
      if (inputEl) inputEl.value = editDrafts[idx][field].toLocaleString('en-US');
    } else {
      editDrafts[idx][field] = isNaN(num) ? 0 : num;

      const inputEl = document.getElementById(`edit-${field}-${idx}`);
      if (inputEl) inputEl.value = editDrafts[idx][field];
    }
  } else {
    editDrafts[idx][field] = rawValue;
  }

  // recalc amount
  const { baseTotal, finalTotal } = computeDraftTotals(editDrafts[idx]);
  const amountEl = document.getElementById(`edit-amount-${idx}`);
  if (amountEl) {
    amountEl.value = formatCurrency(finalTotal, editDrafts[idx].currency);
  }

  // --- validate discount giống Section 2 ---
  if (field === "discount" || field === "discountType") {
    const discountInputEl = document.getElementById(`edit-discount-${idx}`);

    if (discountInputEl) {
      // reset style
      discountInputEl.style.border = "1px solid #ccc";
      discountInputEl.style.backgroundColor = "#fff";

      // Convert discount về number
      let discValue = Number(editDrafts[idx].discount) || 0;

      // --- nếu percent > 100 thì ép về 100 ---
      if (editDrafts[idx].discountType === "percent" && discValue > 100) {
        discValue = 100;
        editDrafts[idx].discount = discValue;
        discountInputEl.value = discValue;
      }

      // check maxDiscount
      let isExceed = false;
      const maxDisc = Number(editDrafts[idx].maxDiscount) || 0;

      if (editDrafts[idx].discountType === "percent") {
        if (discValue > maxDisc) isExceed = true;
      } else { // amount
        const ratio = baseTotal ? (discValue / baseTotal) * 100 : 0;
        if (ratio > maxDisc) isExceed = true;
      }

      if (isExceed) {
        discountInputEl.style.border = "2px solid red";
        discountInputEl.style.backgroundColor = "#ffe5e5";

        const message = (lang === "vi")
          ? `⚠ Giảm giá vượt quá mức cho phép (tối đa ${maxDisc}%)`
          : `⚠ Discount exceeds the allowed limit (max ${maxDisc}%)`;

        const bodyEl = document.getElementById("discountWarningBody");
        if (bodyEl) bodyEl.textContent = message;

        const labelEl = document.getElementById("discountWarningLabel");
        if (labelEl) {
          labelEl.textContent = (lang === "vi") ? "⚠ Cảnh báo giảm giá" : "⚠ Discount Warning";
        }

        // show modal
        const discountModalEl = document.getElementById("discountWarningModal");
        const myModal = bootstrap.Modal.getInstance(discountModalEl) || new bootstrap.Modal(discountModalEl);
        myModal.show();

        // Khi modal đóng → restore focus để edit tiếp
        discountModalEl.addEventListener('hidden.bs.modal', () => {
          const inputEl = document.getElementById(`edit-discount-${idx}`);
          if (inputEl) inputEl.focus();
        }, { once: true });
      }
    }
  }

  // recalc subtotal + total
  const subtotal = editDrafts.reduce((sum, d) => sum + computeDraftTotals(d).baseTotal, 0);
  const total = editDrafts.reduce((sum, d) => sum + computeDraftTotals(d).finalTotal, 0);

  // update Subtotal
  const subtotalEl = document.getElementById("edit-subtotal");
  if (subtotalEl) {
    subtotalEl.innerHTML = `Subtotal: ${formatCurrency(subtotal, editDrafts[0]?.currency || "đ")}`;
  }

  // update Total
  const totalEl = document.getElementById("edit-total");
  if (totalEl) {
    totalEl.innerHTML = `Total: ${formatCurrency(
      total - (globalDiscount.type === "percent"
        ? total * globalDiscount.value / 100
        : globalDiscount.value),
      editDrafts[0]?.currency || "đ"
    )}`;
  }
}

function removeDraftProduct(idx) {
  if (!editDrafts[idx]) return;
  // Lưu lại sản phẩm bị xóa
  const removed = editDrafts[idx];
  editDrafts.splice(idx, 1);

  // --- 1️⃣ Xóa khỏi allocatedItems ---
  if (removed.id && Array.isArray(allocatedItems)) {
    const indexInAllocated = allocatedItems.findIndex(
      a => a.productId === removed.id || a.id === removed.id
    );
    if (indexInAllocated !== -1) {
      allocatedItems.splice(indexInAllocated, 1);
    }
  }

  // --- 2️⃣ Xóa khỏi allocatedRecords ---
  if (removed.id && Array.isArray(allocatedRecords)) {
    // Có thể productId trong record là string hoặc UUID, nên nên convert về string để so sánh an toàn
    const indexInRecords = allocatedRecords.findIndex(
      r => String(r.id) === String(removed.id)
    );
    if (indexInRecords !== -1) {
      allocatedRecords.splice(indexInRecords, 1);
    }
  }

  // --- 3️⃣ Render lại UI ---
  renderProductList();
}

function ensureSection1EditButton() {
  const btnOpen = document.getElementById("btn-open-modal");
  if (!btnOpen) return;

  let btnEdit = document.getElementById("btn-edit-products");
  if (!btnEdit) {
    btnEdit = document.createElement("button");
    btnEdit.id = "btn-edit-products";
    btnEdit.className = "btn btn-outline-secondary ms-2";
    btnEdit.style.marginLeft = "8px";
    btnOpen.insertAdjacentElement("afterend", btnEdit);
  }

  btnEdit.textContent = (lang === "vi") ? "Chỉnh sửa" : "Edit";
  btnEdit.onclick = () => {
    if (lockRevenue) {
      btnEdit.disabled = true;
      btnEdit.title = (lang === "vi")
        ? "Đã phân bổ doanh thu, không thể chỉnh sửa"
        : "Revenue already allocated, editing is disabled";
      return;
    }
    if (!section1EditMode) {
      enterSection1EditMode();
      toggleEditButton("editing");
      renderProductList();
    }
  };
}

function updateGlobalTotal() {
  const total = editDrafts.reduce((sum, d) => sum + computeDraftTotals(d).finalTotal, 0);
  const totalEl = document.querySelector("#product-list div[style*='font-weight:700']");
  if (totalEl) {
    totalEl.innerHTML = `Total: ${formatCurrency(
      total - (globalDiscount.type === "percent"
        ? total * globalDiscount.value / 100
        : globalDiscount.value),
      editDrafts[0]?.currency || "đ"
    )}`;
  }
}