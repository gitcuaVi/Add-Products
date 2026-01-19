// validator.js - Các hàm validation
function commitAllocationCount(rawValue, maxValue) {
  let val = parseInt(rawValue, 10);
  if (isNaN(val) || val < 1) val = 1;
  maxValue = Number(maxValue) || 1;
  if (val > maxValue) val = maxValue;
  return val;
}

function validateSelections(idx) {
  const productType = document.getElementById(`product-type-${idx}`)?.value || "";
  const spdvType = document.getElementById(`spdv-type-${idx}`)?.value || "";
  const region = lang === "vi" ? (document.getElementById(`region-${idx}`)?.value || "") : "";

  const totalCoefInput = document.getElementById(`total-coef-${idx}`);
  if (!totalCoefInput) return;

  // Kiểm tra xem tất cả các trường bắt buộc đã được chọn chưa
  let isValid = productType && spdvType;
  if (lang === "vi") {
    isValid = isValid && region;
  }

  if (!isValid) {
    totalCoefInput.value = "";
    return false;
  }

  return true;
}

function checkAllocationCoefficients() {
  const btnAllocate = document.getElementById("btn-allocate");
  if (!btnAllocate || lockRevenue) return;

  const rows = document.querySelectorAll("#product-allocated tbody tr");
  let allValid = rows.length > 0;

  rows.forEach((row, idx) => {
    const totalCoefInput = document.getElementById(`total-coef-${idx}`);
    const coefValue = totalCoefInput?.value?.trim() || "";
    
    // Kiểm tra xem có giá trị hợp lệ không
    if (!coefValue || coefValue === "" || coefValue === "%" || parseFloat(coefValue) === 0) {
      allValid = false;
    }
  });

  if (allValid) {
    btnAllocate.disabled = false;
    btnAllocate.style.opacity = 1;
    btnAllocate.style.pointerEvents = "auto";
  } else {
    btnAllocate.disabled = true;
    btnAllocate.style.opacity = 0.5;
    btnAllocate.style.pointerEvents = "none";
  }
}