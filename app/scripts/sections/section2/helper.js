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

function pushToQuote(idx) {
  const product = window.products[idx]
  if (!product) return;

    // --- Currency Check ---
  if (listItems.length > 0) {
    const firstCurrency = listItems[0].currency;
    const currentCurrency = product.currencySymbol || "đ";
 
    if (firstCurrency !== currentCurrency) {
      const message = (lang === "vi")
        ? `⚠ Sản phẩm không phù hợp với giỏ hàng hiện tại do khác loại tiền tệ!`
        : `⚠ Product cannot be added due to mismatched currency!`;
 
      showAlert(message, "warning");
      return; // stop and do not push
    }
  }

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

  let adjustedPrice = product.price ?? 0;
  if (product.package && packageType) {
    if (product.package === "year" && packageType === "month") adjustedPrice /= 12;
    else if (product.package === "month" && packageType === "year") adjustedPrice *= 12;
  }
  const isQuantityBased = product.isQuantityBased;
  const maxDiscount = product.maxDiscount || 0;
  const currentCurrency = product.currencySymbol || "đ";
  const baseTotal = adjustedPrice * (isQuantityBased ? quantitative : 1) * duration;

  listItems.push({
    id: product.id,
    name: product.name,
    category: product.category,
    license: licenseInput?.value || "",
    quantitative,
    min: product.min ?? 1,
    max: product.max ?? null,
    unit: product.unit,
    package: packageType,
    priceType: product.priceType,
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
  quantitativeInput.value = product.min || 1;
  if (packageInput) packageInput.value = "";
  if (durationInput) durationInput.value = 1;
  if (subtypeInput) subtypeInput.value = "";

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