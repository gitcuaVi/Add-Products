// formatter.js - Các hàm format dữ liệu
// function toNumber(text) {
//   if (!text) return 0;
//   const cleaned = text
//     .toString()
//     .replace(/\s+/g, "")
//     .replace(/[^\d.,-]/g, "")
//     .replace(/\./g, "")
//     .replace(/,/g, "")
//     .trim();
//   return Number(cleaned) || 0;
// }

function toNumber(text, currency) {
  if (!text) return 0;
  
  // Remove currency symbols and spaces
  const str = text.toString()
    .replace(/\s+/g, "")
    .replace(/[đ$€£¥₫]/gi, "")
    .trim();
  
  // Detect format based on currency or last separator
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  
  let cleaned = str;
  
  // VND format: 83.333,33 (dot = thousands, comma = decimal)
  if (currency === "đ" || currency === "VND" || currency === "₫") {
    cleaned = str
      .replace(/\./g, "")      // Remove thousand separators (dots)
      .replace(",", ".");      // Convert decimal comma to dot
  }
  // USD/International format: 1,166.667 (comma = thousands, dot = decimal)
  else if (currency === "$" || currency === "USD") {
    cleaned = str.replace(/,/g, "");  // Remove thousand separators (commas)
  }
  // Auto-detect if currency not provided
  else {
    if (lastComma > lastDot) {
      // Last separator is comma → European format (123.456,78)
      cleaned = str.replace(/\./g, "").replace(",", ".");
    } else if (lastDot > lastComma) {
      // Last separator is dot → US format (123,456.78)
      cleaned = str.replace(/,/g, "");
    } else if (lastComma === -1 && lastDot === -1) {
      // No separators
      cleaned = str;
    } else {
      // Ambiguous - default to US format
      cleaned = str.replace(/,/g, "");
    }
  }
  
  return Number(cleaned) || 0;
}

function formatCurrency(value, currency) {
  const num = Number(value) || 0;
  if (currency === "đ" || currency === "VND") {
    return `${num.toLocaleString()} đ`;
  } else {
    return `${currency || ""} ${num.toLocaleString()}`;
  }
}

function formatPrice(value, currency = "") {
  if (value === null || value === undefined || isNaN(Number(value))) return "";
  const num = Number(value);
  return num.toLocaleString('en-US') + (currency ? ` ${currency}` : '');
}

function formatUnitRange(min, max, unit) {
  if (min === null || min === "") min = 1;
  if (max === null || max === "") {
    return (lang === "vi")
      ? `Trên ${min} ${unit || ""}`
      : `Above ${min} ${unit || ""}`;
  } else {
    return `${min} - ${max} ${unit || ""}`;
  }
}

function formatPriceInput(inputEl) {
  const raw = inputEl.value.replace(/,/g, '');
  const val = parseFloat(raw);
  if (!isNaN(val)) inputEl.value = val.toLocaleString('en-US');
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

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sortByNumericValue(arr) {
  return arr.sort((a, b) => {
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return numA - numB;
  });
}