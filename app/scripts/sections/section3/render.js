// ============= RENDER =============
// nhiều dòng
function renderProductAllocation() {
  const source = lockRevenue ? allocatedItems : listItems;
  const items = source.map(i => normalizeRenderItem(i));
  const container = document.getElementById("product-allocated");
  const btnAllocate = document.getElementById("btn-allocate");
  const reviewBtn = document.getElementById("btn-view-allocation");
  
  if (!container) return;

  const safe = v => (v === undefined || v === null) ? "" : String(v);
  const trim = v => safe(v).trim();
  const eq = (a, b) => trim(a).toLowerCase() === trim(b).toLowerCase();
  const escapeAttr = s => escapeHtml(s);

  // Nếu không có product
  if (!items.length) {
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.justifyContent = "center";
    container.style.alignItems = "center";
    container.style.height = "80vh";
    container.innerHTML = `
      <div style="text-align:center; color:#555;">
        <img src="https://img.icons8.com/ios/100/box.png" alt="no product" style="opacity:0.5; margin-bottom:16px;">
        <p style="margin:8px 0;">${lang === "vi" ? "Hiện chưa có sản phẩm nào." : "There are no products yet."}</p>
      </div>
    `;
    btnAllocate.style.display = "none";
    reviewBtn.style.display = "none";
    return;
  }

  // Tạo bảng dữ liệu
  const date = closedDate ? closedDate : expectedCloseDate;
  const forecastStr = date ? `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}` : "--/--/--";
  
  const rowsHtml = items.map((p, idx) => {
    let allocatedValue = 0;
    const duration = p.allocationDuration;

    if (lockRevenue) {
      allocatedValue = p.allocationValue;
    } else {
      let temp;
      if (source === listItems) {
        temp = getTemp(p);
      } else {
        temp = p.allocationValue;
      }
      allocatedValue = temp / duration;
    }

    const isTime = p.package === "time";
    const isMonth = p.package === "month";
    const forecastDisplay = forecastStr ?? p.forecastDate;
    const actualDisplay =
      (p.actualDate && p.actualDate.trim() !== "" && p.actualDate !== "--/--/--")
        ? p.actualDate
        : (facDate instanceof Date && !isNaN(facDate)
          ? `${facDate.getDate().toString().padStart(2, "0")}/${(facDate.getMonth() + 1).toString().padStart(2, "0")}/${facDate.getFullYear()}`
          : "--/--/--");

    // Product Type Options
    const allowedRoles = [role.Admin, role.AccountAdmin, role.Manager];
    let productTypeCanonicalList = [
      { v: "New", label: (lang === "vi" ? "Lần đầu" : "New") },
      { v: "Incident", label: (lang === "vi" ? "Sự cố" : "Incident") },
      { v: "Renewal", label: (lang === "vi" ? "Gia hạn" : "Renewal") },
      { v: "Renewal_GOV", label: (lang === "vi" ? "Gia hạn_GOV" : "Renewal_GOV") },
      { v: "Upsale", label: (lang === "vi" ? "Bán thêm" : "Upsale") },
      { v: "Independent", label: (lang === "vi" ? "Độc lập" : "Independent") },
      { v: "Dependent", label: (lang === "vi" ? "Phụ thuộc" : "Dependent") },
      { v: "SI", label: "SI" },
      { v: "Unknown", label: "Unknown" }
    ];

    if (!allowedRoles.includes(loggedInUser.roleId)) {
      productTypeCanonicalList = productTypeCanonicalList.filter(o => o.v !== "Unknown");
    }

    const rawProductType = safe(p.productType);
    let productTypeCanonical = "";
    for (const o of productTypeCanonicalList) {
      if (eq(rawProductType, o.v) || eq(rawProductType, o.label)) {
        productTypeCanonical = o.v;
        break;
      }
    }

    const isProductTypeCustom = !productTypeCanonical && rawProductType !== "";
    const productTypeHtmlParts = [];
    productTypeHtmlParts.push(`<option value="">-- ${lang === "vi" ? "Chọn" : "Select"} --</option>`);
    if (isProductTypeCustom) {
      productTypeHtmlParts.push(`<option value="${escapeAttr(rawProductType)}" selected>${escapeAttr(rawProductType)}</option>`);
    }
    productTypeHtmlParts.push(...productTypeCanonicalList.map(o => {
      return `<option value="${o.v}" ${o.v === productTypeCanonical ? "selected" : ""}>${o.label}</option>`;
    }));

    // SPDV Options
    const spdvOptions = [
      { v: "Standalone", label: "Standalone" },
      { v: "Service", label: "Service" },
    ];
    const rawSpdv = safe(p.spdvType);
    let spdvCanonical = "";
    for (const o of spdvOptions) {
      if (eq(rawSpdv, o.v) || eq(rawSpdv, o.label)) {
        spdvCanonical = o.v;
        break;
      }
    }
    const isSpdvCustom = !spdvCanonical && rawSpdv !== "";
    const spdvParts = [];
    spdvParts.push(`<option value="">-- ${lang === "vi" ? "Chọn" : "Select"} --</option>`);
    if (isSpdvCustom) {
      spdvParts.push(`<option value="${escapeAttr(rawSpdv)}" selected>${escapeAttr(rawSpdv)}</option>`);
    }
    spdvParts.push(...spdvOptions.map(o => `<option value="${o.v}" ${o.v === spdvCanonical ? "selected" : ""}>${o.label}</option>`));

    // Region Options (only for Vietnamese)
    let regionOptions = "";
    if (lang === "vi") {
      const regions = [
        { v: "Miền Nam", label: "Miền Nam" },
        { v: "Miền Bắc", label: "Miền Bắc" }
      ];
      const rawRegion = safe(p.region);
      let regionCanonical = "";
      for (const o of regions) {
        if (eq(rawRegion, o.v) || eq(rawRegion, o.label)) {
          regionCanonical = o.v;
          break;
        }
      }
      const isRegionCustom = !regionCanonical && rawRegion !== "";
      const regionParts = [];
      regionParts.push(`<option value="">-- Chọn --</option>`);
      if (isRegionCustom) {
        regionParts.push(`<option value="${escapeAttr(rawRegion)}" selected>${escapeAttr(rawRegion)}</option>`);
      }
      regionParts.push(...regions.map(o => `<option value="${o.v}" ${o.v === regionCanonical ? "selected" : ""}>${o.label}</option>`));
      regionOptions = regionParts.join("");
    }

    return `
      <tr>
        <td style="text-align: left; padding: 10px; vertical-align: middle;">${p.name}</td>
        <td class="text-center" style="vertical-align: middle;" id="allocatedValue" data-value="${allocatedValue}">
          ${formatCurrency(allocatedValue, p.currency || "đ")}
        </td>
        <td class="text-center" style="vertical-align: middle;">
          <select id="alloc-type-${idx}" class="form-select form-select-sm" ${lockRevenue ? "disabled" : ""}>
            ${isTime
              ? `<option value="time">${lang === 'vi' ? 'lần' : 'time'}</option>`
              : (isMonth 
                ? `<option value="month">${lang === 'vi' ? 'tháng' : 'month'}</option>`
                : `<option value="month">${lang === 'vi' ? 'tháng' : 'month'}</option>
                   <option value="year">${lang === 'vi' ? 'năm' : 'year'}</option>`
              )
            }
          </select>
        </td>
        <td class="text-center" style="vertical-align: middle;">
          ${lockRevenue
            ? `<span>${duration}</span>`
            : `<input style="text-align:center" type="number" class="form-control form-control-sm" id="alloc-count-${idx}" 
              value="${duration}" min="1" max="${duration}"
              oninput="this.value = commitAllocationCount(this.value, this.max)"></input>`
          }
        </td>
        
        <!-- Coefficient Configuration Section -->
        <td style="padding: 8px; vertical-align: middle;">
          <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px;">
            <!-- Product Type Row -->
            <div style="display: grid; grid-template-columns: 100px 1fr 80px; gap: 8px; align-items: center; margin-bottom: 8px;">
              <label style="font-size: 12px; font-weight: 500; margin: 0;">
                ${lang === "vi" ? "Loại cơ hội" : "Opportunity"}
              </label>
              <select id="product-type-${idx}" class="form-select form-select-sm" 
                      ${lockRevenue ? "disabled" : ""}
                      onchange="handleProductTypeChange(${idx}, this.value)" 
                      style="font-size: 12px;">
                ${productTypeHtmlParts.join("")}
              </select>
              <input id="product-type-value-${idx}" class="form-control form-control-sm" 
                     readonly value="${escapeHtml(p.productTypeValue || 0)}%" 
                     style="font-size: 12px; text-align: center; background: #e9ecef;">
            </div>

            <!-- SPDV Row -->
            <div style="display: grid; grid-template-columns: 100px 1fr 80px; gap: 8px; align-items: center; margin-bottom: 8px;">
              <label style="font-size: 12px; font-weight: 500; margin: 0;">
                ${lang === "vi" ? "Loại SPDV" : "Product/Service"}
              </label>
              <select id="spdv-type-${idx}" class="form-select form-select-sm" 
                      ${lockRevenue ? "disabled" : ""}
                      onchange="handleSPDVChange(${idx}, this.value)"
                      style="font-size: 12px;">
                ${spdvParts.join("")}
              </select>
              <input id="spdv-type-value-${idx}" class="form-control form-control-sm" 
                     readonly value="${escapeHtml(p.spdvTypeValue || 0)}%" 
                     style="font-size: 12px; text-align: center; background: #e9ecef;">
            </div>

            ${lang === "vi" ? `
            <!-- Region Row (Vietnamese only) -->
            <div style="display: grid; grid-template-columns: 100px 1fr 80px; gap: 8px; align-items: center; margin-bottom: 8px;">
              <label style="font-size: 12px; font-weight: 500; margin: 0;">Khu vực</label>
              <select id="region-${idx}" class="form-select form-select-sm" 
                      ${lockRevenue ? "disabled" : ""}
                      onchange="handleRegionChange(${idx}, this.value)"
                      style="font-size: 12px;">
                ${regionOptions}
              </select>
              <input id="region-value-${idx}" class="form-control form-control-sm" 
                     readonly value="${escapeHtml(p.regionValue || 0)}%" 
                     style="font-size: 12px; text-align: center; background: #e9ecef;">
            </div>
            <script>
              (function(){ 
                try{ 
                  handleRegionChange(${idx}, "${escapeAttr(market)}"); 
                  validateSelections(${idx}); 
                }catch(e){console.warn(e);} 
              })();
            </script>
            ` : ''}

            <!-- Total Coefficient Row -->
            <div style="display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: center; 
                        padding-top: 8px; border-top: 1px solid #dee2e6;">
              <label style="font-size: 13px; font-weight: 600; margin: 0; color: #0d6efd;">
                ${lang === "vi" ? "Hệ số" : "Coefficient"}
              </label>
              <input id="total-coef-${idx}" class="form-control form-control-sm" 
                     readonly value="${p.coefficient || ''}" 
                     style="font-size: 13px; font-weight: 600; text-align: center; 
                            background: #e7f3ff; border-color: #0d6efd; color: #0d6efd;">
            </div>
          </div>
        </td>

        <td class="text-center" style="vertical-align: middle;">${forecastDisplay}</td>
        <td class="text-center" style="vertical-align: middle;">${actualDisplay}</td>
      </tr>
    `;
  }).join("");

  // Render table
  container.innerHTML = `
    <table class="table table-bordered">
      <thead>
        <tr>
          <th class="text-center" style="vertical-align: middle;">
            ${lang === "vi" ? "Tên sản phẩm" : "Product Name"}
          </th>
          <th class="text-center" style="vertical-align: middle;">
            ${lang === "vi" ? "Giá trị phân bổ" : "Allocation Value"}
          </th>
          <th class="text-center" style="vertical-align: middle;">
            ${lang === "vi" ? "Loại phân bổ" : "Allocation Type"}
          </th>
          <th class="text-center" style="vertical-align: middle;">
            ${lang === "vi" ? "Số lần phân bổ" : "Allocation Count"}
          </th>
          <th class="text-center" style="vertical-align: middle; min-width: 350px;">
            ${lang === "vi" ? "Cấu hình hệ số" : "Coefficient Configuration"}
          </th>
          <th class="text-center" style="vertical-align: middle;">
            ${lang === "vi" ? "Ngày dự kiến" : "Forecast Date"}
          </th>
          <th class="text-center" style="vertical-align: middle;">
            ${lang === "vi" ? "Ngày bàn giao" : "Actual Date"}
          </th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  checkAllocationCoefficients();

  // Bind change event khi chưa apply
  if (!lockRevenue) {
    listItems.forEach((p, idx) => {
      const selType = document.getElementById(`alloc-type-${idx}`);
      const sel = document.getElementById(`alloc-count-${idx}`);
      if (!selType || !sel) return;

      selType.addEventListener("change", () => {
        let duration = p.allocationDuration;
        if (selType.value === "year") {
          duration = p.allocationDuration / 12;
        } else if (selType.value === "month") {
          duration = p.allocationDuration;
        }
        const temp = getTemp(p);
        const allocatedValue = temp / duration;
        sel.value = duration;
        sel.max = duration;
        const row = sel.closest("tr");
        if (row) {
          const td = row.querySelectorAll("td")[1];
          td.innerHTML = formatCurrency(allocatedValue, p.currency || "USD");
          td.setAttribute("data-value", allocatedValue);
        }
      });
    });
  }

  // Update trạng thái buttons
  if (reviewBtn) {
    reviewBtn.textContent = (lang === "vi") ? "Phân bổ gần nhất" : "Previous Allocation";
  }

  if (btnAllocate) {
    btnAllocate.textContent = lockRevenue
      ? (lang === "vi" ? "Đã áp dụng" : "Applied")
      : (lang === "vi" ? "Áp dụng" : "Apply");

    if (lockRevenue) {
      btnAllocate.disabled = true;
      btnAllocate.style.opacity = 0.5;
      btnAllocate.style.pointerEvents = "none";
    } else {
      checkAllocationCoefficients();
    }
  }
}

//nhiều cột 
// function renderProductAllocation() {
//   const source = lockRevenue ? allocatedItems : listItems;
//   const items = source.map(i => normalizeRenderItem(i));
//   const container = document.getElementById("product-allocated");
//   const btnAllocate = document.getElementById("btn-allocate");
//   const reviewBtn = document.getElementById("btn-view-allocation");
  
//   if (!container) return;

//   const safe = v => (v === undefined || v === null) ? "" : String(v);
//   const trim = v => safe(v).trim();
//   const eq = (a, b) => trim(a).toLowerCase() === trim(b).toLowerCase();
//   const escapeAttr = s => escapeHtml(s);

//   // Nếu không có product
//   if (!items.length) {
//     container.style.display = "flex";
//     container.style.flexDirection = "column";
//     container.style.justifyContent = "center";
//     container.style.alignItems = "center";
//     container.style.height = "80vh";
//     container.innerHTML = `
//       <div style="text-align:center; color:#555;">
//         <img src="https://img.icons8.com/ios/100/box.png" alt="no product" style="opacity:0.5; margin-bottom:16px;">
//         <p style="margin:8px 0;">${lang === "vi" ? "Hiện chưa có sản phẩm nào." : "There are no products yet."}</p>
//       </div>
//     `;
//     btnAllocate.style.display = "none";
//     reviewBtn.style.display = "none";
//     return;
//   }

//   // Tạo bảng dữ liệu
//   const date = closedDate ? closedDate : expectedCloseDate;
//   const forecastStr = date ? `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}` : "--/--/--";
  
//   const rowsHtml = items.map((p, idx) => {
//     let allocatedValue = 0;
//     const duration = p.allocationDuration;

//     if (lockRevenue) {
//       allocatedValue = p.allocationValue;
//     } else {
//       let temp;
//       if (source === listItems) {
//         temp = getTemp(p);
//       } else {
//         temp = p.allocationValue;
//       }
//       allocatedValue = temp / duration;
//     }

//     const isTime = p.package === "time";
//     const isMonth = p.package === "month";
//     const forecastDisplay = forecastStr ?? p.forecastDate;
//     const actualDisplay =
//       (p.actualDate && p.actualDate.trim() !== "" && p.actualDate !== "--/--/--")
//         ? p.actualDate
//         : (facDate instanceof Date && !isNaN(facDate)
//           ? `${facDate.getDate().toString().padStart(2, "0")}/${(facDate.getMonth() + 1).toString().padStart(2, "0")}/${facDate.getFullYear()}`
//           : "--/--/--");

//     // Product Type Options
//     const allowedRoles = [role.Admin, role.AccountAdmin, role.Manager];
//     let productTypeCanonicalList = [
//       { v: "New", label: (lang === "vi" ? "Lần đầu" : "New") },
//       { v: "Incident", label: (lang === "vi" ? "Sự cố" : "Incident") },
//       { v: "Renewal", label: (lang === "vi" ? "Gia hạn" : "Renewal") },
//       { v: "Renewal_GOV", label: (lang === "vi" ? "Gia hạn_GOV" : "Renewal_GOV") },
//       { v: "Upsale", label: (lang === "vi" ? "Bán thêm" : "Upsale") },
//       { v: "Independent", label: (lang === "vi" ? "Độc lập" : "Independent") },
//       { v: "Dependent", label: (lang === "vi" ? "Phụ thuộc" : "Dependent") },
//       { v: "SI", label: "SI" },
//       { v: "Unknown", label: "Unknown" }
//     ];

//     if (!allowedRoles.includes(loggedInUser.roleId)) {
//       productTypeCanonicalList = productTypeCanonicalList.filter(o => o.v !== "Unknown");
//     }

//     const rawProductType = safe(p.productType);
//     let productTypeCanonical = "";
//     for (const o of productTypeCanonicalList) {
//       if (eq(rawProductType, o.v) || eq(rawProductType, o.label)) {
//         productTypeCanonical = o.v;
//         break;
//       }
//     }

//     const isProductTypeCustom = !productTypeCanonical && rawProductType !== "";
//     const productTypeHtmlParts = [];
//     productTypeHtmlParts.push(`<option value="">-- ${lang === "vi" ? "Chọn" : "Select"} --</option>`);
//     if (isProductTypeCustom) {
//       productTypeHtmlParts.push(`<option value="${escapeAttr(rawProductType)}" selected>${escapeAttr(rawProductType)}</option>`);
//     }
//     productTypeHtmlParts.push(...productTypeCanonicalList.map(o => {
//       return `<option value="${o.v}" ${o.v === productTypeCanonical ? "selected" : ""}>${o.label}</option>`;
//     }));

//     // SPDV Options
//     const spdvOptions = [
//       { v: "Standalone", label: "Standalone" },
//       { v: "Service", label: "Service" },
//     ];
//     const rawSpdv = safe(p.spdvType);
//     let spdvCanonical = "";
//     for (const o of spdvOptions) {
//       if (eq(rawSpdv, o.v) || eq(rawSpdv, o.label)) {
//         spdvCanonical = o.v;
//         break;
//       }
//     }
//     const isSpdvCustom = !spdvCanonical && rawSpdv !== "";
//     const spdvParts = [];
//     spdvParts.push(`<option value="">-- ${lang === "vi" ? "Chọn" : "Select"} --</option>`);
//     if (isSpdvCustom) {
//       spdvParts.push(`<option value="${escapeAttr(rawSpdv)}" selected>${escapeAttr(rawSpdv)}</option>`);
//     }
//     spdvParts.push(...spdvOptions.map(o => `<option value="${o.v}" ${o.v === spdvCanonical ? "selected" : ""}>${o.label}</option>`));

//     // Region Options (only for Vietnamese)
//     let regionOptions = "";
//     if (lang === "vi") {
//       const regions = [
//         { v: "Miền Nam", label: "Miền Nam" },
//         { v: "Miền Bắc", label: "Miền Bắc" }
//       ];
//       const rawRegion = safe(p.region);
//       let regionCanonical = "";
//       for (const o of regions) {
//         if (eq(rawRegion, o.v) || eq(rawRegion, o.label)) {
//           regionCanonical = o.v;
//           break;
//         }
//       }
//       const isRegionCustom = !regionCanonical && rawRegion !== "";
//       const regionParts = [];
//       regionParts.push(`<option value="">-- Chọn --</option>`);
//       if (isRegionCustom) {
//         regionParts.push(`<option value="${escapeAttr(rawRegion)}" selected>${escapeAttr(rawRegion)}</option>`);
//       }
//       regionParts.push(...regions.map(o => `<option value="${o.v}" ${o.v === regionCanonical ? "selected" : ""}>${o.label}</option>`));
//       regionOptions = regionParts.join("");
//     }

//     return `
//       <tr>
//         <td style="text-align: left; padding: 10px; vertical-align: middle;">${p.name}</td>
//         <td class="text-center" style="vertical-align: middle;" id="allocatedValue" data-value="${allocatedValue}">
//           ${formatCurrency(allocatedValue, p.currency || "đ")}
//         </td>
//         <td class="text-center" style="vertical-align: middle;">
//           <select id="alloc-type-${idx}" class="form-select form-select-sm" ${lockRevenue ? "disabled" : ""}>
//             ${isTime
//               ? `<option value="time">${lang === 'vi' ? 'lần' : 'time'}</option>`
//               : (isMonth 
//                 ? `<option value="month">${lang === 'vi' ? 'tháng' : 'month'}</option>`
//                 : `<option value="month">${lang === 'vi' ? 'tháng' : 'month'}</option>
//                    <option value="year">${lang === 'vi' ? 'năm' : 'year'}</option>`
//               )
//             }
//           </select>
//         </td>
//         <td class="text-center" style="vertical-align: middle;">
//           ${lockRevenue
//             ? `<span>${duration}</span>`
//             : `<input style="text-align:center" type="number" class="form-control form-control-sm" id="alloc-count-${idx}" 
//               value="${duration}" min="1" max="${duration}"
//               oninput="this.value = commitAllocationCount(this.value, this.max)"></input>`
//           }
//         </td>
        
//         <!-- Product Type (Opportunity) -->
//         <td class="text-center" style="vertical-align: middle; padding: 6px;">
//           <div style="display: flex; align-items: center; gap: 4px;">
//             <select id="product-type-${idx}" class="form-select form-select-sm" 
//                     ${lockRevenue ? "disabled" : ""}
//                     onchange="handleProductTypeChange(${idx}, this.value)" 
//                     style="font-size: 11px; flex: 1; min-width: 80px;">
//               ${productTypeHtmlParts.join("")}
//             </select>
//             <input id="product-type-value-${idx}" class="form-control form-control-sm" 
//                    readonly value="${escapeHtml(p.productTypeValue || 0)}%" 
//                    style="font-size: 11px; text-align: center; background: #e9ecef; font-weight: 600; width: 50px;">
//           </div>
//         </td>

//         <!-- SPDV Type -->
//         <td class="text-center" style="vertical-align: middle; padding: 6px;">
//           <div style="display: flex; align-items: center; gap: 4px;">
//             <select id="spdv-type-${idx}" class="form-select form-select-sm" 
//                     ${lockRevenue ? "disabled" : ""}
//                     onchange="handleSPDVChange(${idx}, this.value)"
//                     style="font-size: 11px; flex: 1; min-width: 80px;">
//               ${spdvParts.join("")}
//             </select>
//             <input id="spdv-type-value-${idx}" class="form-control form-control-sm" 
//                    readonly value="${escapeHtml(p.spdvTypeValue || 0)}%" 
//                    style="font-size: 11px; text-align: center; background: #e9ecef; font-weight: 600; width: 50px;">
//           </div>
//         </td>

//         ${lang === "vi" ? `
//         <!-- Region (Vietnamese only) -->
//         <td class="text-center" style="vertical-align: middle; padding: 6px;">
//           <div style="display: flex; align-items: center; gap: 4px;">
//             <select id="region-${idx}" class="form-select form-select-sm" 
//                     ${lockRevenue ? "disabled" : ""}
//                     onchange="handleRegionChange(${idx}, this.value)"
//                     style="font-size: 11px; flex: 1; min-width: 80px;">
//               ${regionOptions}
//             </select>
//             <input id="region-value-${idx}" class="form-control form-control-sm" 
//                    readonly value="${escapeHtml(p.regionValue || 0)}%" 
//                    style="font-size: 11px; text-align: center; background: #e9ecef; font-weight: 600; width: 50px;">
//           </div>
//           <script>
//             (function(){ 
//               try{ 
//                 handleRegionChange(${idx}, "${escapeAttr(market)}"); 
//                 validateSelections(${idx}); 
//               }catch(e){console.warn(e);} 
//             })();
//           </script>
//         </td>
//         ` : ''}

//         <!-- Total Coefficient -->
//         <td class="text-center" style="vertical-align: middle; padding: 6px; background: #f0f8ff;">
//           <input id="total-coef-${idx}" class="form-control form-control-sm" 
//                  readonly value="${p.coefficient || ''}" 
//                  style="font-size: 13px; font-weight: 700; text-align: center; 
//                         background: #fff; border: 2px solid #0d6efd; color: #0d6efd; width: 70px; margin: 0 auto;">
//         </td>

//         <td class="text-center" style="vertical-align: middle;">${forecastDisplay}</td>
//         <td class="text-center" style="vertical-align: middle;">${actualDisplay}</td>
//       </tr>
//     `;
//   }).join("");

//   // Render table
//   container.innerHTML = `
//     <table class="table table-bordered table-sm">
//       <thead>
//         <tr>
//           <th rowspan="2" class="text-center" style="vertical-align: middle;">
//             ${lang === "vi" ? "Tên sản phẩm" : "Product Name"}
//           </th>
//           <th rowspan="2" class="text-center" style="vertical-align: middle;">
//             ${lang === "vi" ? "Giá trị<br>phân bổ" : "Allocation<br>Value"}
//           </th>
//           <th rowspan="2" class="text-center" style="vertical-align: middle;">
//             ${lang === "vi" ? "Loại<br>phân bổ" : "Allocation<br>Type"}
//           </th>
//           <th rowspan="2" class="text-center" style="vertical-align: middle;">
//             ${lang === "vi" ? "Số lần<br>phân bổ" : "Allocation<br>Count"}
//           </th>
//           <th colspan="${lang === "vi" ? 4 : 3}" class="text-center"">
//             ${lang === "vi" ? "Cấu hình hệ số" : "Coefficient Configuration"}
//           </th>
//           <th rowspan="2" class="text-center" style="vertical-align: middle;">
//             ${lang === "vi" ? "Ngày<br>dự kiến" : "Forecast<br>Date"}
//           </th>
//           <th rowspan="2" class="text-center" style="vertical-align: middle;">
//             ${lang === "vi" ? "Ngày<br>bàn giao" : "Actual<br>Date"}
//           </th>
//         </tr>
//         <tr style="background: #f8f9fa;">
//           <th class="text-center" style="font-size: 11px; padding: 4px;">
//             ${lang === "vi" ? "Loại cơ hội" : "Opportunity"}
//           </th>
//           <th class="text-center" style="font-size: 11px; padding: 4px;">
//             ${lang === "vi" ? "Loại SPDV" : "Product/Service"}
//           </th>
//           ${lang === "vi" ? `
//           <th class="text-center" style="font-size: 11px; padding: 4px;">
//             Khu vực
//           </th>
//           ` : ''}
//           <th class="text-center" style="font-size: 11px; padding: 4px; background: #e7f3ff;">
//             ${lang === "vi" ? "Hệ số" : "Coefficient"}
//           </th>
//         </tr>
//       </thead>
//       <tbody>
//         ${rowsHtml}
//       </tbody>
//     </table>
//   `;

//   checkAllocationCoefficients();

//   // Bind change event khi chưa apply
//   if (!lockRevenue) {
//     listItems.forEach((p, idx) => {
//       const selType = document.getElementById(`alloc-type-${idx}`);
//       const sel = document.getElementById(`alloc-count-${idx}`);
//       if (!selType || !sel) return;

//       selType.addEventListener("change", () => {
//         let duration = p.allocationDuration;
//         if (selType.value === "year") {
//           duration = p.allocationDuration / 12;
//         } else if (selType.value === "month") {
//           duration = p.allocationDuration;
//         }
//         const temp = getTemp(p);
//         const allocatedValue = temp / duration;
//         sel.value = duration;
//         sel.max = duration;
//         const row = sel.closest("tr");
//         if (row) {
//           const td = row.querySelectorAll("td")[1];
//           td.innerHTML = formatCurrency(allocatedValue, p.currency || "USD");
//           td.setAttribute("data-value", allocatedValue);
//         }
//       });
//     });
//   }

//   // Update trạng thái buttons
//   if (reviewBtn) {
//     reviewBtn.textContent = (lang === "vi") ? "Phân bổ gần nhất" : "Previous Allocation";
//   }

//   if (btnAllocate) {
//     btnAllocate.textContent = lockRevenue
//       ? (lang === "vi" ? "Đã áp dụng" : "Applied")
//       : (lang === "vi" ? "Áp dụng" : "Apply");

//     if (lockRevenue) {
//       btnAllocate.disabled = true;
//       btnAllocate.style.opacity = 0.5;
//       btnAllocate.style.pointerEvents = "none";
//     } else {
//       checkAllocationCoefficients();
//     }
//   }
// }

function renderAllocationPreview() {
  const body = document.getElementById("allocationModalBody");
  const title = document.getElementById("allocationModalTitle");

  if (!expandedAllocatedRecords || !expandedAllocatedRecords.length) {
    body.innerHTML = `
      <div style="padding:24px; text-align:center; color:#666;">
        ${lang === "vi" ? "Hiện chưa có dữ liệu phân bổ nào." : "No allocation data available."}
      </div>`;
    return;
  }

  if (title) {
    title.textContent = lang === "vi" ? "Phân bổ gần nhất" : "Previous Allocation";
  }

  const html = expandedAllocatedRecords.map((rec) => {
    const headerActualStr = rec.startActual || "--/--/--";

    const rows = rec.allocations.map((a, i) => {
      const forecastDateStr = a.forecastDate || "--/--/--";
      const forecastValueStr = formatCurrency(a.forecastValue, rec.currency);
      const vcsValueStr = formatCurrency(a.vcsValue, rec.currency);
      const actualDateStr = a.actualDate || "--/--/--";
      const actualValueStr = a.actualValue
        ? formatCurrency(a.actualValue, rec.currency)
        : "";
      const invoiceValueStr =
        a.invoiceValue !== null
          ? formatCurrency(a.invoiceValue, rec.currency)
          : "0";
      const acceptanceStr = a.acceptanceDate || "--/--/--";

      return `
        <tr>
          <td>${forecastDateStr}</td>
          <td>${vcsValueStr}</td>
          <td>${forecastValueStr}</td>
          <td id="actual-cell-${rec.id}-${i}">${actualDateStr}</td>
          <td id="actual-allocated-${rec.id}-${i}">${actualValueStr}</td>

          <td id="invoice-cell-${rec.id}-${i}">
            <span>${invoiceValueStr}</span>
            <button class="btn btn-link p-0 ms-1"
                    ${lockRevenue ? "disabled" : ""}
                    onclick="enableInvoiceEdit('${rec.id}', ${i})">
              <i class="bi bi-pencil"></i>
            </button>
          </td>

          <td id="acceptance-cell-${rec.id}-${i}">
            <span>${acceptanceStr}</span>
            <button class="btn btn-link p-0 ms-1"
                    ${lockRevenue ? "disabled" : ""}
                    onclick="enableAcceptanceEdit('${rec.id}', ${i})">
              <i class="bi bi-pencil"></i>
            </button>
          </td>
        </tr>`;
    }).join("");

    return `
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center"
             style="cursor:pointer; background:#eef4ff;"
             data-bs-toggle="collapse"
             data-bs-target="#collapse-${rec.id}">

          <div>
            <strong>${rec.name}</strong><br>
            <small style="font-size:12px;">
              <strong>${lang === "vi" ? "Số lần phân bổ:" : "Allocations:"}</strong>
              ${rec.allocations.length}
            </small>

            <div style="font-size:12px;">
              <strong>${lang === "vi" ? "Ngày dự kiến:" : "Forecast date:"}</strong>
              ${rec.startForecast || "--/--/--"}
            </div>

            <div style="font-size:12px;">
              <strong>${lang === "vi" ? "Ngày ghi nhận:" : "Actual date:"}</strong>
              <span id="fac-header-${rec.id}">${headerActualStr}</span>
              <button class="btn btn-link btn-sm p-0 ms-1"
                      ${lockRevenue ? "disabled" : ""}
                      onclick="enableFacEdit('${rec.id}')">
                <i class="bi bi-pencil"></i>
              </button>
            </div>
          </div>

          <i class="bi bi-chevron-down"></i>
        </div>

        <div id="collapse-${rec.id}" class="collapse show">
          <div class="card-body p-0">
            <table class="table table-sm mb-0">
              <thead class="table-light" style="font-size:14px">
                <tr>
                  <th>${lang === "vi" ? "Ngày dự kiến" : "Forecast date"}</th>
                  <th>${lang === "vi" ? "Phân bổ doanh thu VCS" : "VCS Allocation"}</th>
                  <th>${lang === "vi" ? "Phân bổ dự kiến cho AM" : "AM Forecast Allocation"}</th>
                  <th>${lang === "vi" ? "Ngày ghi nhận" : "Actual date"}</th>
                  <th>${lang === "vi" ? "Phân bổ thực tế cho AM" : "AM Actual Allocation"}</th>
                  <th>${lang === "vi" ? "Giá trị hóa đơn" : "Invoice Value"}</th>
                  <th>${lang === "vi" ? "Ngày nghiệm thu" : "Acceptance Date"}</th>
                </tr>
              </thead>
              <tbody style="font-size:12px">
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }).join("");

  body.innerHTML = html;
}

function updateAllocationTableUI(id) {
  const record = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const collapse = document.getElementById(`collapse-${id}`);
  const table = collapse
    ? collapse.querySelector("table")
    : document.querySelector("#allocationModalBody table");
  if (!table) return;

  const tbody = table.tBodies[0];
  if (!tbody) return;

  // Mapping theo UI
  const IDX_ACTUAL_DATE = 2;
  const IDX_ACTUAL_VALUE = 3;
  const IDX_INVOICE = 4;
  const IDX_ACCEPTANCE_DATE = 5;

  record.allocations.forEach((a, i) => {
    const row = tbody.rows[i];
    if (!row) return;

    // --- Actual Date ---
    const actualCell = row.cells[IDX_ACTUAL_DATE];
    if (actualCell) {
      // chỉ update nếu ô này không đang là input
      if (!actualCell.querySelector("input")) {
        actualCell.textContent = a.actualDate || "--/--/--";
      }
    }

    // --- Actual Value ---
    const allocCell = row.cells[IDX_ACTUAL_VALUE];
    if (allocCell) {
      allocCell.textContent = formatCurrency(a.actualValue, record.currency || "đ");
    }

    // --- Invoice Value ---
    const invoiceCell = row.cells[IDX_INVOICE];
    if (invoiceCell) {
      const existingInput = invoiceCell.querySelector(`#invoice-input-${id}-${i}`);
      if (existingInput) {
        // nếu đang edit, chỉ update giá trị nếu khác
        if (existingInput.value !== String(a.invoiceValue ?? "")) {
          existingInput.value = a.invoiceValue ?? "";
        }
      } else {
        // nếu không có input, hiển thị text bình thường
        invoiceCell.textContent = formatCurrency(a.invoiceValue || 0, record.currency || "đ");
      }
    }

    // --- Acceptance Date ---
    const accCell = row.cells[IDX_ACCEPTANCE_DATE];
    if (accCell) {
      const existingInput = accCell.querySelector(`#acceptance-input-${id}-${i}`);
      if (existingInput) {
        if (existingInput.value !== (a.acceptanceDate?.split("/").reverse().join("-") || "")) {
          existingInput.value = a.acceptanceDate?.split("/").reverse().join("-") || "";
        }
      } else {
        accCell.textContent = a.acceptanceDate || "--/--/--";
      }
    }
  });
}
