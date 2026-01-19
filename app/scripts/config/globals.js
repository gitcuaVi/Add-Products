let client;
let cachedTerritories = [];
let cachedMarkets = [];
let cachedCatalogs = [];
let cachedPricebook = [];
let editDrafts = []; // bản nháp khi edit
let section1EditMode = false;
let selectedMarketId = null;
let currentDealID;
let currentCompanyID;
let currentTerritory;
let contractID;
let expectedCloseDate;
let closedDate;
let facDate;
let lockRevenue = false;
let periodicity;
let market;
let lang;
let tag;
let loggedInUser;
const quoteItems = [];
let listItems = [];
let allocatedItems = [];
let allocatedRecords = [];
let expandedAllocatedRecords = [];
const products = [];
let dealType = null;
const globalDiscount = { value: 0, type: "percent" };
const AMBIGUOUS_AS_DDMM = true;
const heSoMap = {
  opportunity: {
    "Lần đầu": 125, "New": 125,
    "Sự cố": 30, "Incident": 30,
    "Gia hạn": 50, "Renewal": 50,
    "Gia hạn_GOV": 70, "Renewal_GOV": 70,
    "Bán thêm": 100, "Upsale": 100,
    "Độc lập": 30, "Dependent": 30,
    "Phụ thuộc": 0, "Independent": 0,
    "SI": "SI", "Unknown": 100
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
const role = {
  Admin: 50000449630,
  AccountAdmin: 50000449631,
  Manager: 50000506494,
  AmManager: 50000522191,
  AM: 50000504129,
};
const navLabels = {
  en: {
    section1: "Product List",
    section2: "Find Product",
    section3: "Revenue Allocation",
    section4: "Quotation List",
    section5: "Quotation Template"
  },
  vi: {
    section1: "Danh sách sản phẩm",
    section2: "Tìm sản phẩm",
    section3: "Phân bổ doanh thu",
    section4: "Danh sách báo giá",
    section5: "Mẫu báo giá"
  }
};