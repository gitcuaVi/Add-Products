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

function handleKey(e, productId, occ, index) {
  if (e.key !== "Enter") return;

  const record = getExpandedRecord(productId, occ);
  if (!record) return;

  const alloc = record.allocations[index];
  if (!alloc) return;

  const key = `${productId}-${occ}`;

  const invoiceInput =
    document.getElementById(`invoice-input-${key}-${index}`);
  const acceptanceInput =
    document.getElementById(`acceptance-input-${key}-${index}`);

  const invoiceValue = invoiceInput
    ? Number(invoiceInput.value || 0)
    : Number(alloc.invoiceValue || 0);

  const acceptanceDate = acceptanceInput
    ? acceptanceInput.value.trim()
    : (alloc.acceptanceDate
        ? alloc.acceptanceDate.split("/").reverse().join("-")
        : "");

  const hasInvoice = invoiceValue > 0;
  const hasAcceptance = acceptanceDate && acceptanceDate !== "--/--/--";

  if (!hasInvoice || !hasAcceptance) {
    if (!hasInvoice) flashCell(`invoice-cell-${key}-${index}`);
    if (!hasAcceptance) flashCell(`acceptance-cell-${key}-${index}`);
    return;
  }

  handleChange(productId, occ, index, invoiceValue, acceptanceDate);
}

function enableInvoiceEdit(productId, occ, index) {
  const rec = getExpandedRecord(productId, occ);
  if (!rec) return;

  const key = `${productId}-${occ}`;
  const cell = document.getElementById(`invoice-cell-${key}-${index}`);

  cell.innerHTML = `
    <input type="number"
      onkeydown="if(event.key==='Enter'){commitInvoiceValue('${productId}',${occ},${index},this.value)}">
  `;
}

function enableAcceptanceEdit(productId, occ, index) {
  const key = `${productId}-${occ}`;
  const cell = document.getElementById(`acceptance-cell-${key}-${index}`);

  cell.innerHTML = `
    <input type="date"
      onkeydown="if(event.key==='Enter'){commitAcceptanceValue('${productId}',${occ},${index},this.value)}">
  `;
}

function enableFacEdit(productId, occ) {
  const rec = getExpandedRecord(productId, occ);
  if (!rec) return;

  const key = `${productId}-${occ}`;
  const span = document.getElementById(`fac-header-${key}`);
  if (!span) return;

  const current = rec.startActual || "";
  const isoVal = current
    ? current.split("/").reverse().join("-")
    : "";

  span.innerHTML = `
    <input type="date" id="fac-input-${key}" value="${isoVal}">
    <button onclick="saveFacEdit('${productId}',${occ},
      document.getElementById('fac-input-${key}').value)">Save</button>
    <button onclick="cancelFacEdit('${productId}',${occ})">Cancel</button>
  `;
}

function saveFacEdit(productId, occ, iso) {
  const rec = getExpandedRecord(productId, occ);
  if (!rec || !iso) return;

  const formatted = iso.split("-").reverse().join("/");
  rec.startActual = formatted;

  rec.allocations.forEach(a => (a.actualDate = formatted));

  renderAllocationPreview();
}

function cancelFacEdit(productId, occ) {
  const rec = getExpandedRecord(productId, occ);
  if (!rec) return;

  const key = `${productId}-${occ}`;
  const span = document.getElementById(`fac-header-${key}`);
  if (!span) return;

  const val =
    rec.startActual ||
    rec.allocations?.[0]?.actualDate ||
    "--/--/--";

  span.innerHTML = `
    ${val}
    <button onclick="enableFacEdit('${productId}',${occ})">✎</button>
  `;
}

function commitInvoiceValue(productId, occ, index, value) {
  const rec = getExpandedRecord(productId, occ);
  if (!rec) return;

  rec.allocations[index].invoiceValue = Number(value) || 0;
  renderAllocationPreview();
}

function commitAcceptanceValue(productId, occ, index, iso) {
  const rec = getExpandedRecord(productId, occ);
  if (!rec) return;

  rec.allocations[index].acceptanceDate =
    iso.split("-").reverse().join("/");

  renderAllocationPreview();
}

//chua thay dung
function disableInvoiceEdit(productId, occ, index) {
  const rec = getExpandedRecord(productId, occ);
  if (!rec) return;

  const key = `${productId}-${occ}`;
  const cell = document.getElementById(`invoice-cell-${key}-${index}`);
  if (!cell) return;

  const a = rec.allocations[index];
  cell.innerHTML = `
    <span>${a.invoiceValue
      ? formatCurrency(a.invoiceValue, rec.currency)
      : "0"}</span>
    <button onclick="enableInvoiceEdit('${productId}',${occ},${index})">✎</button>
  `;
}
//chua thay dung
function disableAcceptanceEdit(productId, occ, index) {
  const rec = getExpandedRecord(productId, occ);
  if (!rec) return;

  const key = `${productId}-${occ}`;
  const cell = document.getElementById(`acceptance-cell-${key}-${index}`);
  if (!cell) return;

  const a = rec.allocations[index];
  cell.innerHTML = `
    <span>${a.acceptanceDate || "--/--/--"}</span>
    <button onclick="enableAcceptanceEdit('${productId}',${occ},${index})">✎</button>
  `;
}

function handleChange(productId, occ, index, invoiceValue, acceptanceDateInput) {
  const record = getExpandedRecord(productId, occ);
  if (!record) return;

  const allocations = record.allocations.map(a => ({ ...a }));
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
  record.allocations = allocations;
  updateAllocationTableUI(productId, occ);
}
//chua thay dung
async function saveAllocatedRecords() {
  try {
    if (!Array.isArray(allocatedRecords) || !allocatedRecords.length) return;

    // Đóng modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("allocationModal")
    );
    if (modal) modal.hide();

    // 1️⃣ Sync từ expanded → allocatedRecords
    allocatedRecords.forEach(rec => {
      const expanded = getExpandedRecord(rec.id, rec.__occ);
      if (!expanded) return;

      rec.actualStart =
        expanded.startActual ||
        expanded.allocations?.[0]?.actualDate ||
        "";
    });

    // 2️⃣ Sync từ allocatedRecords → allocatedItems
    allocatedItems.forEach(item => {
      const rec = allocatedRecords.find(
        r =>
          String(r.id) === String(item.id) &&
          r.__occ === item.__occ
      );

      if (!rec) return;

      // ✅ update đúng cái user đã edit
      item.actualDate = rec.actualStart || "";
    });

    // 3️⃣ Remove __occ trước khi gửi backend
    const cleanAllocatedRecords = stripOcc(allocatedRecords);
    const cleanAllocatedItems = stripOcc(allocatedItems);

    // 4️⃣ Gửi API
    await updateRevenueRecord({
      custom_field: {
        cf__allocated_records: JSON.stringify(cleanAllocatedRecords),
        cf__allocated_products: JSON.stringify(cleanAllocatedItems)
      }
    });

    renderProductAllocation();
  } catch (err) {
    console.error("❌ Lưu phân bổ thất bại:", err);
  }
}