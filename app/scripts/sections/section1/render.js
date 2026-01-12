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
      const vat = Number(item.vat) || 0;
      const vatStr = `${vat} %`;
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

          <div style="display:grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap:12px; font-size: 12px">
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
            <div><strong>VAT</strong><div>${vatStr}</div></div>
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
    const vat = Number(d.vat) || 0;

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

        <div style="display:grid; grid-template-columns:
          minmax(80px, 1fr)  /* Price */
          minmax(80px, 1fr)  /* Quantitative */
          minmax(80px, 1fr)  /* Duration */
          minmax(80px, auto)  /* Discount */
          minmax(20px, auto) /* VAT Type (%/$) */
          minmax(120px, auto); /* Amount */; gap:5px; font-size: 12px">
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

          <!-- VAT -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">VAT</label>
            <div style="display:flex; gap:6px;">
              <input id="edit-vat-${idx}" value="${vat}"
                oninput="onEditDraftChange(${idx}, 'vat', this.value)"
                style="padding:6px; text-align:right; flex:1;">
              <select style="padding:6px;">
                <option value="percent">%</option>
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
