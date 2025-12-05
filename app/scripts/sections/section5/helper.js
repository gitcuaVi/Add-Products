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