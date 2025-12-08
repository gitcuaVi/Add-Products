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
    const totalPrice = p.finalTotal + p.finalTotal * p.vat / 100;
    const vatStr = `${p.vat}%`;
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
      <td>${p.quantitative} ${p.unit}</td>
      <td>${p.duration} ${p.package}</td>
      <td>${formatCurrency(totalPrice, currency)}</td>
      <td>${discountText}</td>
      <td>${vatStr}</td>
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