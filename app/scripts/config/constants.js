// constants.js - Các hằng số và biến global
let client;
let cachedTerritories = [];
let cachedMarkets = [];
let cachedCatalogs = [];
let cachedPricebook = [];
let editDrafts = [];
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

// mappings.js - Các mapping data
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