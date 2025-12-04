// calculator.js - Các hàm tính toán
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
  } else {
    const disc = Number(draft.discount) || 0;
    baseTotal = tmp - disc;
    finalTotal = tmp - disc;
  }
  if (finalTotal < 0) finalTotal = 0;
  return { baseTotal, finalTotal };
}

function recomputeBaseTotal(item) {
  const price = Number(item.basePrice) || 0;
  const qty = Number(item.quantity) || 0;
  const duration = Number(item.duration) || 1;
  const isQuantityBased = item.isQuantityBased;
  item.baseTotal = isQuantityBased ? price * qty * duration : price * duration;
}

function calculateTotalCoefficient(idx) {
  let totalCoef = 1;

  // Product Type
  const typeEl = document.getElementById(`product-type-${idx}`);
  const typeVal = typeEl ? typeEl.value : "";
  const typeCfg = heSoMap.opportunity[typeVal];
  if (typeCfg === "SI") {
    const siInput = document.getElementById(`product-type-value-${idx}`);
    const siNum = parseFloat(siInput?.value);
    if (!isNaN(siNum)) totalCoef *= siNum / 100;
    else return null;
  } else if (typeof typeCfg === "number") {
    totalCoef *= typeCfg / 100;
  } else {
    return null;
  }

  // SPDV
  const spdvEl = document.getElementById(`spdv-type-${idx}`);
  const spdvVal = spdvEl ? spdvEl.value : "";
  const spdvCfg = heSoMap.spdv[spdvVal];
  if (typeof spdvCfg === "number") {
    totalCoef *= spdvCfg / 100;
  } else {
    return null;
  }

  // Region
  const regionEl = document.getElementById(`region-${idx}`);
  if (regionEl) {
    const regionVal = regionEl.value;
    const regionCfg = heSoMap.region[regionVal];
    if (typeof regionCfg === "number") {
      totalCoef *= regionCfg / 100;
    } else {
      return null;
    }
  }

  return Number((totalCoef * 100).toFixed(2));
}

function getTemp(p) {
  if (!p) return 0;
  const allocationValue = p.allocationValue;
  if (allocationValue <= 0) return 0;
  
  const subtotal = listItems.reduce((sum, it) => sum + (Number(it.allocationValue) || 0), 0);
  if (subtotal <= 0) return allocationValue;

  let finalTotal = allocationValue;
  if (globalDiscount.type === "percent") {
    finalTotal = allocationValue * (1 - (Number(globalDiscount.value) || 0) / 100);
  } else {
    const ratio = allocationValue / subtotal;
    const share = ratio * (Number(globalDiscount.value) || 0);
    finalTotal = allocationValue - share;
  }

  return Math.max(0, finalTotal);
}