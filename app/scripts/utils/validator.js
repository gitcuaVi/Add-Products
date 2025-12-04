// validator.js - Các hàm validation
function commitAllocationCount(rawValue, maxValue) {
  let val = parseInt(rawValue, 10);
  if (isNaN(val) || val < 1) val = 1;
  maxValue = Number(maxValue) || 1;
  if (val > maxValue) val = maxValue;
  return val;
}

function validateSelections(idx) {
  const saveBtn = document.getElementById(`save-btn-${idx}`);
  const totalCoefInput = document.getElementById(`total-coef-${idx}`);
  const totalCoef = calculateTotalCoefficient(idx);

  if (totalCoef !== null) {
    if (totalCoefInput) totalCoefInput.value = totalCoef + "%";
    if (saveBtn) saveBtn.removeAttribute("disabled");
  } else {
    if (totalCoefInput) totalCoefInput.value = "";
    if (saveBtn) saveBtn.setAttribute("disabled", true);
  }
}

function checkAllocationCoefficients() {
  const btnAllocate = document.getElementById("btn-allocate");
  if (!btnAllocate) return;

  if (lockRevenue) {
    btnAllocate.disabled = true;
    btnAllocate.style.opacity = 0.5;
    return;
  }

  const rows = document.querySelectorAll("#product-allocated tbody tr");
  if (!rows.length) {
    btnAllocate.disabled = true;
    btnAllocate.style.opacity = 0.5;
    return;
  }

  const allValid = Array.from(rows).every((row, idx) => {
    const coefCell = row.querySelector(`#coef-cell-${idx}`) || row.querySelector("td:nth-child(4)");
    const txt = coefCell ? coefCell.textContent.trim() : "";
    return txt !== "";
  });

  btnAllocate.disabled = !allValid;
  btnAllocate.style.opacity = allValid ? 1 : 0.5;
}