// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  client = await app.initialized();
  console.log("✅ App initialized!");

await loadMarket();
  await loadTerritory();
  await getLoggedInUserData();
 
  // 👉 Gắn sự kiện navbar & nút chuyển Section 2 (đặt ở cuối DOMContentLoaded)
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-target');
 
      // 🚫 Nếu đã phân bổ revenue thì không cho vào Section 2
      if (lockRevenue && targetId === "section-2") {
        showAlert(
          (lang === "vi")
            ? "⚠ Đã phân bổ doanh thu, không thể chỉnh sửa sản phẩm."
            : "⚠ Revenue already allocated, products cannot be edited.",
          "warning"
        );
        return;
      }
 
      // hide all sections
      document.querySelectorAll('section').forEach(s => s.style.display = 'none');
      document.getElementById(targetId).style.display = 'block';
 
      // remove active from all nav links
      document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
      // add active to current
      link.classList.add("active");
 
      // render content per section
      if (targetId === "section-1") renderProductList();
      if (targetId === "section-2") {
        const btnSaveSection2 = document.getElementById("btn-save-section2");
        if (btnSaveSection2) btnSaveSection2.style.display = "none";
      }
      if (targetId === "section-3") renderProductAllocation();
      if (targetId === "section-4") renderQuotationList();
      if (targetId === "section-5") renderQuotationTemplate();
    });
  });
 
  const reloadBtn = document.getElementById("reload-btn");
  if (reloadBtn) {
    const allowedRoles = [
      role.Admin,
      role.AccountAdmin,
      role.Manager
    ];
 
    if (allowedRoles.includes(loggedInUser.roleId)) reloadBtn.classList.remove("hidden");
 
    reloadBtn.addEventListener("click", async () => {
      await clearAllDbObjects();
      showAlert(
        (lang === "vi")
          ? "⚠ Reloading Data."
          : "⚠ Đang tải lại dữ liệu.",
        "warning"
      );
      await loadMarket();
      await loadTerritory();
      showAlert(
        (lang === "vi")
          ? "✅ Loaded Success."
          : "✅ Đã tải thành công.",
        "success"
      );
    });
  }

  const editModChanged = document.getElementById("section1EditModeChanged");
  if (editModChanged) {
    editModChanged.addEventListener(() => {
      const btnSave = document.getElementById("btn-save-section1");
      const btnCancel = document.getElementById("btn-save-section1");
      if (section1EditMode) {
        btnSave.remove();
        btnCancel.remove();
        editDrafts = listItems;
      }
    })
  }

  const btnGoSection2 = document.getElementById("btn-go-section-2");
  if (btnGoSection2) {
    btnGoSection2.addEventListener("click", () => {
      document.querySelector('[data-target="section-2"]').click();
    });
  }
  await renderSection1();

  const btnEdit = document.getElementById("btn-edit-products");
  if (btnEdit) {
    btnEdit.textContent = (lang === "vi") ? "Chỉnh sửa" : "Edit";
    btnEdit.addEventListener("click", () => {
      // 👉 Nếu đã có lockRevenue thì không cho edit
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
      }
    });
  }

  const btnSaveSection2 = document.getElementById("btn-save-section2");
  if (btnSaveSection2) {
    btnSaveSection2.addEventListener("click", async () => {
      // tính lại tổng
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

      // update deal
      await updateDeal(afterTotal);
      ensureSection1EditButton();

      // reset UI Section 2
      const marketEl = document.getElementById("market-select");
      if (marketEl) marketEl.selectedIndex = 0;
      resetProductFilters("category");
      const productTable = document.getElementById("product-table");
      if (productTable) {
        productTable.style.display = "none";
        productTable.innerHTML = "";
      }

      const filtersContainer = document.getElementById("filters-container");
      if (filtersContainer) filtersContainer.style.display = "none";

      const priceTable = document.getElementById("price-table");
      if (priceTable) {
        priceTable.style.display = "none";
        priceTable.innerHTML = "";
      }

      // render lại Section 1
      renderProductList();

      // chuyển tab sang Section 1
      document.querySelector('[data-target="section-1"]').click();
      document.getElementById("btn-edit-products").textContent = (lang === "vi") ? "Chỉnh sửa" : "Edit";

      // Ẩn Save khi lưu xong
      btnSaveSection2.style.display = "none";
      document.getElementById("btn-allocate").style.display = "block";
    });
  }

  const btnAllocate = document.getElementById("btn-allocate");
  if (btnAllocate) {
    btnAllocate.addEventListener("click", async () => {
      if (!closedDate && !expectedCloseDate) {
        showAlert(
          (lang === "vi")
            ? "⚠ Không thể phân bổ: Deal chưa có ngày dự kiến hoặc ngày đóng."
            : "⚠ Cannot allocate: Deal has no Expected Close Date or Closed Date.",
          "warning"
        );
        return;
      }

      const prevText = btnAllocate.textContent;
      btnAllocate.textContent = "Applying...";

      try {
        // 1. Chuẩn bị dữ liệu phân bổ
        const rows = document.querySelectorAll("#product-allocated tbody tr");
        const computedAllocated = Array.from(rows).map((row, idx) => {
          const p = listItems[idx];
          const name = row.querySelector("td:nth-child(1)")?.innerText.trim() || "";
          const valueText = row.querySelector("td:nth-child(2)")?.innerText.trim() || "0";
          const allocationValue = toNumber(valueText) || 0;
    
          const selType = document.getElementById(`alloc-type-${idx}`);
          const sel = document.getElementById(`alloc-count-${idx}`);
          const forecastDate = closedDate ? fmtDate(closedDate) : row.querySelector("td:nth-child(6)")?.innerText.trim();
          const actualDate = (() => {
            const val = row.querySelector("td:nth-child(7)")?.innerText.trim();
            return (val && val !== "--/--/--") ? val : "";
          })();
          const coefficient = row.querySelector("td:nth-child(5)")?.innerText.trim();
          const rawproductType = document.getElementById(`product-type-${idx}`)?.value || "";
          const productType = productTypeMap?.[rawproductType] || rawproductType;
          const spdvType = document.getElementById(`spdv-type-${idx}`)?.value || "";
          const region = document.getElementById(`region-${idx}`)?.value ?? currentTerritory;

          return {
            id: p.id,
            pid: p.pid,
            name,
            category: p.category,
            allocationValue: allocationValue,
            type: selType.value,
            allocationDuration: sel.value,
            coefficient,
            forecastDate,
            actualDate,
            currency: p?.currency || "đ",
            productType,
            spdvType,
            region: region ? region : market
          };
        });

        allocatedItems = computedAllocated;
        allocatedRecords = buildAllocatedRecords(allocatedItems, closedDate || expectedCloseDate, facDate);

        // 3. update deal để lưu
        const customField = {
          cf__allocated_products: JSON.stringify(allocatedItems),
          cf__allocated_records: JSON.stringify(allocatedRecords),
          cf__products: JSON.stringify(listItems)
        };

        toggleTag();

        await client.request.invokeTemplate("updateDeal", {
          context: { dealID: currentDealID },
          body: JSON.stringify({
            deal: {
              tags: tag,
              custom_field: customField
            }
          })
        });

        // 4. success
        renderProductAllocation();
        btnAllocate.style.opacity = 1;
        showAlert(
          (lang === "vi")
            ? "✅ Phân bổ doanh thu thành công."
            : "✅ Revenue allocation successful.",
          "success"
        );
      } catch (err) {
        console.error("❌ apply allocation failed:", err);
        btnAllocate.textContent = prevText || "Apply";
      }
    });
  }

  const btnViewAllocate = document.getElementById("btn-view-allocation");
  if (btnViewAllocate) {
    btnViewAllocate.addEventListener("click", () => {
      renderAllocationPreview();
      const modal = new bootstrap.Modal(document.getElementById("allocationModal"));
      modal.show();
    })
  }
});

async function getLoggedInUserData() {
  try {
    const data = await client.data.get("loggedInUser");
    const user = data.loggedInUser;
    loggedInUser = {
      id: user.id,
      name: user.display_name,
      email: user.email,
      roleId: user.role_id,
    };
  } catch (error) {
    console.error("❌ Lỗi get User: ", error);
  }
}