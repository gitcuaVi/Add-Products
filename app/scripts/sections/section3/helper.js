// ============= HELPER =============
function normalizeRenderItem(item) {
  return {
    id: item.id ?? null,
    name: item.name ?? "",
    package: item.package,
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

  // 1. Cập nhật data model
  const target = listItems?.[idx] || allocatedItems?.[idx];
  if (target) {
    target.coefficient = totalCoef + "%"; // lưu kèm dấu %
    target.productType = document.getElementById(`product-type-${idx}`)?.value || "";
    target.spdvType = document.getElementById(`spdv-type-${idx}`)?.value || "";
    if (lang === "vi") {
      target.region = document.getElementById(`region-${idx}`)?.value || "";
    }
  }

  // 2. Update cell ngoài bảng
  const coefCell = document.getElementById(`coef-cell-${idx}`);
  if (coefCell) coefCell.textContent = totalCoef + "%";

  // 3. Update input
  const totalCoefInput = document.getElementById(`total-coef-${idx}`);
  if (totalCoefInput) totalCoefInput.value = totalCoef + "%";

  // 4. Đóng modal nếu có
  const modalEl = document.getElementById(`hesoModal-${idx}`);
  if (modalEl) {
    const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modalInstance.hide();
  }

  // 5. Check lại tất cả coefficients
  setTimeout(() => checkAllocationCoefficients(), 100);
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
    const id = item.id;
    const pid = item.pid;
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
    const perMonthVcsValue = AllocValue;

    // clone date tránh mutate
    let currFC = start_FC_valid ? new Date(start_FC_valid) : null;
    let currAC = start_AC_valid ? new Date(start_AC_valid) : null;
    const anchorDayFC = currFC?.getDate();
    const anchorDayAC = currAC?.getDate();

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
      pid,
      name,
      category,
      territory,
      recurring: false,
      totalVcsValue: AllocValue * duration,
      totalValue: itemValue,
      count: duration,
      currency,
      period: periodicity || "month",
      forecastStart: fmtDate(start_FC_valid),
      actualStart: fmtDate(start_AC_valid),
      vcsValue: perMonthVcsValue,
      forecastValue: perMonthValue,
      actualValue: perMonthValue,
      allocationOverrides
    };

    // --- build expanded record (song song) ---
    const allocations = [];
    const periodType = item.type || "month";
    const origFC = start_FC_valid ? new Date(start_FC_valid) : null;
    const origAC = start_AC_valid ? new Date(start_AC_valid) : null;

    for (let i = 0; i < duration; i++) {
      const ov = allocationOverrides.find(o => o.index === i) || {};
      let fcDate = "", acDate = "";

      if (origFC && isValidDate(origFC)) {
        if (periodType === "month") {
          fcDate = addMonthsFromAnchor(origFC, i);
        } else if (periodType === "year") {
          fcDate = new Date(origFC.getFullYear() + i, origFC.getMonth(), origFC.getDate());
        }
      }

      if (origAC && isValidDate(origAC)) {
        if (periodType === "month") {
          acDate = addMonthsFromAnchor(origAC, i);
        } else if (periodType === "year") {
          acDate = new Date(origAC.getFullYear() + i, origAC.getMonth(), origAC.getDate());
        }
      }

      allocations.push({
        vcsValue: perMonthVcsValue,
        forecastDate: fcDate ? fmtDate(fcDate) : "",
        forecastValue: perMonthValue,
        actualDate: acDate ? fmtDate(acDate) : "",
        actualValue: perMonthValue,
        acceptanceDate: ov.acceptanceDate || "",
        invoiceValue: Number(ov.invoiceValue || 0)
      });
      if (currFC && isValidDate(currFC)) {
        if (periodType === "month") {
          currFC = addMonthsFromAnchor(currFC, anchorDayFC);
        } else if (periodType === "year") {
          currFC = new Date(currFC.getFullYear() + 1, currFC.getMonth(), anchorDayFC);
        }
      }
      if (currAC && isValidDate(currAC)) {
        if (periodType === "month") {
          currAC = addMonthsFromAnchor(currAC, anchorDayAC);
        } else if (periodType === "year") {
          currAC = new Date(currAC.getFullYear() + 1, currAC.getMonth(), anchorDayAC);
        }
      }
    }

    expandedAllocatedRecords.push({
      id,
      pid,
      name,
      totalVcsValue: AllocValue * duration,
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
