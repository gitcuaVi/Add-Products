// ============= HELPER =============
function toggleTag() {
  if (!Array.isArray(tag)) tag = [];
 
  let hasPending = false;
  let hasSuccess = false;
 
  tag = tag.map(t => {
    const lower = t.toLowerCase();
 
    if (lower === "revenue pending") {
      hasPending = true;
      return "Revenue Success"; // đổi pending → success
    }
 
    if (lower === "revenue success") {
      hasSuccess = true;
      return t; // giữ nguyên, KHÔNG đổi
    }
 
    return t; // giữ nguyên tag khác
  });
 
  // nếu không có pending và không có success → thêm pending
  if (!hasPending && !hasSuccess) {
    tag.push("Revenue Pending");
  }
}
 

function ensureNormalLayout() {
  const header = document.querySelector(".products-header");
  if (header) header.style.display = "flex";

  const container = document.getElementById("product-list");
  if (container) {
    container.style.display = "block";
    container.style.flexDirection = "";
    container.style.justifyContent = "";
    container.style.alignItems = "";
    container.style.height = "";
  }
}

function ensureEditButtonState() {
  const btnEdit = document.getElementById("btn-edit-products");
  if (!btnEdit) return;

  if (lockRevenue) {
    btnEdit.disabled = true;
  } else {
    btnEdit.disabled = false;
    btnEdit.title = "";
  }
}

function toggleEditButton(state) {
  const btnEdit = document.getElementById("btn-edit-products");
  const btnSave = document.getElementById("btn-save-section1");
  const btnCancel = document.getElementById("btn-cancel-section1");
  if (!btnEdit) return;

  if (state === "view") {
    btnEdit.className = "btn btn-success";
    btnEdit.textContent = (lang === "vi") ? "Chỉnh sửa" : "Edit";
    btnEdit.disabled = false;
  } else if (state === "editing") {
    btnEdit.className = "btn btn-warning";
    btnEdit.textContent = (lang === "vi") ? "Đang chỉnh sửa..." : "Editing...";
    btnSave.textContent = (lang === "vi") ? "Lưu" : "Save";
    btnCancel.textContent = (lang === "vi") ? "Hủy" : "Cancel";
    btnEdit.disabled = true; // khóa click khi đang edit
  }
}

function enterSection1EditMode() {
  if (!Array.isArray(listItems) || listItems.length === 0) return;
  section1EditMode = true;

  // clone sâu để không làm thay đổi listItems gốc khi đang edit
  editDrafts = listItems.map(it => ({ ...it }));

  // bật nút Save / Cancel
  const btnSave = document.getElementById("btn-save-section1");
  const btnCancel = document.getElementById("btn-cancel-section1");
  if (btnSave) btnSave.style.display = "inline-block";
  if (btnCancel) btnCancel.style.display = "inline-block";

  renderProductList(); // render lại UI ở chế độ edit
}

async function exitSection1EditMode(save = false) {
  try {
    if (save && Array.isArray(editDrafts)) {
      // ✅ cập nhật lại listItems từ editDrafts
      listItems = editDrafts.map(d => {
        const { baseTotal, finalTotal } = computeDraftTotals(d);
        return {
          ...d,
          allocationValue: finalTotal,
          allocationDuration: d.package === "year" ? Number(d.duration) * 12 : (d.package === "month" ? Number(d.duration) : 1),
          basePrice: Number(d.basePrice) || 0,
          quantitative: Number(d.quantitative) || 1,
          duration: Number(d.duration) || 1,
          baseTotal,
          finalTotal
        };
      });

      // ✅ tính lại tổng mới
      const originalTotal = listItems.reduce(
        (sum, it) => sum + (Number(it.finalTotal) || 0),
        0
      );

      const afterTotal = Math.max(
        0,
        globalDiscount.type === "percent"
          ? originalTotal * (1 - (Number(globalDiscount.value) || 0) / 100)
          : originalTotal - (Number(globalDiscount.value) || 0)
      );

      // ✅ lưu lên deal
      await updateDeal(afterTotal);

      const notice = document.getElementById("update-notice");
      if (notice) {
        notice.textContent = "⚠ Bạn cần bấm 'Update Product' để lưu thay đổi vào deal.";
        notice.style.display = "block";
      }
    }

  } catch (err) {
    console.error("❌ exitSection1EditMode failed:", err);
  } finally {
    // ✅ reset edit mode state
    section1EditMode = false;
    editDrafts = [];

    // ẩn nút Save/Cancel
    const btnSave = document.getElementById("btn-save-section1");
    const btnCancel = document.getElementById("btn-cancel-section1");
    if (btnSave) btnSave.style.display = "none";
    if (btnCancel) btnCancel.style.display = "none";

    toggleEditButton("view");
    renderProductList();
  }
}

function onEditDraftChange(idx, field, rawValue, isFinal = false) {
  if (!editDrafts[idx]) return;

  const numeric = ["basePrice", "quantitative", "duration", "discount", "vat"];
  if (numeric.includes(field)) {
    const cleaned = String(rawValue).replace(/,/g, "");
    let num = Number(cleaned);

    if (field === "quantitative") {
      const min = Number(editDrafts[idx].min) || 1;
      const max = editDrafts[idx].max === null ? Infinity : Number(editDrafts[idx].max);

      if (isFinal) {
        // Khi blur → ép về min/max
        if (num < min) num = min;
        if (num > max) num = max;
        editDrafts[idx][field] = isNaN(num) ? 0 : num;

        const inputEl = document.getElementById(`edit-${field}-${idx}`);
        if (inputEl) inputEl.value = editDrafts[idx][field];
      } else {
        // Khi đang nhập → chỉ recalc nếu trong range
        editDrafts[idx][field] = isNaN(num) ? 0 : num;
        if (num < min || num > max) {
          return; // ngoài range → không recalc
        }
      }
    } else if (field === "duration") {
      if (num < 1) num = 1;
      if (editDrafts[idx].package === "month" && num > 12) {
        num = 12;
      }
      editDrafts[idx][field] = isNaN(num) ? null : num;

      const inputEl = document.getElementById(`edit-${field}-${idx}`);
      if (inputEl) inputEl.value = editDrafts[idx][field];
    } else if (field === "basePrice") {
      if (num < 0) num = 0;
      editDrafts[idx][field] = isNaN(num) ? 0 : num;

      const inputEl = document.getElementById(`edit-${field}-${idx}`);
      if (inputEl) inputEl.value = editDrafts[idx][field].toLocaleString('en-US');
    } else if (field === "vat") {
      if (num < 0) num = 0;
      editDrafts[idx][field] = isNaN(num) ? 0 : num;

      const inputEl = document.getElementById(`edit-${field}-${idx}`);
      if (inputEl) inputEl.value = editDrafts[idx][field].toLocaleString('en-US');
    } else {
      editDrafts[idx][field] = isNaN(num) ? 0 : num;

      const inputEl = document.getElementById(`edit-${field}-${idx}`);
      if (inputEl) inputEl.value = editDrafts[idx][field];
    }
  } else {
    editDrafts[idx][field] = rawValue;
  }

  // recalc amount
  const { baseTotal, finalTotal } = computeDraftTotals(editDrafts[idx]);
  const amountEl = document.getElementById(`edit-amount-${idx}`);
  if (amountEl) {
    amountEl.value = formatCurrency(finalTotal, editDrafts[idx].currency);
  }

  // --- validate discount giống Section 2 ---
  if (field === "discount" || field === "discountType") {
    const discountInputEl = document.getElementById(`edit-discount-${idx}`);

    if (discountInputEl) {
      // reset style
      discountInputEl.style.border = "1px solid #ccc";
      discountInputEl.style.backgroundColor = "#fff";

      // Convert discount về number
      let discValue = Number(editDrafts[idx].discount) || 0;

      // --- nếu percent > 100 thì ép về 100 ---
      if (editDrafts[idx].discountType === "percent" && discValue > 100) {
        discValue = 100;
        editDrafts[idx].discount = discValue;
        discountInputEl.value = discValue;
      }

      // check maxDiscount
      let isExceed = false;
      if (maxDisc <= 0) return;
      const maxDisc = Number(editDrafts[idx].maxDiscount) || 0;

      if (editDrafts[idx].discountType === "percent") {
        if (discValue > maxDisc) isExceed = true;
      } else { // amount
        const ratio = baseTotal ? (discValue / baseTotal) * 100 : 0;
        if (ratio > maxDisc) isExceed = true;
      }

      if (isExceed) {
        discountInputEl.style.border = "2px solid red";
        discountInputEl.style.backgroundColor = "#ffe5e5";

        const message = (lang === "vi")
          ? `⚠ Giảm giá vượt quá mức cho phép (tối đa ${maxDisc}%)`
          : `⚠ Discount exceeds the allowed limit (max ${maxDisc}%)`;

        const bodyEl = document.getElementById("discountWarningBody");
        if (bodyEl) bodyEl.textContent = message;

        const labelEl = document.getElementById("discountWarningLabel");
        if (labelEl) {
          labelEl.textContent = (lang === "vi") ? "⚠ Cảnh báo giảm giá" : "⚠ Discount Warning";
        }

        // show modal
        const discountModalEl = document.getElementById("discountWarningModal");
        const myModal = bootstrap.Modal.getInstance(discountModalEl) || new bootstrap.Modal(discountModalEl);
        myModal.show();

        // Khi modal đóng → restore focus để edit tiếp
        discountModalEl.addEventListener('hidden.bs.modal', () => {
          const inputEl = document.getElementById(`edit-discount-${idx}`);
          if (inputEl) inputEl.focus();
        }, { once: true });
      }
    }
  }

  // recalc subtotal + total
  const subtotal = editDrafts.reduce((sum, d) => sum + computeDraftTotals(d).baseTotal, 0);
  const total = editDrafts.reduce((sum, d) => sum + computeDraftTotals(d).finalTotal, 0);

  // update Subtotal
  const subtotalEl = document.getElementById("edit-subtotal");
  if (subtotalEl) {
    subtotalEl.innerHTML = `Subtotal: ${formatCurrency(subtotal, editDrafts[0]?.currency || "đ")}`;
  }

  // update Total
  const totalEl = document.getElementById("edit-total");
  if (totalEl) {
    totalEl.innerHTML = `Total: ${formatCurrency(
      total - (globalDiscount.type === "percent"
        ? total * globalDiscount.value / 100
        : globalDiscount.value),
      editDrafts[0]?.currency || "đ"
    )}`;
  }
}

function removeDraftProduct(idx) {
  if (!editDrafts[idx]) return;
  // Lưu lại sản phẩm bị xóa
  const removed = editDrafts[idx];
  editDrafts.splice(idx, 1);

  // --- 1️⃣ Xóa khỏi allocatedItems ---
  if (removed.id && Array.isArray(allocatedItems)) {
    const indexInAllocated = allocatedItems.findIndex(
      a => a.productId === removed.id || a.id === removed.id
    );
    if (indexInAllocated !== -1) {
      allocatedItems.splice(indexInAllocated, 1);
    }
  }

  // --- 2️⃣ Xóa khỏi allocatedRecords ---
  if (removed.id && Array.isArray(allocatedRecords)) {
    // Có thể productId trong record là string hoặc UUID, nên nên convert về string để so sánh an toàn
    const indexInRecords = allocatedRecords.findIndex(
      r => String(r.id) === String(removed.id)
    );
    if (indexInRecords !== -1) {
      allocatedRecords.splice(indexInRecords, 1);
    }
  }

  // --- 3️⃣ Render lại UI ---
  renderProductList();
}

function ensureSection1EditButton() {
  const btnOpen = document.getElementById("btn-open-modal");
  if (!btnOpen) return;

  let btnEdit = document.getElementById("btn-edit-products");
  if (!btnEdit) {
    btnEdit = document.createElement("button");
    btnEdit.id = "btn-edit-products";
    btnEdit.className = "btn btn-outline-secondary ms-2";
    btnEdit.style.marginLeft = "8px";
    btnOpen.insertAdjacentElement("afterend", btnEdit);
  }

  btnEdit.textContent = (lang === "vi") ? "Chỉnh sửa" : "Edit";
  btnEdit.onclick = () => {
    if (lockRevenue) {
      btnEdit.disabled = true;
      btnEdit.title = (lang === "vi")
        ? "Đã phân bổ doanh thu, không thể chỉnh sửa"
        : "Revenue already allocated, editing is disabled";
      return;
    }
    if (!section1EditMode) {
      enterSection1EditMode();
      toggleEditButton("editing");
      renderProductList();
    }
  };
}

function updateGlobalTotal() {
  const total = editDrafts.reduce((sum, d) => sum + computeDraftTotals(d).finalTotal, 0);
  const totalEl = document.querySelector("#product-list div[style*='font-weight:700']");
  if (totalEl) {
    totalEl.innerHTML = `Total: ${formatCurrency(
      total - (globalDiscount.type === "percent"
        ? total * globalDiscount.value / 100
        : globalDiscount.value),
      editDrafts[0]?.currency || "đ"
    )}`;
  }
}