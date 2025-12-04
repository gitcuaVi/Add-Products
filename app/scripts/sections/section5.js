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