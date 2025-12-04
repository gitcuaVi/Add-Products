let client;
let cachedTerritories = [];
let cachedMarkets = [];
let cachedCatalogs = [];
let cachedPricebook = [];
let editDrafts = []; // bản nháp khi edit
let section1EditMode = false;
let selectedMarketId = null;
let currentProduct = null;
let currentDealID;
let currentCompanyID;
let contractID;
let expectedCloseDate;
let closedDate;
let facDate;
let lockRevenue = false;
let periodicity;
let market;
let lang;
let tag;
const quoteItems = [];
let listItems = [];
let allocatedItems = [];
let allocatedRecords = [];
const expandedAllocatedRecords = [];
const products = [];
const globalDiscount = { value: 0, type: "percent" };
const heSoMap = {
  opportunity: {
    "Lần đầu": 125, "New": 125,
    "Sự cố": 30, "Incident": 30,
    "Gia hạn": 50, "Renewal": 50,
    "Gia hạn_GOV": 50, "Renewal_GOV": 50,
    "Bán thêm": 100, "Upsale": 100,
    "Độc lập": 30, "Dependent": 30,
    "Phụ thuộc": 0, "Independent": 0,
    "SI": "SI"
  },
  spdv: {
    "Standalone": 150,
    "Service": 100
  },
  region: {
    "Miền Nam": 135,
    "Miền Bắc": 100
  }
};
const productTypeMap = {
  "New": "New",
  "Lần đầu": "New",
  "Renewal": "Renewal",
  "Gia hạn": "Renewal",
  "Renewal_GOV": "Renewal_GOV",
  "Gia hạn_GOV": "Renewal_GOV",
  "Incident": "Incident",
  "Sự cố": "Incident",
  "Upsale": "Upsale",
  "Bán thêm": "Upsale",
  "Independent": "Independent",
  "Độc lập": "Independent",
  "Dependent": "Dependent",
  "Phụ thuộc": "Dependent",
  "SI": "SI"
};

function toNumber(text) {
  if (!text) return 0;
 
  const cleaned = text
    .toString()
    .replace(/\s+/g, "")        // xóa mọi khoảng trắng (space, nbsp)
    .replace(/[^\d.,-]/g, "")   // giữ lại số, ., ,
    .replace(/\./g, "")         // xóa dấu chấm ngăn nghìn
    .replace(/,/g, "")          // xóa dấu phẩy ngăn nghìn
    .trim();
 
  return Number(cleaned) || 0;
}


// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  client = await app.initialized();
  console.log("✅ App initialized!");

  // Load Market sau khi init
  //await clearAllDbObjects();
  await loadMarket();
  await loadTerritory();

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
          const region = document.getElementById(`region-${idx}`)?.value || "";

          return {
            id: p.id,
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

// ================= SECTION 1 =================
// ============= DATA =============
async function loadProductsFromDeal() {
  try {
    const { deal } = await client.data.get("deal");
    currentDealID = deal?.id;
    currentCompanyID = deal?.sales_account_id;
    lockRevenue = deal?.custom_field?.cf_lock_revenue || false;
    periodicity = deal?.customField?.cf_periodicity || null;
    closedDate = deal?.closed_date ? new Date(deal.closed_date) : null;
    expectedCloseDate = deal?.expected_close ? new Date(deal?.expected_close) : null;
    facDate = deal?.custom_field?.cf__fac_date ? new Date(deal?.custom_field?.cf__fac_date) : null;
    tag = deal?.plain_tags;
    const btn = document.getElementById("btn-allocate");
    if (btn) {
      if (lockRevenue) {
        // Đã khóa revenue -> disable nút
        btn.disabled = true;
        btn.style.opacity = 0.5;
        btn.textContent = (lang === "vi") ? "Đã áp dụng" : "Applied";
      } else {
        // Chưa khóa revenue -> mở nút
        btn.disabled = false;
        btn.style.opacity = 1;
        btn.textContent = (lang === "vi") ? "Áp dụng" : "Apply";
      }
    }

    const oldGlobalDiscount = deal?.custom_field?.cf__global_discount || null;
    if (oldGlobalDiscount) {
      try {
        const parsed = JSON.parse(oldGlobalDiscount);
        if (parsed && typeof parsed === "object") {
          globalDiscount.value = parsed.value || 0;
          globalDiscount.type = parsed.type || "percent";
        }
      } catch (e) {
        console.error("❌ Parse globalDiscount failed:", e);
      }
    }

    const territoryId = deal?.territory_id || null;
    if (!territoryId) {
      lang = "en";
    } else {
      let territory = cachedTerritories.find(t => String(t.id) === String(territoryId));
      if (!territory) {
        try {
          const res = await client.request.invokeTemplate("getTerritory");
          const raw = res.response || res.body || res.respData?.response;
          const data = typeof raw === "string" ? JSON.parse(raw) : raw;
          const rawTerritories = Array.isArray(data.territories) ? data.territories : [];

          cachedTerritories = rawTerritories.map(t => ({
            id: String(t.id),
            name: t.name || ""
          }));

          if (cachedTerritories.length) {
            await client.db.set("territoryList", { value: cachedTerritories }).catch(err => console.error(err));
          }

          territory = cachedTerritories.find(t => String(t.id) === String(territoryId));
        } catch (err) {
          console.error("❌ Failed to fetch territory list:", err);
        }
      }

      if (territory && (territory.name === "Miền Nam" || territory.name === "Miền Bắc")) {
        lang = "vi";
      } else {
        lang = "en";
      }
    }

    contractID = deal?.custom_field.cf_contract || "";
    market = deal?.custom_field.cf_market || "";
    const oldProducts = deal?.custom_field?.cf__products || "[]";
    const oldAllocatedProducts = deal?.custom_field?.cf__allocated_products || "[]";
    const oldQuotations = deal?.custom_field?.cf__quotations || "[]";

    // reset mảng
    listItems.length = 0;
    allocatedItems.length = 0;
    quoteItems.length = 0;

    // parse listItems để Section 1
    try {
      const products = JSON.parse(oldProducts);
      if (Array.isArray(products)) {
        products.forEach(p => {
          listItems.push({
            id: p.id,
            name: p.name,
            category: p.category || "",
            license: p.license || "",
            quantitative: Number(p.quantitative) || 1,
            allocationValue: Number(p.allocationValue),
            allocationDuration: Number(p.allocationDuration) || 1,
            isQuantityBased: p.isQuantityBased,
            min: Number(p.min),
            max: p.max === null ? null : Number(p.max),
            maxDiscount: Number(p.maxDiscount) || 0,
            discount: Number(p.discount) || 0,
            discountType: p.discountType,
            priceType: p.priceType,
            currency: p.currency,
            unit: p.unit,
            duration: Number(p.duration) || 1,
            package: p.package,
            basePrice: Number(p.basePrice) || 0,
            baseTotal: Number(p.baseTotal) || 0,
            finalTotal: Number(p.finalTotal) || 0
          });
        });
      }
    } catch (err) {
      console.error("❌ Parse listItems failed:", err);
    }

    // parse allocatedItems để Section 3
    try {
      const allocated = JSON.parse(oldAllocatedProducts);
      if (Array.isArray(allocated)) {
        allocated.forEach(p => {
          allocatedItems.push({
            id: p.id,
            name: p.name,
            allocationValue: Number(p.allocationValue) || 0,
            allocationDuration: Number(p.allocationDuration) || 1,
            forecastDate: p.forecastDate || "",
            actualDate: p.actualDate || "",
            coefficient: p.coefficient,
            type: p.type || "one",
            productType: p.productType || "",
            spdvType: p.spdvType || "",
            region: p.region || "",
            currency: p.currency || "USD"
          });
        });
      }
    } catch (err) {
      console.error("❌ Parse allocatedItems failed:", err);
    }

    // Parse allocatedRecord để Section 3
    try {
      const rawAllocatedRecords = deal?.custom_field?.cf__allocated_records || "[]";
      let parsedRecords = [];
      try {
        parsedRecords = JSON.parse(rawAllocatedRecords);
      } catch {
        parsedRecords = [];
      }
      allocatedRecords.length = 0;
      expandedAllocatedRecords.length = 0;

      if (Array.isArray(parsedRecords) && parsedRecords.length) {
        parsedRecords.forEach(r => {
          const isValid = d => d instanceof Date && !isNaN(d);
          const fmt = d => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

          // === 🔹 Format mới (compact) ===
          if (parsedRecords.length > 0) {
            const forecastStart = r.forecastStart || r.startForecast;
            const actualStart = r.actualStart || r.startActual;
            const duration = Number(r.count) || 1;
            const forecastValue = Number(r.forecastValue) || 0;
            const actualValue = Number(r.actualValue) || 0;
            const overrides = Array.isArray(r.allocationOverrides) ? r.allocationOverrides : [];

            const allocations = [];
            let currFC = forecastStart ? new Date(forecastStart.split("/").reverse().join("-")) : null;
            let currAC = actualStart ? new Date(actualStart.split("/").reverse().join("-")) : null;

            for (let i = 0; i < duration; i++) {
              const ov = overrides.find(o => o.index === i) || {};
              allocations.push({
                forecastDate: currFC && isValid(currFC) ? fmt(currFC) : "",
                forecastValue,
                actualDate: currAC && isValid(currAC) ? fmt(currAC) : "",
                actualValue,
                acceptanceDate: ov.acceptanceDate || "",
                invoiceValue: Number(ov.invoiceValue || 0)
              });

              // advance +1 tháng
              if (currFC && isValid(currFC)) currFC = new Date(currFC.getFullYear(), currFC.getMonth() + 1, currFC.getDate());
              if (currAC && isValid(currAC)) currAC = new Date(currAC.getFullYear(), currAC.getMonth() + 1, currAC.getDate());
            }

            const expanded = {
              id: r.id,
              name: r.name,
              totalValue: Number(r.totalValue ?? 0),
              currency: r.currency || "đ",
              startForecast: r.forecastStart || r.startForecast,
              startActual: r.actualStart || r.startActual,
              allocations
            };

            allocatedRecords.push(r); // bản gốc (compact)
            expandedAllocatedRecords.push(expanded); // bản expanded để render
          }
        });
      } else {
        allocatedRecords.length = 0;
        expandedAllocatedRecords.length = 0;
      }
    } catch (err) {
      console.error("❌ Parse cf__allocated_records failed:", err);
      allocatedRecords.length = 0;
      expandedAllocatedRecords.length = 0;
    }

    // parse quoteItems để Section 4
    try {
      const quotations = JSON.parse(oldQuotations);
      if (Array.isArray(quotations)) {
        quotations.forEach(q => {
          quoteItems.push({
            quotation_id: q.quotation_id || "",
            created_at: q.created_at || "",
            status: q.status || "",
            tLang: q.tLang || "",
            currency: q.currency || "",
            global_discount: q.global_discount || 0,
            global_discountType: q.global_discountType || "",
            products: Array.isArray(q.products) ? q.products.map(p => ({
              name: p.name || "",
              basePrice: Number(p.basePrice) || 0,
              quantity: Number(p.quantity) || 0,
              unit: p.unit || "",
              duration: Number(p.duration) || 0,
              package: p.package || "",
              discount: p.discount || 0,
              discountType: p.discountType || "percent",
              baseTotal: Number(p.baseTotal) || 0,
              finalTotal: Number(p.finalTotal) || 0
            })) : []
          });
        });
      }
    } catch (err) {
      console.error("❌ Parse quoteItems failed:", err);
    }

    // push companyInfo để Section 5
    const info = {
      companyName: deal?.custom_field?.cf__company,
      companyAddress: deal?.custom_field?.cf__address,
      companyProvince: deal?.custom_field?.cf__province,
      companyCountry: deal?.custom_field?.cf__country,
      contactName: deal?.custom_field?.cf__contact,
      contactEmail: deal?.custom_field?.cf__email,
      contactPhone: deal?.custom_field?.cf__phone
    };
    setInfoData(info, lang);
    ensureNormalLayout();
    ensureEditButtonState();
    window.currentInfo = info;
    window.currentLang = lang;
    return true;
  } catch (err) {
    console.error("❌ Lỗi khi load product:", err);
    renderNoProductMessage();
    return false;
  }
}

async function loadTerritory() {
  try {
    const stored = await client.db.get("territoryList").catch(() => null);
    if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
      cachedTerritories = stored.value;  // ✅ gán vào biến global
      return cachedTerritories;
    }

    const res = await client.request.invokeTemplate("getTerritory");
    const raw = res.response || res.body || res.respData?.response;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const rawTerritories = Array.isArray(data.territories) ? data.territories : [];

    cachedTerritories = rawTerritories.map(t => ({
      id: String(t.id),
      name: t.name || ""
    }));

    if (cachedTerritories.length) {
      await client.db.set("territoryList", { value: cachedTerritories }).catch(err => console.error(err));
    }

    return cachedTerritories;
  } catch (err) {
    console.error("❌ loadTerritory error:", err);
    return [];
  }
}

// ============= RENDER =============
function renderNoProductMessage() {
  const header = document.querySelector(".products-header");
  if (header) header.style.display = "none";

  const container = document.getElementById("product-list");
  if (!container) return;

  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";
  container.style.minHeight = "80vh";
  container.innerHTML = `
    <div style="text-align:center; color:#555;">
      <img src="https://img.icons8.com/ios/100/box.png" alt="no product" style="opacity:0.5; margin-bottom:16px;">
      <p style="margin:8px 0;">${lang === "vi" ? "Hiện chưa có sản phẩm nào." : "There are no products yet."}</p>
    </div>
  `;

  const btnEmptyAdd = document.getElementById("btn-empty-add");
  if (btnEmptyAdd) {
    btnEmptyAdd.addEventListener("click", openProductModal);
  }
}

function renderProductList(targetId = "product-list") {
  const container = document.getElementById(targetId);
  if (!container) return;

  ensureNormalLayout();

  // 👉 Nếu không có sản phẩm → ẩn Edit, Total, show icon
  if (!listItems.length) {
    const btnEdit = document.getElementById("btn-edit-products");
    if (btnEdit) btnEdit.style.display = "none";

    container.innerHTML = `
      <div style="text-align:center; color:#555; padding:40px 0;">
        <img src="https://img.icons8.com/ios/100/box.png" alt="no product" style="opacity:0.5; margin-bottom:16px;">
        <p style="margin:8px 0;">${lang === "vi" ? "Hiện chưa có sản phẩm nào." : "There are no products yet."}</p>
      </div>
    `;
    return;
  }

  // 👉 Có sản phẩm → hiện Edit, render như cũ
  ensureSection1EditButton();
  const btnEdit = document.getElementById("btn-edit-products");
  if (btnEdit) btnEdit.style.display = "inline-block";

  // TEXT MODE
  if (!section1EditMode) {
    let total = 0;
    const html = listItems.map((item) => {
      const quantitative = Number(item.quantitative) || 1;
      const basePrice = Number(item.basePrice) || 0;
      const discount = Number(item.discount) || 0;
      const discountType = item.discountType;
      const pkg = item.package || "";
      const duration = Number(item.duration) || 1;
      const finalTotal = Number(item.finalTotal) || 0;
      total += finalTotal;

      let discountDisplay = "--";
      if (discount) {
        discountDisplay =
          discountType === "percent"
            ? `${discount}%`
            : formatCurrency(discount, item.currency);
      }

      return `
        <div class="product-card" style="border:1px solid #ddd; border-radius:6px; padding:12px; margin-bottom:12px; background:#fff;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:600; color:#1f6feb;">${item.name}</div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px;">
            <div><strong>${lang === "vi" ? "Đơn giá" : "Price"}</strong><div>${formatCurrency(basePrice, item.currency)}</div></div>
            <div><strong>${lang === "vi" ? "Số lượng" : "Quantity"}</strong><div>${quantitative} ${item.unit || ""}</div></div>
            <div><strong>${lang === "vi" ? "Thời hạn" : "Duration"}</strong>
              <div>
                ${item.package?.toLowerCase() === "perpetual"
          ? (lang === "vi" ? "Vĩnh viễn" : "Perpetual")
          : `${duration} ${pkg}`}
              </div>
            </div>
            <div><strong>${lang === "vi" ? "Giảm giá" : "Discount"}</strong><div>${discountDisplay}</div></div>
            <div><strong>${lang === "vi" ? "Thành tiền" : "Amount"}</strong><div>${formatCurrency(finalTotal, item.currency)}</div></div>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = html + `
      <div style="text-align:right; font-weight:600; margin-top:12px;">
        ${lang === "vi" ? "Tạm tính" : "Subtotal"}: ${formatCurrency(total, listItems[0]?.currency || "đ")}
      </div>
      <div style="text-align:right; margin-top:4px;">
        ${lang === "vi" ? "Giảm giá chung" : "Global Discount"}: ${globalDiscount.type === "percent"
        ? globalDiscount.value + " %"
        : formatCurrency(globalDiscount.value, listItems[0]?.currency || "đ")
      }
      </div>
      <div style="text-align:right; font-weight:700; margin-top:4px;">
        ${lang === "vi" ? "Tổng cộng" : "Total"}: ${formatCurrency(
        total - (globalDiscount.type === "percent" ? total * globalDiscount.value / 100 : globalDiscount.value),
        listItems[0]?.currency || "đ"
      )}
      </div>
    `;

    // 👉 clear Save/Cancel footer
    const footer = document.getElementById("edit-actions-footer");
    if (footer) footer.innerHTML = "";
    return;
  }

  // EDIT MODE
  if (!editDrafts) {
    editDrafts = listItems.map(it => ({ ...it }));
  }

  let total = 0;
  const html = editDrafts.map((d, idx) => {
    const isPerpetual = d.package === 'perpetual';
    const amt = computeDraftTotals(d).finalTotal;
    total += amt;
    const priceStr = Number(d.basePrice) ? Number(d.basePrice).toLocaleString('en-US') : "";
    const quantitativeStr = Number(d.quantitative) || 0;
    const durationStr = Number(d.duration) || 0;
    const discountStr = d.discount || 0;
    const discountType = d.discountType || "percent";

    return `
      <div class="product-card" style="border:1px solid #ddd; border-radius:6px; padding:12px; margin-bottom:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <input id="edit-name-${idx}" type="text"
            value="${escapeHtml(d.name)}"
            oninput="onEditDraftChange(${idx}, 'name', this.value)"
            style="flex:1; padding:6px; font-weight:600; color:#1f6feb; border:1px solid #ccc; border-radius:4px;">
            <button type="button"
              onclick="removeDraftProduct(${idx})"
              style="margin-left:8px; background:none; border:none; cursor:pointer; color:#dc3545;">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" 
                stroke-width="1.5" stroke="currentColor" style="width:20px; height:20px;">
                <path stroke-linecap="round" stroke-linejoin="round" 
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:12px;">
          <!-- Price -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">${lang === "vi" ? "Đơn giá" : "Price"}</label>
            <input id="edit-price-${idx}" value="${priceStr}" 
              oninput="onEditDraftChange(${idx}, 'basePrice', this.value)"
              style="padding:6px; text-align:right;">
          </div>

          <!-- Quantitative -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">${lang === "vi" ? "Định lượng" : "Quantitative"}</label>
            <input id="edit-qty-${idx}" type="number" value="${quantitativeStr}" min="${d.min || 1}" ${d.max ? `max="${d.max}"` : ""}
               oninput="onEditDraftChange(${idx}, 'quantitative', this.value, false)" 
               onblur="onEditDraftChange(${idx}, 'quantitative', this.value, true)" 
              style="padding:6px; text-align:right;">
          </div>

          <!-- Duration -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">
              ${lang === "vi" ? "Thời hạn" : "Duration"}
            </label>

            <input id="edit-duration-${idx}"
              type="${isPerpetual ? "text" : "number"}"
              min="1"
              max="${d.package === 'month' ? 12 : ''}"
              value="${isPerpetual
        ? (lang === "vi" ? "Vĩnh viễn" : "Perpetual")
        : durationStr}"
              ${isPerpetual ? "readonly" : `oninput=\"onEditDraftChange(${idx}, 'duration', this.value)\"`}
              data-value="${durationStr}"
              style="padding:6px; text-align:right; ${isPerpetual ? 'background:#f8f9fa;' : ''}">
          </div>

          <!-- Discount -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">${lang === "vi" ? "Giảm giá" : "Discount"}</label>
            <div style="display:flex; gap:6px;">
              <input id="edit-discount-${idx}" value="${discountStr}" 
                oninput="onEditDraftChange(${idx}, 'discount', this.value)" 
                style="padding:6px; text-align:right; flex:1;">
              <select id="edit-discount-type-${idx}" 
                onchange="onEditDraftChange(${idx}, 'discountType', this.value)" 
                style="padding:6px;">
                <option value="percent" ${discountType === "percent" ? "selected" : ""}>%</option>
                <option value="amount" ${discountType === "amount" ? "selected" : ""}>${d.currency || ''}</option>
              </select>
            </div>
          </div>

          <!-- Amount -->
          <div style="display:flex; flex-direction:column;">
            <label style="font-weight:500; color:#555; margin-bottom:4px;">${lang === "vi" ? "Thành tiền" : "Amount"}</label>
            <input id="edit-amount-${idx}" value="${formatCurrency(amt, d.currency)}" readonly 
              style="padding:6px; text-align:right; font-weight:600;">
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html + `
    <div id="edit-subtotal" style="text-align:right; font-weight:600; margin-top:12px;">
      ${lang === "vi" ? "Tạm tính:" : "Subtotal:"} ${formatCurrency(total, editDrafts[0]?.currency || "đ")}
    </div>
    <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:8px; gap:6px;">
      <label>${lang === "vi" ? "Giảm giá chung:" : "Global Discount:"}</label>
      <input id="edit-global-discount" type="number" value="${globalDiscount.value}" style="width:100px; text-align:right;">
      <select id="edit-global-discount-type">
        <option value="percent" ${globalDiscount.type === "percent" ? "selected" : ""}>%</option>
        <option value="amount" ${globalDiscount.type === "amount" ? "selected" : ""}>${listItems[0]?.currency || "đ"}</option>
      </select>
    </div>
    <div id="edit-total" style="text-align:right; font-weight:700; margin-top:8px;">
      ${lang === "vi" ? "Tổng cộng:" : "Total:"} ${formatCurrency(
    total - (globalDiscount.type === "percent" ? total * globalDiscount.value / 100 : globalDiscount.value),
    editDrafts[0]?.currency || "đ"
  )}
    </div>
  `;

  document.getElementById("edit-global-discount").oninput = (e) => {
    let val = parseFloat(e.target.value) || 0;

    if (globalDiscount.type === "percent") {
      if (val < 0) val = 0;
      if (val > 100) val = 100;
    } else {
      if (val < 0) val = 0;
    }

    globalDiscount.value = val;
    e.target.value = val; // ép lại giá trị hiển thị nếu vượt range

    updateGlobalTotal();
  };

  // Khi đổi loại discount (% ↔ amount)
  document.getElementById("edit-global-discount-type").onchange = (e) => {
    const newType = e.target.value;

    // Nếu chuyển từ amount -> percent và value > 100 → ép về 100
    if (newType === "percent" && globalDiscount.value > 100) {
      globalDiscount.value = 100;
      const inputEl = document.getElementById("edit-global-discount");
      if (inputEl) inputEl.value = 100;
    }

    globalDiscount.type = newType;
    updateGlobalTotal();
  };

  // 👉 Save / Cancel ở footer
  const footer = document.getElementById("edit-actions-footer");
  if (footer) {
    footer.innerHTML = `
      <button id="btn-save-section1" class="btn btn-primary">Save</button>
      <button id="btn-cancel-section1" class="btn btn-secondary">Cancel</button>
    `;
    document.getElementById("btn-save-section1").onclick = () => exitSection1EditMode(true);
    document.getElementById("btn-cancel-section1").onclick = () => exitSection1EditMode(false);
  }
}

async function renderSection1() {
  const hasData = await loadProductsFromDeal();

  // Clear trạng thái nút trước
  const btnEdit = document.getElementById("btn-edit-products");
  btnEdit.style.display = "none";

  if (hasData && listItems.length > 0) {
    renderProductList();
    if (btnEdit) btnEdit.style.display = "inline-block";
  } else {
    renderNoProductMessage();
  }
}

// ============= HELPER =============
function toggleTag() {
  if (!Array.isArray(tag)) tag = [];

  let hasPending = false;
  let hasSuccess = false;

  tag = tag.map(t => {
    if (t.toLowerCase() === "revenue pending") {
      hasPending = true;
      return "Revenue Success";
    }
    if (t.toLowerCase() === "revenue success") {
      hasSuccess = true;
      return "Revenue Pending";
    }
    return t; // giữ nguyên tag khác
  });

  // nếu không có cả pending lẫn success → thêm mới pending
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
  } else { // amount
    const disc = Number(draft.discount) || 0;
    baseTotal = tmp - disc;
    finalTotal = tmp - disc;;
  }
  if (finalTotal < 0) finalTotal = 0;
  return {
    baseTotal,
    finalTotal
  };
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

  const numeric = ["basePrice", "quantitative", "duration", "discount"];
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

function showAlert(message, type = "info", timeout = 5000) {
  let container = document.getElementById("alert-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "alert-container";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "1050";
    container.style.width = "320px";
    document.body.appendChild(container);
  }

  const wrapper = document.createElement("div");
  wrapper.className = `alert alert-${type} alert-dismissible fade show`;
  wrapper.role = "alert";
  wrapper.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  container.appendChild(wrapper);

  if (timeout) {
    setTimeout(() => {
      wrapper.classList.remove("show");
      wrapper.addEventListener("transitionend", () => wrapper.remove());
    }, timeout);
  }
}

// ================= SECTION 2 =================
// ============= DATA =============
async function loadMarket() {
  try {
    // Load từ DB
    const stored = await client.db.get("marketList").catch(() => null);
    if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
      cachedMarkets = stored.value;
      renderMarket(cachedMarkets);
      return;
    }

    // Gọi API
    const res = await client.request.invokeTemplate("getMarket");
    const raw = res.response || res.body || res.respData?.response;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const rawMarkets = Array.isArray(data.cm_markets) ? data.cm_markets : [];

    cachedMarkets = rawMarkets.map(m => ({
      id: String(m.id),
      name: m.name,
      alias: m.custom_field?.cf_alias || m.name,
      currency: m.custom_field?.cf_currency || "",
      currencySymbol: m.custom_field?.cf_currency_symbol || ""
    }));

    await client.db.set("marketList", { value: cachedMarkets }).catch(err => console.error(err));
    renderMarket(cachedMarkets);
  } catch (err) {
    console.error("getMarket error:", err);
  }
}

async function loadCatalogByMarket(marketId) {
  if (!marketId) return [];
  try {
    const res = await client.request.invokeTemplate("getCatalog", {
      context: { q: marketId, f: "cf_market" }
    });

    const raw = res.response || res.body || res.respData?.response;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;

    const rawCatalog = Array.isArray(data.cm_catalog?.cm_catalog)
      ? data.cm_catalog.cm_catalog
      : [];
    if (!rawCatalog.length) return [];

    const activeCatalog = rawCatalog.filter(p => p.custom_field?.cf_active === true);

    return activeCatalog.map(p => ({
      id: String(p.id),
      name: p.name || "",
      category: p.custom_field?.cf_category || "",
      version: p.custom_field?.cf_version || "",
      item_type: p.custom_field?.cf_item_type || "",
      max_discount: p.custom_field?.cf_max_discount ?? null,
      active: Boolean(p.custom_field?.cf_active),
      market: String(marketId) // ép theo marketId hiện tại
    }));
  } catch (err) {
    console.error("getCatalog API error:", err);
    return [];
  }
}

async function loadCatalogFromMarket(marketId) {
  if (!marketId) return [];

  // Lấy market info
  const selectedMarket = cachedMarkets.find(m => String(m.id) === String(marketId));
  if (!selectedMarket) {
    console.warn("❌ Market not found in cache:", marketId);
    return [];
  }
  const currencySymbol = selectedMarket.currencySymbol || "$";
  const cacheKey = `categoryList-${currencySymbol}`;

  // 1. Thử lấy từ DB trước
  const stored = await client.db.get(cacheKey).catch(() => null);
  if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
    return stored.value;
  }

  // 2. Nếu chưa có cache → gọi API
  const fresh = await loadCatalogByMarket(marketId);
  if (fresh?.length) {
    await client.db.set(cacheKey, { value: fresh }).catch(err => console.error(err));
  }

  return fresh;
}

async function loadPricebookFromCatalog(catalogId) {
  if (!catalogId) return [];
  const cacheKey = `pricebook-${catalogId}`;

  try {
    // 1. Thử lấy từ DB
    const stored = await client.db.get(cacheKey).catch(() => null);
    if (stored?.value && Array.isArray(stored.value) && stored.value.length) {
      return stored.value;
    }

    // 2. Nếu chưa có cache → gọi API
    const res = await client.request.invokeTemplate("getPricebook", {
      context: { q: catalogId, f: "cf_catalog" }
    });

    const raw = res.response || res.body || res.respData?.response;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;

    const rawPricebook = Array.isArray(data.cm_pricebook?.cm_pricebook)
      ? data.cm_pricebook.cm_pricebook
      : [];

    // 3. Lookup catalog trong cache để lấy maxDiscount + currencySymbol
    const catalog = cachedCatalogs.find(c => String(c.id) === String(catalogId));
    const catalogMaxDiscount = catalog?.max_discount ?? 0;
    const category = catalog?.category;
    const market = cachedMarkets.find(m => String(m.id) === String(catalog.market));
    const currencySymbol = market?.currencySymbol || "$";

    const normalized = rawPricebook.map(p => {
      const base = {
        id: String(p.id),
        name: p.name || "",
        category: category || "",
        license: p.custom_field?.cf_license || "",
        priceType: p.custom_field?.cf_price_type || "",
        package: p.custom_field?.cf_package || "",
        price: p.custom_field?.cf_price ?? null,
        currency: p.custom_field?.cf_currency || "",
        min: p.custom_field?.cf_min ?? null,
        max: p.custom_field?.cf_max ?? null,
        unit: p.custom_field?.cf_unit || "",
        isQuantityBased: Boolean(p.custom_field?.cf_is_quantity_based),
        isRelatedCSMP: Boolean(p.custom_field?.cf_related_csmp),
        maxDiscount: catalogMaxDiscount,
        currencySymbol: currencySymbol
      };

      // chỉ khi isRelatedCSMP = true mới thêm discount fields
      if (base.isRelatedCSMP) {
        base.csmpDiscount = p.custom_field?.cf_csmp_discount ?? null;
        base.csmpDiscountSilver = p.custom_field?.cf_csmp_discount_silver ?? null;
        base.csmpDiscountGold = p.custom_field?.cf_csmp_discount_gold ?? null;
        base.csmpDiscountDiamond = p.custom_field?.cf_csmp_discount_diamond ?? null;
      }

      // 👉 nếu có cf_related_pricebook thì thêm vào
      if (p.custom_field?.cf_related_pricebook) {
        base.relatedPricebook = p.custom_field.cf_related_pricebook;
      }

      // 👉 nếu có cf_sub_type thì thêm vào
      if (p.custom_field?.cf_type) {
        base.type = p.custom_field.cf_type;
      }

      // 👉 nếu có cf_sub_type thì thêm vào
      if (p.custom_field?.cf_sub_type) {
        base.subType = p.custom_field.cf_sub_type;
      }

      return base;
    });

    if (normalized.length) {
      await client.db.set(cacheKey, { value: normalized }).catch(err => console.error(err));
    }
    return normalized;
  } catch (err) {
    console.error("getPricebook API error:", err);
    return [];
  }
}

// ============= RENDER =============
function renderMarket(markets) {
  const marketIcon = document.getElementById("market-icons");
  const marketSelect = document.getElementById("market-select");

  if (!marketIcon) return console.error("❌ #market-icons not found");
  if (!marketSelect) return console.error("❌ #market-select not found");

  // Reset select
  marketSelect.innerHTML = `<option value="">--- Select Market ---</option>`;

  // Đổ option vào select (dùng alias để user dễ thấy)
  markets.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.alias || m.name || m.id;
    marketSelect.appendChild(opt);
  });

  // Hàm trả về SVG icon theo alias (dùng lại code cũ của bạn)
  function getIconUrlByAlias(alias) {
    if (!alias) return "";
    switch (alias.toLowerCase()) {
      case "vietnam":
        return "data:image/svg+xml;utf8," +
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 480'>" +
          "<rect width='640' height='480' fill='%23da251d'/>" +
          "<polygon fill='%23ff0' points='320,120 345,240 480,240 360,300 400,420 320,340 240,420 280,300 160,240 295,240'/>" +
          "</svg>";
      case "philippines":
        return "data:image/svg+xml;utf8," +
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 480'>" +
          "<rect width='640' height='240' fill='%23007bff'/>" +
          "<rect y='240' width='640' height='240' fill='%23fff'/>" +
          "<polygon fill='%23ffd700' points='0,0 320,240 0,480'/>" +
          "</svg>";
      default:
        // icon quả địa cầu
        return "data:image/svg+xml;utf8," +
          "<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 64 64'>" +
          "<circle cx='32' cy='32' r='30' fill='%234FC3F7' stroke='%231976D2' stroke-width='2'/>" +
          "<path d='M32 2 A30 30 0 0 1 32 62 A30 30 0 0 1 32 2 Z' fill='%2381C784'/>" +
          "<path d='M2 32 H62 M32 2 V62' stroke='%23fff' stroke-width='2'/>" +
          "</svg>";
    }
  }

  // Clear icon ban đầu
  marketIcon.innerHTML = "";

  // Khi select thay đổi → update icon
  marketSelect.addEventListener("change", async function () {
    const selectedId = this.value;

    if (!selectedId) {
      // Không chọn gì → clear icon
      marketIcon.innerHTML = "";
      document.getElementById("filters-container").style.display = "none";
      return;
    }

    const selectedMarket = markets.find(m => String(m.id) === String(selectedId));
    if (!selectedMarket) {
      marketIcon.innerHTML = "";
      return;
    }

    const iconUrl = getIconUrlByAlias(selectedMarket.alias || "");

    // Chỉ show đúng 1 icon
    marketIcon.innerHTML =
      `<div class="market-icon selected">
         <img src="${iconUrl}" alt="${selectedMarket.name}" title="${selectedMarket.name}">
       </div>`;

    // Gọi logic cũ (nếu bạn đã có)
    if (typeof onMarketClick === "function") {
      await onMarketClick(selectedId);
    }
  });
}

function renderCategory(categories) {
  document.getElementById("category").style.display = "grid";
  const sel = document.getElementById("category-select");
  const selLabel = document.querySelector("label[for='category-select']");
  if (!sel) return console.error("❌ #category-select not found");
  if (selLabel) selLabel.textContent = (lang === "vi") ? "Danh mục" : "Category";

  sel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn danh mục ---" : "--- Select Category ---"}</option>` +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  sel.onchange = onCategoryChange;
}

function renderVersion(versions) {
  document.getElementById("version").style.display = "grid";
  const sel = document.getElementById("version-select");
  const selLabel = document.querySelector("label[for='version-select']");
  if (!sel) return console.error("❌ #version-select not found");
  if (selLabel) selLabel.textContent = (lang === "vi") ? "Phiên bản" : "Version";

  sel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Phiên bản ---" : "--- Select Version ---"}</option>` +
    versions.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");

  sel.onchange = onVersionChange;
}

function renderType(pricebook) {
  const container = document.getElementById("type-subtype-container");
  const typeSel = document.getElementById("type-select");
  const subtypeSel = document.getElementById("subtype-select");
  const typeLabel = document.getElementById("type-label");
  const subtypeLabel = document.getElementById("subtype-label");

  typeLabel.textContent = (lang === "vi") ? "Loại" : "Type";

  const typeWrapper = typeSel.parentElement;
  const subtypeWrapper = subtypeSel.parentElement;

  const types = sortByNumericValue([...new Set(pricebook.map(p => p.type).filter(Boolean))]);

  typeSel.innerHTML = `<option value="">${lang === "vi" ? "--- Chọn nhóm ---" : "--- Select Type ---"}</option>`;

  if (!types.length) {
    container.style.display = "none";
    typeWrapper.style.display = "none";
    subtypeWrapper.style.display = "none";
    typeLabel.classList.add("hidden");
    subtypeLabel.classList.add("hidden");
    typeSel.classList.add("hidden");
    subtypeSel.classList.add("hidden");
    return false; // ❗ báo cho onVersionChange biết là không có type
  }

  container.style.display = "grid";
  typeWrapper.style.display = "block";
  typeLabel.classList.remove("hidden");
  typeSel.classList.remove("hidden");

  // ẩn subtype cho đến khi biết có subtype
  subtypeWrapper.style.display = "none";
  subtypeLabel.classList.add("hidden");
  subtypeSel.classList.add("hidden");

  typeSel.innerHTML += types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  // ❗ gán handler (không gọi hàm)
  typeSel.onchange = onTypeChange;

  return true;
}

function renderSubtype(pricebook, type) {
  const container = document.getElementById("type-subtype-container");
  //const typeSel = document.getElementById("type-select");
  const subtypeSel = document.getElementById("subtype-select");
  const subtypeLabel = document.getElementById("subtype-label");
  subtypeLabel.textContent = (lang === "vi") ? "Phân loại" : "Sub Type";

  if (!container || !subtypeSel) return;

  // Nếu không có type được chọn → lấy toàn bộ subtype của pricebook
  let source = pricebook || [];
  if (type) {
    source = source.filter(p => String(p.type) === String(type));
  }

  const subtypes = sortByNumericValue(
    [...new Set(source.map(p => p.subType).filter(Boolean))]
  );

  // Reset option
  subtypeSel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn loại chi tiết ---" : "--- Select SubType ---"}</option>`;

  const subtypeWrapper = subtypeSel.parentElement;

  if (!subtypes.length) {
    // Không có subtype → ẩn riêng phần Subtype, nhưng vẫn giữ Type
    subtypeWrapper.style.display = "none";
    subtypeLabel.classList.add("hidden");
    subtypeSel.classList.add("hidden");
    return;
  }

  // Có subtype → hiển thị
  subtypeWrapper.style.display = "block";
  subtypeLabel.classList.remove("hidden");
  subtypeSel.classList.remove("hidden");

  subtypeSel.innerHTML += subtypes
    .map(st => `<option value="${escapeHtml(st)}">${escapeHtml(st)}</option>`)
    .join("");

  // onchange subtype thì m vẫn filter product như cũ
  subtypeSel.onchange = onSubtypeChange;
}

function renderLicense(pricebook) {
  document.getElementById("license").style.display = "grid";
  const sel = document.getElementById("license-select");
  const selLabel = document.getElementById("license-label");
  if (!sel) return;
  if (selLabel) selLabel.textContent = (lang === "vi") ? "Giấy phép" : "License";

  const licenses = [...new Set(pricebook.map(p => p.license).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  sel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Giấy phép ---" : "--- Select License ---"}</option>` +
    licenses.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");

  sel.onchange = onLicenseChange;
}

function renderPriceType(pricebook) {
  document.getElementById("price-type").style.display = "grid";
  const sel = document.getElementById("price-type-select");
  const selLabel = document.getElementById("price-type-label");
  if (!sel) return;
  if (selLabel) selLabel.textContent = (lang === "vi") ? "Loại giá" : "Price type";

  const priceType = [...new Set(pricebook.map(p => p.priceType).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  sel.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Loại giá ---" : "--- Select Price type ---"}</option>` +
    priceType.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");

  sel.onchange = onPriceTypeChange;
}

function renderPackageSelect(pricebook) {
  const container = document.getElementById("duration-package-container");
  const quantitative = document.getElementById("quantitative");
  const durationWrapper = document.getElementById("package-duration-wrapper");
  const durationLabel = document.getElementById("package-duration-label");
  const durationInput = document.getElementById("package-duration-input");
  const packageUnit = document.getElementById("package-unit");
  const packageLabel = document.getElementById("package-label");
  const packageSelect = document.getElementById("package-select");

  if (!container || !packageUnit || !packageSelect || !quantitative) return;

  const license = document.getElementById("license-select")?.value || "";
  const isPerpetual = license.toLowerCase() === "perpetual";

  // đảm bảo quantitative visible khi cần
  quantitative.classList.remove("hidden");
  quantitative.style.display = "block";

  // Text label
  packageLabel.textContent = (lang === "vi") ? "Đơn vị" : "Package Unit";
  durationLabel.textContent = (lang === "vi") ? "Thời hạn" : "Duration";

  // ----- Perpetual: auto-select perpetual và cập nhật ngay -----
  if (isPerpetual) {
    container.classList.remove("grid-3");
    container.classList.add("grid-2");

    if (durationWrapper) { durationWrapper.classList.add("hidden"); durationWrapper.style.display = "none"; }
    if (packageUnit) { packageUnit.classList.remove("hidden"); packageUnit.style.display = "block"; }

    // chỉ có 1 option perpetual — set value = "perpetual"
    packageSelect.innerHTML =
      `<option value="">${lang === "vi" ? "--- Chọn Đơn vị ---" : "--- Select Package Unit ---"}</option>
       <option value="perpetual">${lang === "vi" ? "Vĩnh viễn" : "Perpetual"}</option>`;

    // Auto-select ONLY for perpetual case (by your request)
    packageSelect.value = "perpetual";

    // ensure durationInput not constrained by max
    if (durationInput) durationInput.removeAttribute("max");

    // trigger update so quantitative/product reflect perpetual mode
    updateProductDisplay();

    // attach change handler (in case user changes it later)
    packageSelect.onchange = () => {
      updateProductDisplay();
    };

    return;
  }

  // ----- Non-perpetual: DO NOT auto-select, wait for user change -----
  container.classList.remove("grid-2");
  container.classList.add("grid-3");

  if (durationWrapper) { durationWrapper.classList.remove("hidden"); durationWrapper.style.display = "block"; }
  if (packageUnit) { packageUnit.classList.remove("hidden"); packageUnit.style.display = "block"; }
  if (quantitative) { quantitative.classList.remove("hidden"); quantitative.style.display = "block"; }
  if (durationInput) durationInput.classList.remove("hidden");

  const rawPackage = [...new Set(pricebook.map(p => p.package).filter(Boolean))];

  if (!rawPackage.length) {
    if (durationWrapper) { durationWrapper.classList.add("hidden"); durationWrapper.style.display = "none"; }
    if (packageUnit) { packageUnit.classList.add("hidden"); packageUnit.style.display = "none"; }
    renderProduct([]);
    return;
  }

  let options = [];
  if (rawPackage.includes("time")) {
    options = ["time"];
  } else if (rawPackage.some(p => p === "year" || p === "month")) {
    options = ["year", "month"];
  }

  // Render options but DO NOT set packageSelect.value -> wait for user
  packageSelect.innerHTML =
    `<option value="">${lang === "vi" ? "--- Chọn Đơn vị ---" : "--- Select Package Unit ---"}</option>` +
    options.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");

  // onChange will handle duration max + update product display
  packageSelect.onchange = () => {
    const selectedPackage = packageSelect.value;
    if (selectedPackage === "month" && durationInput) {
      durationInput.max = 12;
      if (+durationInput.value > 12) durationInput.value = 12;
    } else if (durationInput) {
      durationInput.removeAttribute("max");
    }
    updateProductDisplay();
  };
}

function renderProduct(products) {
  const containerEl = document.getElementById("product-table");
  if (!containerEl) return;

  // Clear trước khi render
  containerEl.innerHTML = "";

  // Nếu không có product -> show empty state (hoặc ẩn)
  if (!products || !products.length) {
    containerEl.style.display = "block";
    return;
  }

  containerEl.style.display = "block";

  // Lấy giá trị UI
  const license = document.getElementById("license-select")?.value || "";
  const isPerpetual = (license || "").toLowerCase() === "perpetual";

  let quantitative = 1;
  const quantitativeInput = document.getElementById("quantitative-input");
  if (quantitativeInput) {
    const val = parseFloat(quantitativeInput.value);
    if (!isNaN(val)) quantitative = val;
    else if (quantitativeInput.min) quantitative = parseFloat(quantitativeInput.min);
  }

  const selectedPackage = document.getElementById("package-select")?.value || "";
  const packageQty = document.getElementById("package-duration-input") ? parseFloat(document.getElementById("package-duration-input").value) || 1 : 1;

  // build table header once + body rows
  const rowsHtml = products.map((p, idx) => {
    // tính giá điều chỉnh theo package
    let adjustedPrice = p.price ?? 0;
    if (p.package && selectedPackage) {
      if (p.package === "year" && selectedPackage === "month") adjustedPrice /= 12;
      else if (p.package === "month" && selectedPackage === "year") adjustedPrice *= 12;
    }

    const quantityBasedPrice = p.isQuantityBased ? adjustedPrice * quantitative : adjustedPrice;
    const subtotal = quantityBasedPrice * packageQty;
    const rangeText = formatUnitRange(p.min, p.max, p.unit);
    const currentCurrency = p.currency || "USD";

    // duration display
    let durationDisplay;
    if (isPerpetual) durationDisplay = (lang === "vi") ? "Vĩnh viễn" : "Perpetual";
    else durationDisplay = `${packageQty} ${selectedPackage || "-"}`;

    const maxDiscount = p.maxDiscount ?? 0;
    const unit = p.unit || "";

    return `
      <tr data-idx="${idx}">
        <td>
          <textarea class="form-control form-control-sm product-name"
            data-index="${idx}"
            style="resize: vertical; min-height:40px; white-space: normal; word-break: break-word;">${escapeHtml(p.name)}</textarea>
        </td>
        <td>${rangeText}</td>
        <td>${maxDiscount} %</td>
        <td>${formatPrice(adjustedPrice, currentCurrency)}</td>
        <td>${quantitative} ${unit}</td>
        <td>${durationDisplay}</td>
        <td>${formatPrice(subtotal, currentCurrency)}</td>
        <td>
          <button style="margin-top: 10px; padding: 6px; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;
            border: none; border-radius: 4px; background-color: #ffffff; color: #004085; cursor: pointer; font-weight: bold;"
            onclick="pushToQuote()">
            <fw-icon name="circle-plus" size="18" color="#004085"></fw-icon>
            Add
          </button>        
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <table class="table table-sm table-bordered">
      <thead>
        <tr>
          <th>${lang === "vi" ? "Tên sản phẩm" : "Product Name"}</th>
          <th>${lang === "vi" ? "Định lượng tiêu chuẩn" : "Quantitative standard"}</th>
          <th>${lang === "vi" ? "Giảm giá tối đa" : "Max discount"}</th>
          <th>${lang === "vi" ? "Đơn giá" : "Unit Price"}</th>
          <th>${lang === "vi" ? "Định lượng" : "Quantitative"}</th>
          <th>${lang === "vi" ? "Thời hạn" : "Duration"}</th>
          <th>${lang === "vi" ? "Thành tiền" : "Total"}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  containerEl.innerHTML = html;

  // Gắn handler cho textarea — dùng oninput (gán, không addEventListener nhiều lần)
  containerEl.querySelectorAll("textarea.product-name").forEach(inputEl => {
    inputEl.oninput = (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (!isNaN(idx)) products[idx].name = e.target.value;
    };
  });
}

function renderPriceTable(targetId = "price-table") {
  const container = document.getElementById(targetId);
  const btnSaveSection2 = document.getElementById("btn-save-section2");
  if (!container) return;
  container.style.display = "block";

  const validItems = listItems.filter(item => item && item.basePrice !== null && !isNaN(item.basePrice));
  if (!validItems.length) {
    container.innerHTML = `
      <div style="text-align:center; color:#555;">
        <img src="https://img.icons8.com/ios/100/box.png" alt="no product" style="opacity:0.5; margin-bottom:16px;">
        <p style="margin:8px 0;">${lang === "vi" ? "Hiện chưa có sản phẩm nào." : "There are no products yet."}</p>
      </div>
    `;
    btnSaveSection2.style.display = "none";
    return;
  }

  const displayCurrency = validItems[0].currency || currentCurrency;
  const totalAfterItemDiscount = validItems.reduce((sum, it) => sum + (it.finalTotal || 0), 0);

  const rows = validItems.map((item, idx) => {
    const lic = String(item.license || '').toLowerCase();
    const pkg = String(item.package || '').toLowerCase();
    const durationCell = (lic === "perpetual" && pkg === "perpetual")
      ? `<div style="background:#f5f5f5; padding:4px 6px; color:#666; border:1px solid #ccc; white-space:nowrap;">${lang === "vi" ? "Vĩnh viễn" : "Perpetual"}</div>`
      : `
                <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; overflow:hidden; height: 32px;line-height: 32px;">
                    <input 
                        id="duration-input-${idx}"
                        type="number" 
                        value="${item.duration || 1}" 
                        min="1"
                        ${pkg === "month" ? 'max="12"' : ""}
                        oninput="commitDuration(${idx}, this.value, '${pkg}')" 
                        style="flex:1; border:none; text-align:center; font-size:14px; outline:none; min-width:50px; padding: 4px 6px; height: 32px; line-height: 32px;" 
                    />
                    <span style="background:#f5f5f5; padding:4px 6px; color:#666; border-left:1px solid #ccc; white-space:nowrap;">
                        ${pkg}${item.duration > 1 ? "s" : ""}
                    </span>
                </div>
            `;

    return `
            <tr id="row-${idx}">
                <td style="font-weight: 500; color: #333;">${item.name}</td>
                <td style="width:13%; text-align:center;">
                    <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; overflow:hidden; height: 32px;line-height: 32px;">
                        <span style="background:#f5f5f5; padding:4px 6px; color:#666; border-right:1px solid #ccc; white-space:nowrap;">
                            ${item.currency || currentCurrency}
                        </span>
                        <input 
                            type="text"
                            value="${Number(item.basePrice).toLocaleString('en-US')}" 
                            oninput="formatPriceInput(this)" 
                            onblur="commitPrice(${idx}, this.value)" 
                            style="flex:1; border:none; padding:4px 6px; text-align:center; font-size:14px; outline:none; min-width:50px; height: 32px;line-height: 32px;" 
                        />
                    </div>
                </td>
                <td style="width:13%; text-align:center;">
                    <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; overflow:hidden; height: 32px;line-height: 32px;">
                        <input 
                            type="number"
                            value="${item.quantitative}" 
                            min="${item.min || 1}"
                            ${item.max ? `max="${item.max}"` : ""}
                            oninput="commitQuantity(${idx}, this.value)"
                            onblur="commitQuantity(${idx}, this.value, true)"
                            style="flex:1; border:none; padding:4px 6px; text-align:center; font-size:14px; outline:none; min-width:50px; height: 32px; line-height: 32px;" 
                        />
                        ${item.subType === "IP tĩnh" ? "" : `
                            <span style="background:#f5f5f5; padding:4px 6px; color:#666; border-left:1px solid #ccc; white-space:nowrap;">
                                ${item.unit || ""}
                            </span>`}
                    </div>
                </td>
                <td style="width:10%; text-align:center;">${durationCell}</td>
                <td style="width:15%; text-align:center;">
                  <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; overflow:hidden; height:32px; line-height:32px; background:#fff;">
                    <select id="discount-type-${idx}" 
                        onchange="handleDiscountTypeChange('discount-input-${idx}','discount-type-${idx}', ${idx})"
                        style="flex:0 0 30%; max-width:30%; border:none; outline:none; text-align:center; background:#f5f5f5; height:100%;">
                        <option value="percent" ${item.discountType === "percent" ? "selected" : ""}>%</option>
                        <option value="amount" ${item.discountType === "amount" ? "selected" : ""}>${item.currency || currentCurrency}</option>
                    </select>
                    <input 
                        id="discount-input-${idx}"
                        type="text"
                        value="${Number(item.discount || 0).toLocaleString('en-US')}" 
                        oninput="handleDiscountInput('discount-input-${idx}','discount-type-${idx}', ${idx})"
                        style="flex:0 0 70%; max-width:70%; border:none; outline:none; text-align:right; padding:4px 6px; height:100%;">
                  </div>
                </td>
                <td id="amount-${idx}" style="text-align:right;">
                    <span style="font-weight:500; color:#333;">${formatPrice(item.finalTotal, item.currency || currentCurrency)}</span>
                </td>
                <td style="width: 10px; text-align:center;">
                    <button onclick="removeQuoteItem(${idx})">
                        <fw-icon name="circle-cross" size="16" color="#666"></fw-icon>
                    </button>
                </td>
            </tr>
        `;
  });

  const total = totalAfterItemDiscount - (globalDiscount.type === "percent"
    ? totalAfterItemDiscount * (globalDiscount.value / 100)
    : globalDiscount.value);

  container.innerHTML = `
    <table style="width:100%; table-layout:fixed;">
      <thead>
        <tr>
          <th style="width:35%; text-align:left;">${lang === "vi" ? "Tên sản phẩm" : "Name"}</th>
          <th style="width:13%; text-align:center;">${lang === "vi" ? "Đơn giá" : "Price"}</th>
          <th style="width:13%; text-align:center;">${lang === "vi" ? "Số lượng" : "Quantity"}</th>
          <th style="width:10%; text-align:center;">${lang === "vi" ? "Thời giạn" : "Duration"}</th>
          <th style="width:15%; text-align:center;">${lang === "vi" ? "Giảm giá" : "Discount"}</th>
          <th style="width:12%; text-align:right;">${lang === "vi" ? "Thành tiền" : "Amount"}</th>
          <th style="width:2%; text-align:center;"></th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
        <tr class="subtotal-row">
          <td colspan="5" style="text-align:right;">${lang === "vi" ? "Tạm tính" : "Subtotal"}</td>
          <td id="subtotal-cell" style="text-align:right;">${formatPrice(totalAfterItemDiscount, displayCurrency)}</td>
          <td></td>
        </tr>
        <tr class="global-discount-row">
          <td colspan="4"></td>
          <!-- Discount + Amount -->
          <td colspan="2" id="global-discount-form" style="text-align:right;">
            ${(!globalDiscount.value || Number(globalDiscount.value) === 0)
      ? `<button onclick="openGlobalDiscount()" 
                          style="color: #0070f3; cursor: pointer; user-select: none; margin-left: auto; display:flex; align-items:center; justify-content:flex-end; gap:4px; font-weight:500; font-size:14px;">
                    <fw-icon name="circle-plus" size="16" color="#0070f3"></fw-icon> ${lang === "vi" ? "Thêm giảm giá" : "Add discount"}
                  </button>`
      : (globalDiscount.type === "percent"
        ? `${globalDiscount.value} %`
        : formatCurrency(globalDiscount.value, displayCurrency))
    }
          </td>
          <!-- Action -->
          <td id="global-discount-action" style="text-align:right;">
            ${(globalDiscount.value && Number(globalDiscount.value) !== 0)
      ? `<button onclick="openGlobalDiscount()" 
                          style="border:none; background:none; cursor:pointer; color:#0070f3; font-size:14px;">
                    ${lang === "vi" ? "Chỉnh sửa" : "Edit"}
                  </button>`
      : ``
    }
          </td>
        </tr>
        <tr class="total-row">
          <td colspan="5" style="text-align:right;">${lang === "vi" ? "Tổng cộng" : "Total"}</td>
          <td id="total-cell" style="text-align:right;">${formatPrice(total, displayCurrency)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}

function openGlobalDiscount() {
  const formCell = document.getElementById("global-discount-form");
  const actionCell = document.getElementById("global-discount-action");
  if (!formCell || !actionCell) return;

  const currencySymbol = listItems[0]?.currency || currentCurrency || "đ";

  // hiển thị input + select trong 2 cột (Discount + Amount)
  formCell.innerHTML = `
    <div style="display:flex; justify-content:flex-end; gap:6px; align-items:center;">
      <select id="global-discount-type"
              style="padding:6px; border:1px solid #ccc; border-radius:4px; background:#fff;"
              onchange="handleDiscountTypeChange('global-discount-input','global-discount-type')">
        <option value="percent" ${globalDiscount.type === "percent" ? "selected" : ""}>%</option>
        <option value="amount"  ${globalDiscount.type === "amount" ? "selected" : ""}>${currencySymbol}</option>
      </select>
      <input id="global-discount-input" type="number"
            value="${globalDiscount.value || ''}"
            min="0"
            oninput="handleDiscountInput('global-discount-input','global-discount-type')"
            placeholder="0"
            style="width:120px; text-align:right; padding:6px; border:1px solid #ccc; border-radius:4px;">
    </div>
  `;

  // action cột cuối: button Add
  actionCell.innerHTML = `
    <button onclick="applyGlobalDiscount()" 
            style="border:none; background:none; cursor:pointer; color:#0070f3; font-size:14px;">
      Add
    </button>
  `;
}

// ============= EVENTS =============
async function onMarketClick(marketId) {
  selectedMarketId = marketId;
  if (!marketId) return;
  const catalogForMarket = await loadCatalogFromMarket(marketId);
  cachedCatalogs = catalogForMarket;

  const filteredByMarket = catalogForMarket.filter(p => String(p.market) === String(marketId));
  const categories = [...new Set(filteredByMarket.map(p => p.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  renderCategory(categories);

  // --- auto chọn category đầu tiên nếu có ---
  if (categories.length) {
    const categorySelect = document.getElementById("category-select");
    categorySelect.value = "";
    onCategoryChange({ target: categorySelect }, marketId);
  }

  // Show filters container sau khi chọn market
  document.getElementById("filters-container").style.display = "grid";
}

function onCategoryChange(e, marketIdParam) {
  const category = e?.target?.value ?? "";
  const marketId = marketIdParam || selectedMarketId;
  resetProductFilters("version");

  if (!marketId || !category) {
    document.getElementById("type").style.display = "none";
    document.getElementById("version").style.display = "none";
    document.getElementById("subtype").style.display = "none";
    document.getElementById("license").style.display = "none";
    document.getElementById("price-type").style.display = "none";
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
    return
  };

  const filtered = cachedCatalogs.filter(
    p => String(p.market) === String(marketId) && p.category === category
  );

  const versions = [...new Set(filtered.map(p => p.version).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  renderVersion(versions);
  renderProduct([]); // reset bảng product
}

async function onVersionChange(e) {
  const version = e?.target?.value ?? "";
  const marketId = selectedMarketId;
  const category = document.getElementById("category-select")?.value ?? "";
  resetProductFilters("type");

  if (!marketId || !category) return;
  if (!version) {
    document.getElementById("type").style.display = "none";
    document.getElementById("subtype").style.display = "none";
    document.getElementById("license").style.display = "none";
    document.getElementById("price-type").style.display = "none";
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
    cachedPricebook = [];
    return;
  }

  const matched = cachedCatalogs.filter(
    p => String(p.market) === String(marketId) &&
      p.category === category &&
      p.version === version
  );

  if (!matched.length) return;

  const catalogId = matched[0].id;
  const pricebook = await loadPricebookFromCatalog(catalogId);

  // Lưu vào cache
  cachedPricebook = pricebook;

  // 👉 Tìm min nhỏ nhất từ pricebook
  const mins = pricebook
    .map(p => (typeof p.min === "number" ? p.min : null))
    .filter(v => v !== null);
  const minQty = mins.length > 0 ? Math.min(...mins) : 1;

  // 👉 Cập nhật input quantitative
  const quantitativeInput = document.getElementById("quantitative-input");
  if (quantitativeInput) {
    quantitativeInput.min = minQty;
    quantitativeInput.value = minQty; // set mặc định
  }

  const hasType = renderType(pricebook);

  if (!hasType) {
    document.getElementById("license-select").style.display = "grid";
    document.getElementById("license-label").style.display = "grid";
    renderLicense(pricebook);
  } else {
    // Nếu có type thì chờ user chọn type/subtype rồi mới renderLicense
    document.getElementById("license").style.display = "none";
    document.getElementById("price-type").style.display = "none";
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
  }

  renderProduct([]);
  attachProductFilterEvents();
}

function onTypeChange(e) {
  const type = e?.target?.value ?? "";
  resetProductFilters("subtype");

  if (!type) {
    // chưa chọn type → clear subtype + license
    renderSubtype(cachedPricebook);
    renderProduct([]);
    return;
  }

  // xem type này có subtype không
  const filtered = cachedPricebook.filter(p => String(p.type) === String(type));
  const hasSubtype = filtered.some(p => p.subType);

  if (hasSubtype) {
    // Case 2: có subtype → renderSubtype, sau đó chờ onSubtypeChange
    renderSubtype(cachedPricebook, type);
  } else {
    // Case 1: không có subtype → renderLicense ngay với pricebook đã filter theo type
    renderLicense(filtered);
  }
}

function onSubtypeChange(e) {
  const type = document.getElementById("type-select")?.value || "";
  const subtype = e?.target?.value || document.getElementById("subtype-select")?.value || "";
  resetProductFilters("license");

  if (!subtype) {
    renderLicense([]); // clear
    renderProduct([]);
    return;
  }

  const filtered = cachedPricebook.filter(
    p => String(p.type) === String(type) &&
      String(p.subType) === String(subtype)
  );

  renderLicense(filtered);
}

function onLicenseChange(e) {
  const license = e?.target?.value ?? "";
  resetProductFilters("priceType");

  if (!license) {
    document.getElementById("price-type").style.display = "none";
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
    return;
  }

  const filtered = cachedPricebook.filter(p => String(p.license) === String(license));
  renderPriceType(filtered);
}

function onPriceTypeChange(e) {
  const priceType = e?.target?.value ?? "";
  resetProductFilters("package");

  if (!priceType) {
    document.getElementById("quantitative").style.display = "none";
    document.getElementById("package-duration-wrapper").style.display = "none";
    document.getElementById("package-unit").style.display = "none";
    return;
  }

  const filtered = cachedPricebook.filter(p => String(p.priceType) === String(priceType));
  renderPackageSelect(filtered);
}

function attachProductFilterEvents() {
  const inputs = [
    "type-select",
    "subtype-select",
    "license-select",
    "price-type-select",
    "quantitative-input",
    "package-duration-input",
    "package-select"
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const eventType = (id === "quantitative-input") ? "input" : "change";
    el.addEventListener(eventType, updateProductDisplay);
  });
}

function resetProductFilters(fromLevel = "category") {
  // ordered levels (từ trên xuống dưới)
  const levels = [
    "category",
    "version",
    "type",
    "subtype",
    "license",
    "priceType",
    "package",
    "quantitative"
  ];

  // mapping từ level -> element ids to clear/hide
  const levelToIds = {
    version: ["version-select", "version"],         // wrapper id 'version' và select id 'version-select'
    type: ["type-select", "type", "type-subtype-container"],
    subtype: ["subtype-select"],
    license: ["license-select", "license"],
    priceType: ["price-type-select", "price-type"],
    package: ["package-select", "package-unit", "package-duration-wrapper", "package-duration-input"],
    quantitative: ["quantitative-input", "quantitative"] // lưu ý id của div wrapper là 'quantitive' theo code cũ
  };

  // find index to start clearing (nếu fromLevel không hợp lệ -> start từ đầu)
  const startIdx = Math.max(0, levels.indexOf(fromLevel));

  // For each level from startIdx to end -> clear associated DOM
  for (let i = startIdx; i < levels.length; i++) {
    const lvl = levels[i];

    // nếu map có id list thì clear/hide
    if (levelToIds[lvl]) {
      levelToIds[lvl].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        // Nếu là select or input -> clear options/value
        const tag = el.tagName?.toLowerCase();
        if (tag === "select") {
          el.innerHTML = `<option value="">${lang === "vi" ? "--- Chọn ---" : "--- Select ---"}</option>`;
          el.value = "";
        } else if (tag === "input") {
          // nếu input number -> set default 1
          if (el.type === "number") el.value = 1;
          else el.value = "";
        } else {
          // wrapper div -> ẩn
          el.style.display = "none";
        }
      });
    }

    // Một số xử lý bổ sung cho level đặc thù
    if (lvl === "type") {
      const typeSel = document.getElementById("type-select");
      if (typeSel) {
        // reset type select options but keep the wrapper hidden
        typeSel.innerHTML = `<option value="">${lang === "vi" ? "--- Chọn nhóm ---" : "--- Select Type ---"}</option>`;
      }
    }
    if (lvl === "subtype") {
      const subtypeSel = document.getElementById("subtype-select");
      if (subtypeSel) {
        subtypeSel.innerHTML = `<option value="">${lang === "vi" ? "--- Chọn loại chi tiết ---" : "--- Select SubType ---"}</option>`;
      }
    }
  }

  // Clear product table always when resetting downstream
  renderProduct([]);
}

function updateProductDisplay() {
  const filters = {
    license: document.getElementById("license-select")?.value || "",
    type: document.getElementById("type-select")?.value || "",
    subType: document.getElementById("subtype-select")?.value || "",
    package: document.getElementById("package-select")?.value || "",
    quantitative: Number(document.getElementById("quantitative-input")?.value || 0),
    priceType: document.getElementById("price-type-select")?.value || ""
  };

  const isPerpetual = filters.license.toLowerCase() === "perpetual";

  if (isPerpetual) {
    filters.package = "perpetual";
  }

  // License & package & quantitative luôn bắt buộc
  if (!filters.license || (!isPerpetual && !filters.package) || !filters.quantitative || !filters.priceType) {
    renderProduct([]);
    return;
  }

  // Type/Subtype: chỉ check nếu product có type/subtype
  const matchedProducts = findMatchingProducts(cachedPricebook, filters);

  // Nếu product cần type/subtype mà user chưa chọn → không show
  const productsToShow = matchedProducts.filter(p => {
    if (p.type && !filters.type) return false;
    if (p.subType && !filters.subType) return false;
    return true;
  });

  if (productsToShow.length === 1) {
    currentProduct = productsToShow[0];
  } else {
    currentProduct = null;
  }

  renderProduct(productsToShow);
}

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

function pushToQuote() {
  if (!currentProduct) return;
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

  let adjustedPrice = currentProduct.price ?? 0;
  if (currentProduct.package && packageType) {
    if (currentProduct.package === "year" && packageType === "month") adjustedPrice /= 12;
    else if (currentProduct.package === "month" && packageType === "year") adjustedPrice *= 12;
  }
  const isQuantityBased = currentProduct.isQuantityBased;
  const maxDiscount = currentProduct.maxDiscount || 0;
  const currentCurrency = currentProduct.currencySymbol || "đ";
  const baseTotal = adjustedPrice * (isQuantityBased ? quantitative : 1) * duration;

  listItems.push({
    id: currentProduct.id,
    name: currentProduct.name,
    category: currentProduct.category,
    license: licenseInput?.value || "",
    quantitative,
    min: currentProduct.min ?? 1,
    max: currentProduct.max ?? null,
    unit: currentProduct.unit,
    package: packageType,
    priceType: currentProduct.priceType,
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
  quantitativeInput.value = currentProduct.min || 1;
  if (packageInput) packageInput.value = "";
  if (durationInput) durationInput.value = 1;
  if (subtypeInput) subtypeInput.value = "";

  currentProduct = null;

  document.getElementById("product-table").style.display = "none";
  renderPriceTable();
  document.getElementById("btn-save-section2").style.display = "inline-block";
}

// ============= HELPERS =============
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function formatPrice(value, currency = "") {
  if (value === null || value === undefined || isNaN(Number(value))) return "";
  const num = Number(value);
  return num.toLocaleString('en-US') + (currency ? ` ${currency}` : '');
}

function formatUnitRange(min, max, unit) {
  if (min === null || min === "") min = 1; // default min = 1

  if (max === null || max === "") {
    return (lang === "vi")
      ? `Trên ${min} ${unit || ""}`
      : `Above ${min} ${unit || ""}`;
  } else {
    return `${min} - ${max} ${unit || ""}`;
  }
}

function sortByNumericValue(arr) {
  return arr.sort((a, b) => {
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return numA - numB;
  });
}

function formatPriceInput(inputEl) {
  const raw = inputEl.value.replace(/,/g, '');
  const val = parseFloat(raw);
  if (!isNaN(val)) inputEl.value = val.toLocaleString('en-US');
}

function formatDiscountInput(inputEl) {
  const raw = inputEl.value.replace(/,/g, '');
  const val = parseFloat(raw);
  if (!isNaN(val)) inputEl.value = val.toLocaleString('en-US');
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

function commitAllocationCount(rawValue, maxValue) {
  let val = parseInt(rawValue, 10);

  if (isNaN(val) || val < 1) val = 1;

  maxValue = Number(maxValue) || 1;

  if (val > maxValue) val = maxValue;

  return val;
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

function recomputeBaseTotal(item) {
  const price = Number(item.basePrice) || 0;
  const qty = Number(item.quantity) || 0;
  const duration = Number(item.duration) || 1;
  const isQuantityBased = item.isQuantityBased;

  // Nếu muốn baseTotal không nhân duration thì bỏ duration ở đây
  item.baseTotal = isQuantityBased ? price * qty * duration : price * duration;
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

function formatCurrency(value, currency) {
  const num = Number(value) || 0;  // ✅ fallback về 0 nếu undefined/null/NaN

  if (currency === "đ" || currency === "VND") {
    return `${num.toLocaleString()} đ`;
  } else {
    return `${currency || ""} ${num.toLocaleString()}`;
  }
}

async function updateDeal(finalTotal) {
  const currencyMap = {
    "$": "USD",
    "đ": "VND",
    "¥": "JPY",
    "€": "EUR"
  };

  const currentCurrencyItem = listItems[0]?.currency || "$";
  const dealCurrency = currencyMap[currentCurrencyItem] || "USD";

  // 👉 Lấy tất cả category duy nhất
  const categories = [...new Set(
    listItems.map(it => it.category).filter(Boolean)
  )].join(";");

  // 👉 Tính duration lớn nhất (đổi ra tháng nếu package = "year")
  const maxDuration = Math.max(
    ...(listItems.map(it => {
      const dur = Number(it.duration) || 0;
      const pack = (it.package || "").toLowerCase();
      return pack === "year" ? dur * 12 : dur;
    }))
  ) || 0;

  // 👉 Tính expire date
  const startDate = closedDate || expectedCloseDate;
  let expireDate = null;
  if (startDate instanceof Date && !isNaN(startDate)) {
    const expire = new Date(startDate);
    expire.setMonth(expire.getMonth() + maxDuration);
    expireDate = expire.toString();
  } else {
    expireDate = "";
  }

  try {
    await client.request.invokeTemplate("updateDeal", {
      context: { dealID: currentDealID },
      body: JSON.stringify({
        deal: {
          amount: String(finalTotal),
          custom_field: {
            cf__products: JSON.stringify(listItems),
            cf__allocated_products: JSON.stringify(allocatedItems),
            cf__allocated_records: JSON.stringify(allocatedRecords),
            cf__global_discount: JSON.stringify(globalDiscount),
            cf_interested_products: categories,
            cf__currency: dealCurrency,
            cf__duration: maxDuration,
            cf__expire_date: expireDate,
            cf__check_change: true
          }
        }
      })
    });
  } catch (err) {
    console.error("❌ Update deal failed:", err);
  }
}

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

function getTemp(p) {
  if (!p) return 0;

  // 1. allocationValue hiện tại của sản phẩm (đã bao gồm discount riêng nếu có)
  const allocationValue = p.allocationValue;
  if (allocationValue <= 0) return 0;

  // 2. Tổng subtotal của tất cả sản phẩm
  const subtotal = listItems.reduce((sum, it) => sum + (Number(it.allocationValue) || 0), 0);
  if (subtotal <= 0) return allocationValue;

  // 3. Áp dụng global discount
  let finalTotal = allocationValue;
  if (globalDiscount.type === "percent") {
    finalTotal = allocationValue * (1 - (Number(globalDiscount.value) || 0) / 100);
  } else { // amount → giảm theo tỷ lệ
    const ratio = allocationValue / subtotal; // tỷ lệ sản phẩm
    const share = ratio * (Number(globalDiscount.value) || 0);
    finalTotal = allocationValue - share;
  }

  return Math.max(0, finalTotal);
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

function checkAllocationCoefficients() {
  const btnAllocate = document.getElementById("btn-allocate");
  if (!btnAllocate) return;

  // Nếu đã apply revenue thì luôn disable
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

async function updateRevenueRecord(body) {
  try {
    await client.request.invokeTemplate("updateDeal", {
      context: { dealID: currentDealID },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("❌ Lưu phân bổ thất bại:", err);
  }
}

function parseDDMMYYYYtoDate(s) {
  if (!s || typeof s !== "string") return null;
  const parts = s.trim().split("/");
  if (parts.length !== 3) return null;
  const day = Number(parts[0]), month = Number(parts[1]), year = Number(parts[2]);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

function formatDateToDDMMYYYY(dt) {
  if (!(dt instanceof Date) || isNaN(dt)) return "";
  const d = String(dt.getDate()).padStart(2, "0");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const y = dt.getFullYear();
  return `${d}/${m}/${y}`;
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ================= SECTION 4 =================
// ============= RENDER =============
function setInfoData(info, currentLang) {
  if (!info) return;

  // Company info
  const companyName = info.companyName;
  const companyAddr = [info.companyAddress, info.companyProvince, info.companyCountry]
    .filter(Boolean).join(", ");
  const contactName = info.contactName;
  const contactPhone = info.contactPhone;
  const contactEmail = info.contactEmail;

  // Show language
  if (currentLang === "vi") {
    document.getElementById("quoteContent-vi").style.display = "block";
    document.getElementById("quoteContent-en").style.display = "none";
  } else {
    document.getElementById("quoteContent-vi").style.display = "none";
    document.getElementById("quoteContent-en").style.display = "block";
  }

  // Inject data
  document.getElementById(`company-name-${currentLang}`).innerText = companyName;
  document.getElementById(`company-address-${currentLang}`).innerText = companyAddr;
  document.getElementById(`contact-name-${currentLang}`).innerText = contactName;
  document.getElementById(`contact-phone-${currentLang}`).innerText = contactPhone;
  document.getElementById(`contact-email-${currentLang}`).innerText = contactEmail;

  // Ngày
  const now = new Date();
  document.getElementById(`quote-date`).innerText =
    currentLang === "en"
      ? "Date: " + now.toLocaleDateString("en-US")
      : "Ngày: " + now.toLocaleDateString("vi-VN");
}

function renderQuotationList() {
  const container = document.getElementById("quotation-list");
  if (!container) return;

  if (!quoteItems.length) {
    container.innerHTML = `<p>${lang === "vi" ? "Chưa có báo giá nào." : "No quotations yet."}</p>`;
    return;
  }

  const rows = quoteItems.map((q) => {
    const rowClass = (q.status && q.status.toLowerCase() === "rejected") ? "rejected-row" : "";
    return `
      <tr class="${rowClass}">
        <td>${q.quotation_id}</td>
        <td>${q.created_at}</td>
        <td>${q.status}</td>
        <td>
        <!--
          <button class="btn btn-sm btn-outline-primary" onclick="previewQuotationById('${q.tLang}','${q.quotation_id}')">
            ${lang === "vi" ? "Xem trước" : "Preview"}
          </button>
        -->
          <button class="btn btn-sm btn-outline-primary" onclick="generatePDF('${q.tLang}','${q.quotation_id}')">
            ${lang === "vi" ? "Tải về" : "Download"}
          </button>
        </td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <table class="table table-bordered table-hover">
      <thead class="table-light">
        <tr>
          <th>${lang === "vi" ? "Mã báo giá" : "Quotation ID"}</th>
          <th>${lang === "vi" ? "Ngày tạo" : "Created At"}</th>
          <th>${lang === "vi" ? "Trạng thái" : "Status"}</th>
          <th>${lang === "vi" ? "Hành động" : "Action"}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function previewQuotationById(tLang, quotationId) {
  if (!window.currentInfo) return;

  const q = quoteItems.find(item => item.quotation_id === quotationId);
  if (!q) return;

  setInfoData(window.currentInfo, q.tLang);

  // Inject vào bảng sản phẩm
  renderProductTableById(q.tLang, q.products, q.currency, q.global_discount, q.global_discountType);

  // toggle hiển thị content
  const contentVi = document.getElementById("quoteContent-vi");
  const contentEn = document.getElementById("quoteContent-en");
  if (contentVi && contentEn) {
    contentVi.style.display = (tLang === "vi") ? "block" : "none";
    contentEn.style.display = (tLang === "en") ? "block" : "none";
  }

  const modalEl = document.getElementById("quoteModal");
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

function renderProductTableById(tLang, products, currency, globalValue = null, globalType = null) {
  const tbody = document.getElementById(`productTable-${tLang}`);
  tbody.innerHTML = "";

  if (!products || products.length === 0) return;

  let subtotal = 0;

  products.forEach(p => {
    const totalPrice = p.finalTotal;
    let discountAmount = 0;
    let discountText = "";

    // check discount type
    if (p.discountType === "percent") {
      // discount % → lấy phần trăm của totalPrice
      discountAmount = (p.discount || 0) * totalPrice / 100;
      discountText = p.discount + "%";
    } else if (p.discountType === "amount") {
      // discount số tiền cố định
      discountAmount = p.discount || 0;
      discountText = formatCurrency(discountAmount, currency);
    }
    //const totalAfter = totalPrice - discountAmount;
    subtotal += totalPrice;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="text-align:left">${p.name}</td>
      <td>${formatCurrency(p.basePrice, currency)}</td>
      <td>${p.quantity} ${p.unit}</td>
      <td>${p.duration} ${p.package}</td>
      <td>${formatCurrency(totalPrice, currency)}</td>
      <td>${discountText}</td>
      <td>${formatCurrency(p.finalTotal, currency)}</td>
    `;
    tbody.appendChild(row);
  });

  let globalDiscountValue, globalDiscountType;
  // ✅ Tính thêm global discount
  if (globalValue !== null && globalType !== null) {
    globalDiscountValue = globalValue;
    globalDiscountType = globalType;
  } else {
    globalDiscountValue = globalDiscount.value;
    globalDiscountType = globalDiscount.type;
  }

  let globalDiscountAmount = 0;
  let globalDiscountText = "";
  if (globalDiscountType === "percent") {
    globalDiscountAmount = subtotal * globalDiscountValue / 100;
    globalDiscountText = globalDiscountValue + "%";
  } else if (globalDiscountType === "amount") {
    globalDiscountAmount = globalDiscountValue;
    globalDiscountText = formatCurrency(globalDiscountValue, currency);
  }

  const total = subtotal - globalDiscountAmount;

  // render footer
  document.getElementById(`subtotalCell-${tLang}`).innerText = formatCurrency(subtotal, currency);
  document.getElementById(`globalDiscountCell-${tLang}`).innerText = globalDiscountText;
  document.getElementById(`totalCell-${tLang}`).innerHTML = `<strong>${formatCurrency(total, currency)}</strong>`;
}

// ================= SECTION 5 =================
// ============= RENDER =============
function renderQuotationTemplate() {
  const viCard = document.getElementById("card-vi");
  const enCard = document.getElementById("card-en");

  if (listItems.length === 0) {
    viCard.style.display = "none";
    enCard.style.display = "none";
  } else {
    viCard.style.display = "block";
    enCard.style.display = "block";
  }
}

function previewQuote(tLang) {
  if (!window.currentInfo) return;

  // Fill info chung
  setInfoData(window.currentInfo, tLang);

  const products = listItems || [];
  const currency = (products[0] && products[0].currency) || (tLang === 'vi' ? 'VND' : 'USD');

  if (products.length > 0) {
    renderProductTable(tLang, products, currency);
  } else {
    console.warn("⚠️ Không có sản phẩm nào để preview báo giá");
  }

  // ✅ toggle hiển thị content đúng template
  const contentVi = document.getElementById("quoteContent-vi");
  const contentEn = document.getElementById("quoteContent-en");
  if (contentVi && contentEn) {
    contentVi.style.display = (tLang === "vi") ? "block" : "none";
    contentEn.style.display = (tLang === "en") ? "block" : "none";
  }

  const modalEl = document.getElementById("quoteModal");
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

function renderProductTable(tLang, products, currency, globalValue = null, globalType = null) {
  const tbody = document.getElementById(`productTable-${tLang}`);
  tbody.innerHTML = "";

  if (!products || products.length === 0) return;

  let subtotal = 0;

  products.forEach(p => {
    const totalPrice = p.basePrice * p.quantity * p.duration;
    let discountAmount = 0;
    let discountText = "";

    // check discount type
    if (p.discountType === "percent") {
      // discount % → lấy phần trăm của totalPrice
      discountAmount = (p.discount || 0) / 100 * totalPrice;
      discountText = p.discount + "%";
    } else if (p.discountType === "amount") {
      // discount số tiền cố định
      discountAmount = p.discount || 0;
      discountText = formatCurrency(discountAmount, currency);
    }
    const totalAfter = totalPrice - discountAmount;
    subtotal += totalAfter;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="text-align:left">${p.name}</td>
      <td>${formatCurrency(p.basePrice, currency)}</td>
      <td>${p.quantity} ${p.unit}</td>
      <td>${p.duration} ${p.package}</td>
      <td>${formatCurrency(totalPrice, currency)}</td>
      <td>${discountText}</td>
      <td>${formatCurrency(totalAfter, currency)}</td>
    `;
    tbody.appendChild(row);
  });

  let globalDiscountValue, globalDiscountType;
  // ✅ Tính thêm global discount
  if (globalValue !== null && globalType !== null) {
    globalDiscountValue = globalValue;
    globalDiscountType = globalType;
  } else {
    globalDiscountValue = globalDiscount.value;
    globalDiscountType = globalDiscount.type;
  }
  let globalDiscountAmount = 0;
  let globalDiscountText = "";
  if (globalDiscountType === "percent") {
    globalDiscountAmount = subtotal * globalDiscountValue / 100;
    globalDiscountText = globalDiscountValue + "%";
  } else if (globalDiscountType === "amount") {
    globalDiscountAmount = globalDiscountValue;
    globalDiscountText = formatCurrency(globalDiscountValue, currency);
  }

  const total = subtotal - globalDiscountAmount;

  // render footer
  document.getElementById(`subtotalCell-${tLang}`).innerText = formatCurrency(subtotal, currency);
  document.getElementById(`globalDiscountCell-${tLang}`).innerText = globalDiscountText;
  document.getElementById(`totalCell-${tLang}`).innerHTML = `<strong>${formatCurrency(total, currency)}</strong>`;
}

async function createQuote(tLang) {
  window.quoteItems = window.quoteItems || [];
  window.listItems = window.listItems || [];

  if (!listItems.length) {
    showAlert(
      (tLang === "vi")
        ? "⚠ Chưa có sản phẩm nào trong listItems để tạo báo giá."
        : "⚠ No products in listItems to create quotation.",
      "warning"
    );
    return;
  }

  // 1) Tạo quotation_id: lấy số lớn nhất hiện có rồi +1, format Q001
  let maxNum = 0;
  quoteItems.forEach(q => {
    const m = String(q.quotation_id || "").match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  });
  const nextNum = maxNum + 1;
  const newId = `Q${String(nextNum).padStart(3, "0")}`;

  // 2) created_at: ISO timestamp
  const createdAt = formatDateTime(new Date());

  // 3) Map products từ listItems -> định dạng yêu cầu
  const products = listItems.map(item => {
    // basePrice lấy đúng từ item.basePrice (fallback item.basePrice)
    const basePrice = (item.basePrice ?? 0);

    // quantity và unit giữ riêng
    const quantity = item.quantity ?? "";
    const unit = item.unit ?? "";

    // duration và package giữ riêng
    const duration = item.duration ?? "";
    const pkg = item.package ?? "";

    // discount + discountType
    const discount = Number(item.discount ?? 0);
    const discountType = item.discountType ?? item.discount_type ?? "percent";

    // total: dùng item.total nếu có, ngược lại tính tạm (basePrice * qtyNum)
    const baseTotal = item.baseTotal;
    const finalTotal = item.finalTotal;

    return {
      name: item.name || item.title || "Unnamed product",
      basePrice,
      quantity,
      unit,
      duration,
      package: pkg,
      discount,
      discountType,
      finalTotal,
      baseTotal
    };
  });

  // 4) currency: lấy từ listItems[0] nếu có
  const currency = listItems[0]?.currency || listItems[0]?.currencyCode || "USD";
  const quotation = {
    quotation_id: newId,
    created_at: createdAt,
    status: "Requested",
    tLang,
    currency,
    global_discount: globalDiscount.value,
    global_discountType: globalDiscount.type,
    products
  };

  // 5) push vào quoteItems và render lại
  quoteItems.push(quotation);
  if (typeof renderQuotationList === "function") {
    renderQuotationList();
  }

  // 6) Gọi update Deal
  try {
    await client.request.invokeTemplate("updateDeal", {
      context: { dealID: currentDealID },
      body: JSON.stringify({
        deal: {
          custom_field: {
            cf__quotation_status: "Requested",
            cf__quotations: JSON.stringify(quoteItems)
          }
        }
      })
    })
  } catch (error) {
    console.error("❌ Lỗi update deal:", err);
  }

  // 7) Alert success
  showAlert(
    (lang === "vi")
      ? `🎉 Báo giá ${newId} đã được tạo thành công!`
      : `🎉 Quotation ${newId} created successfully!`,
    "success"
  );

  // 8) Move Section 4
  const navLinkSection4 = document.querySelector('[data-target="section-4"], [data-bs-target="#section-4"], a[href="#section-4"]');
  if (navLinkSection4) {
    navLinkSection4.click();
  }
  return quotation;
}

// ============= HELPER =============
function generatePDF(tLang, quotationId = null) {
  let products = [];
  let currency = "đ";

  if (quotationId) {
    // Lấy sản phẩm từ Quotation List
    const q = quoteItems.find(item => item.quotation_id === quotationId);
    if (!q) {
      console.error("❌ Không tìm thấy quotation:", quotationId);
      return;
    }
    products = q.products || [];
    currency = q.currency || "đ";
  } else {
    // Lấy sản phẩm từ Quotation Template
    products = collectProducts();
    if (products.length > 0) {
      currency = products[0].currency || "đ";
    }
  }

  // ✅ Render dữ liệu vào UI
  setInfoData(window.currentInfo, tLang, products);
  renderProductTable(tLang, products, currency);

  // ✅ Sau khi render xong, gọi convertToPDF
  convertToPDF(tLang, quotationId);
}

async function convertToPDF(tLang, quotationId = null) {
  try {
    const element = document.getElementById(`quoteContent-${tLang}`);
    const companyElement = document.getElementById(`company-name-${tLang}`);

    if (!element) {
      console.error("❌ Không tìm thấy phần tử quoteContent để tạo PDF.");
      return;
    }

    // Đảm bảo phần tử hiển thị
    element.style.fontSize = "10px";
    element.style.display = "block";
    element.style.width = "190mm"; // 210 - 20 (2 bên margin)
    element.style.maxWidth = "190mm";

    // Xác định tên file theo company + quotationId
    let company = "No_Company";
    if (companyElement) {
      company = companyElement.textContent.trim() || "No_Company";
    }

    const filename = `Quote_To_${company}_${quotationId || "template"}.pdf`;

    const opt = {
      margin: [10, 10, 10, 10], // top, left, bottom, right (mm)
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 1,  // giữ đúng font, không phóng
        useCORS: true,
        scrollY: 0
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    await html2pdf().set(opt).from(element).save();
    element.style.fontSize = "";
  } catch (err) {
    console.error("❌ Error converting to PDF:", err);
  }
}

function formatDateTime(date = new Date()) {
  const pad = (n) => n.toString().padStart(2, "0");
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const d = pad(date.getDate());
  const mo = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  return `${h}:${m}:${s} ${d}/${mo}/${y}`;
}

// // ============= UNINSTALL =============
// async function clearAllDbObjects() {
//   try {
//     console.log("🚨 Clearing specific DB objects...");

//     // Các key tĩnh
//     const staticKeys = ["marketList", "categoryList-đ", "categoryList-$"];

//     // Các key động (pricebook theo id)
//     const pricebookIds = [
//       "50000100596", "50000100595", "50000100594", "50000100593",
//       "50000100592", "50000100591", "50000100582", "50000100580",
//       "50000100563", "50000100549", "50000100544", "50000100543",
//       "50000100542", "50000100540", "50000100539", "50000100538",
//       "50000100537", "50000100536", "50000100534", "50000100533",
//       "50000100526", "50000100525", "50000100524", "50000100523",
//       "50000100522", "50000100521", "50000100520", "50000100519",
//       "50000100518", "50000100517", "50000100516", "50000100515",
//       "50000100514", "50000100513", "50000100507", "50000100505",
//       "50000100503", "50000100501", "50000100500", "50000100499",
//       "50000100486", "50000100481", "50000100480", "50000100479",
//       "50000101504"
//     ];

//     const pricebookKeys = pricebookIds.map(id => `pricebook-${id}`);

//     // Gộp tất cả key lại
//     const allKeys = [...staticKeys, ...pricebookKeys];

//     // Xóa
//     await Promise.all(allKeys.map(k => client.db.delete(k).catch(() => null)));

//     console.log("✅ Cleared DB keys:", allKeys);
//   } catch (err) {
//     console.error("❌ Error clearing DB:", err);
//   }
// }