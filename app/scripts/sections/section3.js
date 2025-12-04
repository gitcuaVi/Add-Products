// ================= SECTION 3 =================
// ============= RENDER =============
function renderProductAllocation() {
  // ưu tiên allocatedItems -> ngược lại dùng listItems
  const source = lockRevenue ? allocatedItems : listItems;
  const items = source.map(i => normalizeRenderItem(i));
  const container = document.getElementById("product-allocated");
  const btnAllocate = document.getElementById("btn-allocate");
  const reviewBtn = document.getElementById("btn-view-allocation");
  if (!container) return;

  // helper
  const safe = v => (v === undefined || v === null) ? "" : String(v);
  const trim = v => safe(v).trim();
  const eq = (a, b) => trim(a).toLowerCase() === trim(b).toLowerCase();
  const escapeAttr = s => escapeHtml(s);

  // 2. Nếu ko có product
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

  // 3. Tạo bảng dữ liệu
  const date = closedDate ? closedDate : expectedCloseDate;
  const forecastStr = date ? `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}` : "";
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
        temp = p.allocationValue
      }
      allocatedValue = temp / duration;
    }

    const forecastDisplay = forecastStr ?? p.forecastDate;
    const actualDisplay =
      (p.actualDate && p.actualDate.trim() !== "" && p.actualDate !== "--/--/--")
        ? p.actualDate
        : (facDate instanceof Date && !isNaN(facDate)
          ? `${facDate.getDate().toString().padStart(2, "0")}/${(facDate.getMonth() + 1)
            .toString()
            .padStart(2, "0")}/${facDate.getFullYear()}`
          : "--/--/--");

    // -------- PRODUCT TYPE handling
    const productTypeCanonicalList = [
      { v: "New", label: (lang === "vi" ? "Lần đầu" : "New") },
      { v: "Incident", label: (lang === "vi" ? "Sự cố" : "Incident") },
      { v: "Renewal", label: (lang === "vi" ? "Gia hạn" : "Renewal") },
      { v: "Renewal_GOV", label: (lang === "vi" ? "Gia hạn_GOV" : "Renewal_GOV") },
      { v: "Upsale", label: (lang === "vi" ? "Bán thêm" : "Upsale") },
      { v: "Independent", label: (lang === "vi" ? "Độc lập" : "Independent") },
      { v: "Dependent", label: (lang === "vi" ? "Phụ thuộc" : "Dependent") },
      { v: "SI", label: "SI" }
    ];
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

    const productTypeHtml = `
      <select id="product-type-${idx}" class="form-select" style="flex:1;" onchange="handleProductTypeChange(${idx}, this.value)">
        ${productTypeHtmlParts.join("")}
      </select>
    `;

    // -------- SPDV handling
    const spdvOptions = [
      { v: "Standalone", label: "Standalone" },
      { v: "Service", label: "Service" }
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
    const spdvHtml = `
      <select id="spdv-type-${idx}" class="form-select" style="flex:1;" onchange="handleSPDVChange(${idx}, this.value)">
        ${spdvParts.join("")}
      </select>
    `;

    // -------- REGION handling
    let regionHtml = "";
    if (lang === "vi") {
      const regionOptions = [
        { v: "Miền Nam", label: "Miền Nam" },
        { v: "Miền Bắc", label: "Miền Bắc" }
      ];
      const rawRegion = safe(p.region);
      let regionCanonical = "";
      for (const o of regionOptions) {
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
      regionParts.push(...regionOptions.map(o => `<option value="${o.v}" ${o.v === regionCanonical ? "selected" : ""}>${o.label}</option>`));
      regionHtml = `
        <select id="region-${idx}" class="form-select" style="flex:1;" onchange="handleRegionChange(${idx}, this.value)">
          ${regionParts.join("")}
        </select>
      `;
    }

    return `
      <tr>
        <td style="text-align: left; padding: 10px">${p.name}</td>
        <td class="text-center">${formatCurrency(allocatedValue, p.currency || "đ")}</td>
        <td class="text-center">
          <select id="alloc-type-${idx}" class="form-select" ${lockRevenue ? "disabled" : ""}>
            <option value="month">month</option>
            <option value="year">year</option>
          </select>
        </td>
        <td class="text-center">
          ${lockRevenue
        ? `<span>${duration}</span>`
        : `<input style="text-align:center" type="number" id="alloc-count-${idx}" 
          value="${duration}" min="1" max="${duration}"
          oninput="this.value = commitAllocationCount(this.value, this.max)">
          </input>`
      }
        </td>
        <td class="text-center">
        <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
          <div id="coef-cell-${idx}" style="min-width:60px; font-weight:600;">
             ${p.coefficient || ""}
          </div>
          ${lockRevenue
        ? "" // 🔒 Sau khi Apply thì ẩn nút gear luôn
        : `<button type="button" class="btn btn-sm" data-bs-toggle="modal" data-bs-target="#hesoModal-${idx}" title="${lang === 'vi' ? 'Chỉnh hệ số' : 'Edit coefficient'}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" 
                      stroke-width="1.5" stroke="currentColor" width="20" height="20">
                      <path stroke-linecap="round" stroke-linejoin="round" 
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                  </svg>
              </button>`
      }
          <!-- Modal -->
          <div class="modal fade" id="hesoModal-${idx}" tabindex="-1">
            <div class="modal-dialog modal-lg">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title">${lang === "vi" ? `Cấu hình hệ số - ${p.name}` : `Coefficient Configuration - ${p.name}`}</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                  <!-- Product Type -->
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <label style="min-width:150px;">${lang === "vi" ? "Loại cơ hội" : "Opportunity Type"}</label>
                    ${productTypeHtml}
                    <input id="product-type-value-${idx}" class="form-control" style="width:120px;" readonly value="${escapeHtml(p.productTypeValue || 0)}%">
                  </div>

                  <!-- SPDV -->
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <label style="min-width:150px;">${lang === "vi" ? "Loại SPDV" : "Product/Service Type"}</label>
                    ${spdvHtml}
                    <input id="spdv-type-value-${idx}" class="form-control" style="width:120px;" readonly value="${escapeHtml(p.spdvTypeValue || 0)}%">
                  </div>

                  <!-- Region (only when lang=vi) -->
                  ${lang === "vi" ? `
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <label style="min-width:150px;">Khu vực</label>
                    ${regionHtml}
                    <script>
                      (function(){ try{ handleRegionChange(${idx}, "${escapeAttr(market)}"); validateSelections(${idx}); }catch(e){console.warn(e);} })();
                    </script>
                    <input id="region-value-${idx}" class="form-control" style="width:120px;" readonly value="${escapeHtml(p.regionValue || 0)}%">
                  </div>
                  ` : ''}

                  <!-- Hệ số tổng -->
                  <div style="display:flex; align-items:center; gap:8px; margin-top:15px;">
                    <label style="min-width:150px;">${lang === "vi" ? "Hệ số" : "Coefficient"}</label>
                    <input id="total-coef-${idx}" class="form-control" style="width:120px;" readonly value="${p.coefficient || ''}">
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${lang === "vi" ? "Close" : "Đóng"}</button>
                  <button type="button" class="btn btn-primary" onclick="saveHeSo(${idx})">${lang === "vi" ? "Save" : "Lưu"}</button>
                </div>
              </div>
            </div>
          </div>
        </td>
        <td class="text-center">${forecastDisplay}</td>
        <td class="text-center">${actualDisplay}</td>
      </tr>
    `;
  }).join("");

  // 4. Render table
  container.innerHTML = `
    <table class="table table-bordered">
      <thead>
        <tr>
          <th class="text-center">${lang === "vi" ? "Tên sản phẩm" : "Product Name"}</th>
          <th class="text-center">${lang === "vi" ? "Giá trị phân bổ" : "Allocation Value"}</th>
          <th class="text-center">${lang === "vi" ? "Loại phân bổ" : "Allocation Type"}</th>
          <th class="text-center">${lang === "vi" ? "Số lần phân bổ" : "Allocation Count"}</th>
          <th class="text-center">${lang === "vi" ? "Hệ số phân bổ" : "Coefficient"}</th>
          <th class="text-center">${lang === "vi" ? "Ngày dự kiến" : "Forecast Date"}</th>
          <th class="text-center">${lang === "vi" ? "Ngày chính thức" : "Actual Date"}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  checkAllocationCoefficients();

  // 5. Chỉ bind change event khi chưa apply
  if (!lockRevenue) {
    listItems.forEach((p, idx) => {
      const selType = document.getElementById(`alloc-type-${idx}`);
      const sel = document.getElementById(`alloc-count-${idx}`);
      if (!selType || !sel) return;

      selType.addEventListener("change", () => {
        let duration;
        if (selType.value === "year") {
          duration = p.allocationDuration / 12;
        } else {
          duration = p.allocationDuration;
        }
        const temp = getTemp(p);
        const allocatedValue = temp / duration;
        sel.value = duration;
        sel.max = duration;
        const row = sel.closest("tr");
        if (row) {
          row.querySelectorAll("td")[1].innerHTML = formatCurrency(allocatedValue, p.currency || "USD");
        }
      });
    });
  }

  // 6. Update trạng thái Review button
  if (reviewBtn) reviewBtn.textContent = (lang === "vi") ? "Xem lại" : "Review";

  // 7. Update trạng thái Apply button
  if (btnAllocate) {
    btnAllocate.textContent = lockRevenue
      ? (lang === "vi" ? "Đã áp dụng" : "Applied")
      : (lang === "vi" ? "Áp dụng" : "Apply");

    if (lockRevenue) {
      // nếu đã lock thì bắt buộc disable
      btnAllocate.disabled = true;
      btnAllocate.style.opacity = 0.5;
      btnAllocate.style.pointerEvents = "none";
    } else {
      checkAllocationCoefficients();
    }
  }
}

function renderAllocationPreview() {
  if (!expandedAllocatedRecords || !expandedAllocatedRecords.length) {
    const body = document.getElementById("allocationModalBody");
    if (body)
      body.innerHTML = `<div style="padding: 24px; text-align:center; color:#666;">
        ${lang === "vi" ? "Hiện chưa có dữ liệu phân bổ nào." : "No allocation data available."}
      </div>`;
    return;
  }

  const previous = document.getElementById("allocationModalTitle");
  previous.textContent = (lang === "vi") ? "Phân bổ lần trước" : "Previous Allocation";

  // format facDate nếu có
  const facStr = facDate
    ? `${facDate.getDate().toString().padStart(2, "0")}/${(facDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${facDate.getFullYear()}`
    : null;

  const html = expandedAllocatedRecords
    .map((rec) => {
      const actualDisplay = facStr || rec.startActual || "--/--/--";

      const rows = rec.allocations
        .map((a, i) => {
          let actualCell = "--/--/--";

          // nếu có facDate thì tính theo tháng
          if (facDate instanceof Date) {
            const calcDate = new Date(facDate);
            calcDate.setMonth(calcDate.getMonth() + i); // +i tháng từ FAC
            actualCell = `${calcDate.getDate().toString().padStart(2, "0")}/${(calcDate.getMonth() + 1)
              .toString()
              .padStart(2, "0")}/${calcDate.getFullYear()}`;
          } else if (a.actualDate) {
            actualCell = a.actualDate;
          }

          return `
            <tr>
              <td>${a.forecastDate}</td>
              <td>${formatCurrency(a.forecastValue, rec.currency)}</td>
              <td id="actual-cell-${rec.id}-${i}">${actualCell}</td>
              <td id="actual-allocated-${rec.id}-${i}">${a.actualValue ? formatCurrency(a.actualValue, rec.currency) : ""}</td>
              <td id="invoice-cell-${rec.id}-${i}">
                <span>${a.invoiceValue !== null ? formatCurrency(a.invoiceValue, rec.currency) : "0"}</span>
                <button class="btn btn-link p-0 ms-1" title="Edit" ${lockRevenue ? "disabled" : ""}
                        onclick="enableInvoiceEdit('${rec.id}', ${i})">
                  <i class="bi bi-pencil"></i>
                </button>
              </td>
              <td id="acceptance-cell-${rec.id}-${i}">
                <span>${a.acceptanceDate ? a.acceptanceDate : "--/--/--"}</span>
                <button class="btn btn-link p-0 ms-1" title="Edit Acceptance Date" ${lockRevenue ? "disabled" : ""}
                        onclick="enableAcceptanceEdit('${rec.id}', ${i})">
                  <i class="bi bi-pencil"></i>
                </button>
              </td>
            </tr>`;
        })
        .join("");

      // tổng hợp HTML cho từng record
      return `
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center" 
              style="cursor:pointer; background:#eef4ff;"
              data-bs-toggle="collapse" data-bs-target="#collapse-${rec.id}">
            <div>
              <strong>${rec.name}</strong><br>
              <small style="font-size:12px;">
                <strong>${lang === "vi" ? "Số lần phân bổ:" : "Allocations:"}</strong> ${rec.allocations.length}
              </small> 
              <small>
                <div>
                  <div style="font-size:12px;">
                    <strong>${lang === "vi" ? "Ngày dự kiến:" : "Forecast date:"}</strong>
                    ${rec.startForecast}
                  </div>
                  <div style="font-size:12px;">
                    <strong>${lang === "vi" ? "Ngày chính thức:" : "Actual date:"}</strong>
                    <span id="fac-header-${rec.id}">${actualDisplay}</span>
                    <button class="btn btn-link btn-sm p-0 ms-1" title="Edit FAC" ${lockRevenue ? "disabled" : ""}
                            onclick="enableFacEdit('${rec.id}')">
                      <i class="bi bi-pencil"></i>
                    </button>
                  </div>
                </div>
              </small>
            </div>
            <i class="bi bi-chevron-down"></i>
          </div>
          <div id="collapse-${rec.id}" class="collapse show">
            <div class="card-body p-0">
              <table class="table mb-0 table-sm">
                <thead class="table-light">
                  <tr>
                    <th>${lang === "vi" ? "Ngày dự kiến" : "Forecast date"}</th>
                    <th>${lang === "vi" ? "Phân bổ dự kiến" : "Forecast Allocation"}</th>
                    <th>${lang === "vi" ? "Ngày chính thức" : "Actual date"}</th>
                    <th>${lang === "vi" ? "Phân bổ thực tế" : "Actual Allocation"}</th>
                    <th>${lang === "vi" ? "Giá trị hóa đơn" : "Invoice Value"}</th>
                    <th>${lang === "vi" ? "Ngày nghiệm thu" : "Acceptance Date"}</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const body = document.getElementById("allocationModalBody");
  if (body) body.innerHTML = html;
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

// ============== EVENT =============
function handleProductTypeChange(idx, val) {
  const input = document.getElementById(`product-type-value-${idx}`);
  if (!input) return;
  const value = heSoMap.opportunity[val];
  if (value === "SI") {
    input.removeAttribute("readonly");
    input.value = "";
    input.placeholder = lang === "vi" ? "Nhập hệ số SI" : "Enter SI coefficient";
    document.getElementById(`total-coef-${idx}`).value = calculateTotalCoefficient(idx) + "%";
  } else {
    input.setAttribute("readonly", true);
    input.value = value !== undefined ? value + "%" : "";
    document.getElementById(`total-coef-${idx}`).value = calculateTotalCoefficient(idx) + "%";
  }
  validateSelections(idx);
}

function handleSPDVChange(idx, val) {
  const input = document.getElementById(`spdv-type-value-${idx}`);
  if (input) input.value = heSoMap.spdv[val] !== undefined ? heSoMap.spdv[val] + "%" : "";
  document.getElementById(`total-coef-${idx}`).value = calculateTotalCoefficient(idx) + "%";
  validateSelections(idx);
}

function handleRegionChange(idx, val) {
  const input = document.getElementById(`region-value-${idx}`);
  if (input) input.value = heSoMap.region[val] !== undefined ? heSoMap.region[val] + "%" : "";
  document.getElementById(`total-coef-${idx}`).value = calculateTotalCoefficient(idx) + "%";
  validateSelections(idx);
}

// ============= HELPER =============
function normalizeRenderItem(item) {
  return {
    id: item.id ?? null,
    name: item.name ?? "",
    allocationValue: item.allocationValue || 0,
    allocationDuration: item.allocationDuration || 1,
    coefficient: item.coefficient,
    forecastDate: item.forecastDate ?? item.startForecast ?? null,
    actualDate: item.actualDate ?? item.actual_date ?? item.facDate ?? null,
    type: item.type || "multi",
    productType: item.productType || "",
    productTypeValue: (typeof heSoMap !== "undefined" && heSoMap.opportunity && item.productType) ? (heSoMap.opportunity[item.productType]) : "",
    spdvType: item.spdvType || "",
    spdvTypeValue: (typeof heSoMap !== "undefined" && heSoMap.spdv && item.spdvType) ? (heSoMap.spdv[item.spdvType]) : "",
    region: item.region || "",
    regionValue: (typeof heSoMap !== "undefined" && heSoMap.region && item.region) ? (heSoMap.region[item.region]) : "",
    currency: item.currency || "đ",
  };
}

function saveHeSo(idx) {
  const totalCoef = calculateTotalCoefficient(idx);
  if (totalCoef === null) return;

  // 1. Cập nhật data model (nếu bạn lưu trong listItems/allocatedItems)
  const target = listItems?.[idx] || allocatedItems?.[idx];
  if (target) {
    target.coefficient = totalCoef; // lưu lại hệ số tổng
    target.productType = document.getElementById(`product-type-${idx}`)?.value || "";
    target.spdvType = document.getElementById(`spdv-type-${idx}`)?.value || "";
  }

  // 2. Update cell ngoài bảng
  const coefCell = document.getElementById(`coef-cell-${idx}`);
  if (coefCell) coefCell.textContent = totalCoef + "%";

  // 3. Đóng modal
  const modalEl = document.getElementById(`hesoModal-${idx}`);
  if (modalEl) {
    const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modalInstance.hide();
  }

  setTimeout(() => checkAllocationCoefficients(), 0);
}

function buildAllocatedRecords(items = [], startFC = (closedDate || expectedCloseDate), startAC = (facDate || "")) {
  if (!Array.isArray(items)) return [];

  // helper: check valid Date object
  const isValidDate = d => d instanceof Date && !isNaN(d.getTime());
  const fmtDate = d => isValidDate(d) ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "";

  // helper: compute discount
  function computeDiscount(baseValue, subtotal) {
    const gd = globalDiscount || { value: 0, type: "percent" };
    const rawVal = gd.value || 0;
    if (gd.type === "percent") {
      return Math.max(0, baseValue * (1 - (Number(rawVal) || 0) / 100));
    } else {
      const ratio = baseValue / subtotal;
      const share = ratio * (Number(gd.value) || 0);
      return Math.max(0, baseValue - share);
    }
  }

  // subtotal tổng để chia tỷ lệ discount
  const subtotal = items.map(item => {
    let coef = item.coefficient;
    if (typeof coef === "string" && coef.trim().endsWith("%")) {
      coef = parseFloat(coef.replace("%", "").trim());
    } else {
      coef = Number(coef);
      if (isNaN(coef)) coef = 0;
    }
    const value = item.allocationValue || 0;
    const duration = item.allocationDuration || 1;
    return value * duration * coef / 100;
  }).reduce((a, b) => a + b, 0);

  const start_FC = startFC ? new Date(startFC) : null;
  const start_AC = startAC ? new Date(startAC) : null;
  const start_FC_valid = isValidDate(start_FC) ? start_FC : null;
  const start_AC_valid = isValidDate(start_AC) ? start_AC : null;

  // reset expandedAllocatedRecords mỗi lần build lại
  expandedAllocatedRecords.length = 0;

  const compactRecords = items.map(item => {
    const id = item.id || `p_${Math.random().toString(36).slice(2, 7)}`;
    const name = item.name || "";
    const currency = item.currency || "đ";
    const category = item.category;
    const territory = item.region || "";
    const duration = Number(item.allocationDuration) || 1;
    const AllocValue = Number(item.allocationValue) || 0;

    // hệ số
    let coef = item.coefficient;
    if (typeof coef === "string" && coef.trim().endsWith("%")) {
      coef = parseFloat(coef.replace("%", "").trim());
    } else {
      coef = Number(coef);
      if (isNaN(coef)) coef = 0;
    }

    const baseValue = AllocValue * duration * coef / 100;
    const itemValue = computeDiscount(baseValue, subtotal);
    const perMonthValue = (AllocValue * coef) / 100;

    // clone date tránh mutate
    let currFC = start_FC_valid ? new Date(start_FC_valid) : null;
    let currAC = start_AC_valid ? new Date(start_AC_valid) : null;

    // lấy allocations hiện tại nếu có (để lưu override)
    const existingAlloc = Array.isArray(item.allocations) ? item.allocations : [];

    const allocationOverrides = existingAlloc
      .map((a, i) => ({
        index: i,
        acceptanceDate: a.acceptanceDate || "",
        invoiceValue: a.invoiceValue || 0
      }))
      .filter(o => o.acceptanceDate || o.invoiceValue);

    // --- build compact record ---
    const compact = {
      id,
      name,
      category,
      territory,
      totalValue: itemValue,
      count: duration,
      currency,
      period: periodicity || "month",
      forecastStart: fmtDate(start_FC_valid),
      actualStart: fmtDate(start_AC_valid),
      forecastValue: perMonthValue,
      actualValue: perMonthValue,
      allocationOverrides
    };

    // --- build expanded record (song song) ---
    const allocations = [];
    const periodType = item.type || "month";

    for (let i = 0; i < duration; i++) {
      const ov = allocationOverrides.find(o => o.index === i) || {};
      allocations.push({
        forecastDate: currFC ? fmtDate(currFC) : "",
        forecastValue: perMonthValue,
        actualDate: currAC ? fmtDate(currAC) : "",
        actualValue: perMonthValue,
        acceptanceDate: ov.acceptanceDate || "",
        invoiceValue: Number(ov.invoiceValue || 0)
      });
      if (currFC && isValidDate(currFC)) {
        if (periodType === "month") {
          currFC = new Date(currFC.getFullYear(), currFC.getMonth() + 1, currFC.getDate());
        } else if (periodType === "year") {
          currFC = new Date(currFC.getFullYear() + 1, currFC.getMonth(), currFC.getDate());
        }
      }

      if (currAC && isValidDate(currAC)) {
        if (periodType === "month") {
          currAC = new Date(currAC.getFullYear(), currAC.getMonth() + 1, currAC.getDate());
        } else if (periodType === "year") {
          currAC = new Date(currAC.getFullYear() + 1, currAC.getMonth(), currAC.getDate());
        }
      }
    }

    expandedAllocatedRecords.push({
      id,
      name,
      totalValue: itemValue,
      currency,
      startForecast: fmtDate(start_FC_valid),
      startActual: fmtDate(start_AC_valid),
      allocations
    });

    return compact;
  });

  return compactRecords;
}

function handleKey(e, id, index) {
  if (e.key !== "Enter") return;

  const record = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const alloc = record.allocations[index];
  if (!alloc) return;

  // Lấy input hiện tại (có thể chỉ 1 trong 2)
  const invoiceInput = document.getElementById(`invoice-input-${id}-${index}`);
  const acceptanceInput = document.getElementById(`acceptance-input-${id}-${index}`);

  // Ưu tiên giá trị từ input hiện tại, nếu không có thì lấy từ record.allocations
  const invoiceValue = invoiceInput
    ? Number(invoiceInput.value || 0)
    : Number(alloc.invoiceValue || 0);

  const acceptanceDate = acceptanceInput
    ? acceptanceInput.value.trim()
    : (alloc.acceptanceDate ? alloc.acceptanceDate.split("/").reverse().join("-") : "");

  const hasInvoice = invoiceValue > 0;
  const hasAcceptance = acceptanceDate && acceptanceDate !== "--/--/--";

  if (!hasInvoice || !hasAcceptance) {
    if (!hasInvoice) {
      const cell = document.getElementById(`invoice-cell-${id}-${index}`);
      if (cell) {
        cell.style.backgroundColor = "#ffe6e6";
        setTimeout(() => (cell.style.backgroundColor = ""), 1500);
      }
    }
    if (!hasAcceptance) {
      const cell = document.getElementById(`acceptance-cell-${id}-${index}`);
      if (cell) {
        cell.style.backgroundColor = "#ffe6e6";
        setTimeout(() => (cell.style.backgroundColor = ""), 1500);
      }
    }
    return;
  }

  // ✅ Cả 2 đều có value → gọi xử lý chính
  handleChange(id, index, invoiceValue, acceptanceDate);
}

function enableInvoiceEdit(id, index) {
  const cell = document.getElementById(`invoice-cell-${id}-${index}`);
  if (!cell) return;

  const record = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const current = record.allocations[index];
  const currentValue = current.invoiceValue ?? "";

  // Render input
  cell.innerHTML = `
    <input id="invoice-input-${id}-${index}"
           type="number"
           class="form-control form-control-sm"
           style="max-width:140px; display:inline-block;"
           value="${currentValue}"
           placeholder="${lang === 'vi' ? 'Nhập giá trị...' : 'Enter value...'}"
           onkeydown="if(event.key === 'Enter'){ commitInvoiceValue('${id}', ${index}, this.value) }"
           onblur="disableInvoiceEdit('${id}', ${index})">
  `;

  setTimeout(() => {
    const input = document.getElementById(`invoice-input-${id}-${index}`);
    if (input) input.focus();
  }, 30);
}

function enableAcceptanceEdit(id, index) {
  const cell = document.getElementById(`acceptance-cell-${id}-${index}`);
  if (!cell) return;

  const record = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const current = record.allocations[index];
  const currentValue = current.acceptanceDate || "";

  cell.innerHTML = `
    <input id="acceptance-input-${id}-${index}"
           type="date"
           class="form-control form-control-sm"
           style="max-width:160px; display:inline-block;"
           value="${currentValue ? currentValue.split('/').reverse().join('-') : ''}"
           onkeydown="if(event.key === 'Enter'){ commitAcceptanceValue('${id}', ${index}, this.value) }"
           onblur="disableAcceptanceEdit('${id}', ${index})">
  `;

  setTimeout(() => {
    const input = document.getElementById(`acceptance-input-${id}-${index}`);
    if (input) input.focus();
  }, 30);
}

function enableFacEdit(id) {
  const span = document.getElementById(`fac-header-${id}`);
  if (!span) return;

  // Lấy giá trị hiện tại (dd/mm/yyyy -> yyyy-mm-dd)
  const current = span.textContent.trim();
  const isoVal = current.includes("/")
    ? current.split("/").reverse().join("-")
    : "";

  // Tạo input type="date"
  const input = document.createElement("input");
  input.type = "date";
  input.id = `fac-input-${id}`;
  input.className = "form-control form-control-sm d-inline-block";
  input.style.width = "150px";
  input.value = isoVal;

  // Nút Save
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-sm btn-primary ms-2";
  saveBtn.textContent = "Save";
  saveBtn.onclick = () => saveFacEdit(id);

  // Nút Cancel
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-sm btn-secondary ms-1";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => cancelFacEdit(id);

  // Thay nội dung span bằng input + nút
  span.innerHTML = "";
  span.appendChild(input);
  span.appendChild(saveBtn);
  span.appendChild(cancelBtn);

  input.focus();
}

function saveFacEdit(id) {
  const input = document.getElementById(`fac-input-${id}`);
  if (!input) return;
  const rawVal = input.value?.trim();
  if (!rawVal) {
    showAlert("⚠ Please select a valid FAC date.", "warning");
    return;
  }

  // yyyy-mm-dd -> dd/mm/yyyy
  const formatted = rawVal.split("-").reverse().join("/");

  // Cập nhật dữ liệu trong allocatedRecords
  const rec = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!rec) return;

  // Lấy forecastDate đầu tiên
  const firstForecast = rec.allocations[0]?.forecastDate;
  if (!firstForecast) return;
  const baseForecast = parseDDMMYYYYtoDate(firstForecast);
  const newFacDate = new Date(rawVal);
  const offsetDays = Math.floor((newFacDate - baseForecast) / (1000 * 60 * 60 * 24));

  // Cập nhật actualDate cho từng allocation
  rec.allocations.forEach((a, i) => {
    const fc = parseDDMMYYYYtoDate(a.forecastDate);
    if (fc) {
      const newDate = new Date(fc);
      newDate.setDate(newDate.getDate() + offsetDays);
      a.actualDate = formatDateToDDMMYYYY(newDate);
    }
    // Cập nhật DOM
    const cell = document.getElementById(`actual-cell-${id}-${i}`);
    if (cell) cell.textContent = a.actualDate || "--/--/--";
  });

  rec.startActual = formatted;

  // Render lại header
  const span = document.getElementById(`fac-header-${id}`);
  if (span) {
    span.innerHTML = `
      ${formatted}
      <button class="btn btn-link btn-sm p-0 ms-1" title="Edit FAC"
              onclick="enableFacEdit('${id}')">
      </button>
    `;
  }
}

function cancelFacEdit(id) {
  const rec = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  const span = document.getElementById(`fac-header-${id}`);
  if (!span) return;

  const current = rec?.startActual || rec?.allocations?.[0]?.actualDate || "--/--/--";
  span.innerHTML = `
    ${current}
    <button class="btn btn-link btn-sm p-0 ms-1" title="Edit FAC"
            onclick="enableFacEdit('${id}')">
    </button>
  `;
}

function commitInvoiceValue(id, index, value) {
  const record = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const invoiceVal = Number(value) || 0;
  record.allocations[index].invoiceValue = invoiceVal;

  handleKey({ key: "Enter" }, id, index);
  disableInvoiceEdit(id, index);
}

function commitAcceptanceValue(id, index, value) {
  const record = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const dateStr = value ? value.split("-").reverse().join("/") : "";
  record.allocations[index].acceptanceDate = dateStr;

  handleKey({ key: "Enter" }, id, index);
  disableAcceptanceEdit(id, index);
}

function disableInvoiceEdit(id, index) {
  const record = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const cell = document.getElementById(`invoice-cell-${id}-${index}`);
  if (!cell) return;

  const a = record.allocations[index];
  cell.innerHTML = `
    <span>${a.invoiceValue ? formatCurrency(a.invoiceValue, record.currency) : "0"}</span>
    <button class="btn btn-link p-0 ms-1" title="Edit"
            onclick="enableInvoiceEdit('${id}', ${index})">
      <i class="bi bi-pencil"></i>
    </button>
  `;
}

function disableAcceptanceEdit(id, index) {
  const record = expandedAllocatedRecords.find(r => String(r.id) === String(id));
  if (!record) return;

  const cell = document.getElementById(`acceptance-cell-${id}-${index}`);
  if (!cell) return;

  const a = record.allocations[index];
  cell.innerHTML = `
    <span>${a.acceptanceDate || "--/--/--"}</span>
    <button class="btn btn-link p-0 ms-1" title="Edit"
            onclick="enableAcceptanceEdit('${id}', ${index})">
      <i class="bi bi-pencil"></i>
    </button>
  `;
}

function handleChange(id, index, invoiceValue, acceptanceDateInput) {
  const recordIndex = expandedAllocatedRecords.findIndex(r => String(r.id) === String(id));
  if (recordIndex === -1) return;

  const record = expandedAllocatedRecords[recordIndex];
  const allocations = Array.isArray(record.allocations)
    ? record.allocations.map(a => ({ ...a }))
    : [];
  const totalValue = Number(record.totalValue || 0);
  const perDayValue = totalValue / 365;

  // --- Helper: parse string date -> Date
  function toDateOnly(d) {
    if (!d) return null;
    if (d instanceof Date && !isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (typeof d === "string") {
      if (d.includes("/")) {
        const [dd, mm, yy] = d.split("/");
        return new Date(Number(yy), Number(mm) - 1, Number(dd));
      }
      if (d.includes("-")) {
        const [yy, mm, dd] = d.split("-");
        return new Date(Number(yy), Number(mm) - 1, Number(dd));
      }
    }
    return null;
  }

  function formatDDMMYYYY(dt) {
    if (!dt || !(dt instanceof Date) || isNaN(dt.getTime())) return "";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = String(dt.getFullYear());
    return `${dd}/${mm}/${yy}`;
  }

  // --- Parse acceptanceDate, invoiceValue
  const acceptanceDate = toDateOnly(acceptanceDateInput);
  const acceptanceDateStr = acceptanceDate ? formatDDMMYYYY(acceptanceDate) : (acceptanceDateInput || "");
  const invoiceVal = Number(invoiceValue) || 0;

  let periodLength = 1;
  switch (periodicity) {
    case "quarter":
      periodLength = 3;
      break;
    case "hale-year":
      periodLength = 6;
      break;
    case "year":
      periodLength = 12;
      break;
    default:
      periodLength = 1;
  }

  // --- 1️⃣ Tính diffDays (số ngày từ actual của kỳ trước -> ngày nghiệm thu)
  const prevIndex = Math.max(0, index - periodLength);
  const prevActualStr = allocations[prevIndex]?.actualDate;
  const prevActual = toDateOnly(prevActualStr);
  const currentActual = toDateOnly(allocations[index]?.actualDate);

  if (!prevActual || !acceptanceDate) return;

  // --- 2️⃣ Tính end ngày cho diffDays
  const acceptanceTemp = new Date(acceptanceDate);
  acceptanceTemp.setDate(acceptanceTemp.getDate() - 1);
  const end = acceptanceDate > currentActual ? acceptanceTemp : currentActual;

  // --- 3️⃣ diffDays = end - start + 1
  let diffDays = Math.floor((end - prevActual) / (1000 * 3600 * 24)) + 1;
  if (diffDays < 0) diffDays = 0;

  // --- 4️⃣ tempSum = diffDays * perDayValue
  const tempSum = diffDays * perDayValue;

  // --- 5️⃣ remainDays = endOfMonth(actualDate[index]) - acceptanceDate + 1
  const actualRef = currentActual || acceptanceDate;
  const endOfMonth = new Date(actualRef.getFullYear(), actualRef.getMonth() + 1, 0);
  let remainDays = Math.floor((endOfMonth - acceptanceDate) / (1000 * 3600 * 24)) + 1;
  if (remainDays < 0) remainDays = 0;

  // --- 6️⃣ accurateValue = remainAllocValue + remainingDiff
  const remainingDiff = invoiceVal - tempSum;
  const remainAllocValue = remainDays * perDayValue;
  const accurateValue = remainAllocValue + remainingDiff;

  // --- 7️⃣ Cập nhật record
  allocations[index].invoiceValue = invoiceVal;
  allocations[index].actualValue = accurateValue;
  allocations[index].acceptanceDate = acceptanceDateStr;
  allocations[index].actualDate = acceptanceDateStr;

  // --- 8️⃣ Tính lại các kỳ sau
  const usedSum = allocations.slice(0, index + 1).reduce((s, a) => s + (a.actualValue || 0), 0);
  let remainTotal = totalValue - usedSum;
  if (remainTotal < 0) remainTotal = 0;

  const n = allocations.length;
  const perNext = (n - (index + 1)) > 0 ? remainTotal / (n - (index + 1)) : 0;

  for (let j = index + 1; j < n; j++) {
    allocations[j].actualValue = perNext;
  }

  console.table({
    periodLength,
    prevIndex,
    prevActual: formatDDMMYYYY(prevActual),
    currentActual: formatDDMMYYYY(currentActual),
    acceptanceDate: formatDDMMYYYY(acceptanceDate),
    acceptanceTemp: formatDDMMYYYY(acceptanceTemp),
    end: formatDDMMYYYY(end),
    diffDays,
    tempSum,
    remainDays,
    remainingDiff,
    remainAllocValue,
    accurateValue,
    totalValue,
    perDayValue
  });

  // --- 9️⃣ Lưu và render lại UI
  expandedAllocatedRecords[recordIndex] = { ...record, allocations };
  updateAllocationTableUI(id);
}

async function saveAllocatedRecords() {
  try {
    if (!allocatedRecords || !allocatedRecords.length) return;

    // ✅ đóng modal
    const modal = bootstrap.Modal.getInstance(document.getElementById("allocationModal"));
    if (modal) modal.hide();

    // --- 🔹 Cập nhật lại allocationOverrides cho từng record trước khi lưu ---
    if (Array.isArray(expandedAllocatedRecords) && expandedAllocatedRecords.length) {
      expandedAllocatedRecords.forEach(expanded => {
        const matched = allocatedRecords.find(r => String(r.id) === String(expanded.id));
        if (!matched) return;

        // build allocationOverrides mới từ các tháng có acceptanceDate hoặc invoiceValue
        const newOverrides = [];
        expanded.allocations.forEach((alloc, idx) => {
          if (alloc.acceptanceDate || alloc.invoiceValue) {
            newOverrides.push({
              index: idx,
              acceptanceDate: alloc.acceptanceDate || "",
              invoiceValue: Number(alloc.invoiceValue || 0)
            });
          }
        });

        matched.allocationOverrides = newOverrides;
      });
    }

    // --- 🔹 Sync allocatedRecords -> allocatedItems (Section 3 source) ---
    if (Array.isArray(allocatedRecords) && allocatedRecords.length) {
      const recMap = {};
      allocatedRecords.forEach(rec => {
        const pid = rec.id ?? null;
        const pname = (rec.name ?? "").toString().trim();
        const firstAlloc = Array.isArray(rec.allocations) && rec.allocations[0] ? rec.allocations[0] : null;
        const actual = formatDateToDDMMYYYY(firstAlloc?.actualDate) ?? null;

        recMap[String(pid ?? pname)] = {
          id: pid,
          name: pname,
          startActual: actual,
          actualDate: actual
        };
      });

      if (!Array.isArray(allocatedItems)) allocatedItems = [];
      const updated = [];

      allocatedItems.forEach(ai => {
        const keyId = String(ai.id ?? "");
        const keyName = (ai.name ?? "").toString().trim();
        const matched = recMap[keyId] || recMap[keyName] || null;
        if (matched) {
          ai.actualDate = matched.actualDate;
        }
        updated.push(ai);
      });

      Object.keys(recMap).forEach(k => {
        const m = recMap[k];
        const exists = updated.some(
          u =>
            String(u.id ?? "") === String(m.id ?? "") ||
            ((u.name ?? "").toString().trim() === (m.name ?? "").toString().trim())
        );
        if (!exists) {
          updated.push({
            id: m.id ?? null,
            name: m.name ?? "",
            actualDate: m.actualDate ?? null,
            forecastDate: m.forecastDate ?? null
          });
        }
      });

      // replace allocatedItems with updated array
      allocatedItems.length = 0;
      updated.forEach(u => allocatedItems.push(u));
    }

    // --- 🔹 Gửi lên API ---
    const body = {
      custom_field: {
        cf__allocated_records: JSON.stringify(allocatedRecords),
        cf__allocated_products: JSON.stringify(allocatedItems)
      }
    };

    await updateRevenueRecord(body);
    renderProductAllocation();
  } catch (err) {
    console.error("❌ Lưu phân bổ thất bại:", err);
  }
}