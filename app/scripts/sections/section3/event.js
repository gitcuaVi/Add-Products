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