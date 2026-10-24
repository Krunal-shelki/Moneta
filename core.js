/* =========================================================
   Moneta — private, offline money manager
   Core: constants, storage, calculations and formatting.
   Everything is stored in localStorage. No network requests.
   ========================================================= */

"use strict";

const STORAGE_KEY = "moneta.ledger.v1";
const APP_VERSION = 1;

const DEFAULT_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", rate: 1 },
  { code: "EUR", name: "Euro", symbol: "€", rate: 1.08 },
  { code: "GBP", name: "British Pound", symbol: "£", rate: 1.27 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", rate: 0.012 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", rate: 0.2723 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", rate: 0.0067 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", rate: 0.73 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", rate: 0.66 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", rate: 0.74 },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", rate: 1.12 },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥", rate: 0.138 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", rate: 0.61 }
];

const ACCOUNT_TYPES = {
  checking: { label: "Checking", icon: "bank" },
  savings: { label: "Savings", icon: "piggy" },
  cash: { label: "Cash", icon: "cash" },
  wallet: { label: "Digital wallet", icon: "wallet" },
  investment: { label: "Investment", icon: "trend" }
};

const ACCOUNT_COLORS = [
  "#2f6b53",
  "#4b708d",
  "#8a6a3a",
  "#875775",
  "#617046",
  "#aa5a45",
  "#536e68"
];

const CARD_THEMES = {
  forest: { label: "Forest", from: "#23513f", to: "#102d24" },
  midnight: { label: "Midnight", from: "#293b5c", to: "#121b2c" },
  clay: { label: "Clay", from: "#8c4634", to: "#55251d" },
  plum: { label: "Plum", from: "#5e3b5b", to: "#2e1c2d" },
  sand: { label: "Sand", from: "#9b783f", to: "#624b24" }
};

const CATEGORY_META = {
  "Groceries": { icon: "bag", color: "#5f8050" },
  "Dining": { icon: "cup", color: "#b47445" },
  "Transport": { icon: "car", color: "#4d708d" },
  "Shopping": { icon: "bag", color: "#8d5f7c" },
  "Bills & utilities": { icon: "receipt", color: "#9b7b39" },
  "Rent": { icon: "home", color: "#75624d" },
  "Health": { icon: "heart", color: "#a9524e" },
  "Entertainment": { icon: "ticket", color: "#6c5d99" },
  "Travel": { icon: "plane", color: "#427c78" },
  "Subscriptions": { icon: "repeat", color: "#8a6b4a" },
  "Education": { icon: "book", color: "#4e6d97" },
  "Fees": { icon: "card", color: "#777f79" },
  "Salary": { icon: "briefcase", color: "#2f7a5d" },
  "Freelance": { icon: "laptop", color: "#40748f" },
  "Business": { icon: "building", color: "#7e623c" },
  "Investments": { icon: "trend", color: "#5d7c44" },
  "Gifts": { icon: "gift", color: "#9a5277" },
  "Refunds": { icon: "rotate", color: "#637b8b" },
  "Other": { icon: "dot", color: "#7c837e" }
};

const EXPENSE_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Bills & utilities",
  "Rent",
  "Health",
  "Entertainment",
  "Travel",
  "Subscriptions",
  "Education",
  "Fees",
  "Other"
];

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Investments",
  "Gifts",
  "Refunds",
  "Other"
];

const SPEND_COLORS = ["#2f6b53", "#b47445", "#4d708d", "#875775", "#8a6a3a", "#6c5d99", "#7c837e"];

const VIEWS = {
  overview: {
    title: "Overview",
    subtitle: "A calm view of everything you own and owe."
  },
  transactions: {
    title: "Activity",
    subtitle: "Every expense, income and transfer in one place."
  },
  accounts: {
    title: "Accounts",
    subtitle: "Cash, bank accounts, wallets and investments."
  },
  debts: {
    title: "Borrow & lend",
    subtitle: "Keep personal loans and favours straight."
  },
  cards: {
    title: "Credit cards",
    subtitle: "Balances, limits and payments, all offline."
  },
  settings: {
    title: "Settings",
    subtitle: "Manual currencies, rates and local backups."
  }
};

/* ---------------------------------------------------------
   Inline icons
   --------------------------------------------------------- */

const ICON_PATHS = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  activity: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h12"/><circle cx="19" cy="18" r="2"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5"/><path d="M16 13h3"/>',
  handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/>',
  settings: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  eye: '<path d="M2.2 12S5.5 5.8 12 5.8 21.8 12 21.8 12 18.5 18.2 12 18.2 2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 9.8 6 9.8 6a17 17 0 0 1-2.4 3.1"/><path d="M6.6 6.6A17.5 17.5 0 0 0 2.2 12S5.5 18 12 18a9.6 9.6 0 0 0 4.1-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  arrowDownLeft: '<path d="M17 7 7 17"/><path d="M16 17H7V8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  bank: '<path d="M3 9 12 3l9 6"/><path d="M5 10v8"/><path d="M9 10v8"/><path d="M15 10v8"/><path d="M19 10v8"/><path d="M3 21h18"/><path d="M2 18h20"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9h.01"/><path d="M18 15h.01"/>',
  piggy: '<path d="M19 9h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1"/><path d="M15 5H9a7 7 0 0 0-7 7v2a5 5 0 0 0 5 5h8a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4Z"/><path d="M6 10h.01"/><path d="M9 19v2"/><path d="M16 19v2"/><path d="M18 12h-2"/>',
  trend: '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  arrows: '<path d="M7 7h11"/><path d="m15 4 3 3-3 3"/><path d="M17 17H6"/><path d="m9 20-3-3 3-3"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 21h14"/>',
  shield: '<path d="M12 22s8-3.8 8-10V5l-8-3-8 3v7c0 6.2 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/><path d="m5 14 .7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  bag: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  cup: '<path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 9h2a2 2 0 0 1 0 4h-2"/><path d="M4 21h13"/>',
  car: '<path d="m5 16-1-5 2-5h12l2 5-1 5"/><path d="M4 11h16"/><path d="M5 16h14v3H5z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
  receipt: '<path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1 2-1V3l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/>',
  ticket: '<path d="M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 1 0-6V6H3v3Z"/><path d="M13 6v3"/><path d="M13 15v3"/>',
  plane: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/>',
  repeat: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M5 12v9h14v-9"/><path d="M12 8H7.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8Z"/><path d="M12 8h4.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8Z"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  dot: '<circle cx="12" cy="12" r="8"/>',
  laptop: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'
};

function icon(name, className = "") {
  const path = ICON_PATHS[name] || ICON_PATHS.dot;
  return `<svg${className ? ` class="${className}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/* ---------------------------------------------------------
   Small utilities
   --------------------------------------------------------- */

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

function uid(prefix = "id") {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function round2(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundRate(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Number(Number(value).toPrecision(8));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value == null ? "" : value).replace(/,/g, "").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function pad2(number) {
  return String(number).padStart(2, "0");
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayISO() {
  return toISODate(new Date());
}

function parseISODate(value) {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date;
      }
    } else {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return new Date();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonthISO(date = new Date()) {
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonthISO(date = new Date()) {
  return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function daysBetween(fromISO, toISOString) {
  const a = startOfDay(parseISODate(fromISO));
  const b = startOfDay(parseISODate(toISOString));
  return Math.round((b - a) / 86400000);
}

function formatDate(value, options = {}) {
  const date = typeof value === "string" ? parseISODate(value) : value;
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatShortDate(value) {
  return formatDate(value, { day: "numeric", month: "short" });
}

function formatLongDate(value) {
  return formatDate(value, { day: "numeric", month: "long", year: "numeric" });
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return formatDate(new Date(year, month - 1, 1), { month: "long", year: "numeric" });
}

function dateGroupLabel(value) {
  const today = todayISO();
  if (value === today) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (value === toISODate(yesterday)) return "Yesterday";
  return formatDate(value, { weekday: "long", day: "numeric", month: "long" });
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function truncate(value, length) {
  const string = String(value || "");
  return string.length > length ? `${string.slice(0, length - 1)}…` : string;
}

/* ---------------------------------------------------------
   State
   --------------------------------------------------------- */

function createDefaultState() {
  return {
    version: APP_VERSION,
    createdAt: new Date().toISOString(),
    settings: {
      baseCurrency: "USD",
      hideBalances: false,
      theme: "system",
      ratesUpdatedAt: ""
    },
    currencies: DEFAULT_CURRENCIES.map((currency) => ({ ...currency })),
    accounts: [],
    transactions: [],
    debts: []
  };
}

function normalizeState(raw) {
  const fallback = createDefaultState();
  if (!raw || typeof raw !== "object") return fallback;

  const rawCurrencies = Array.isArray(raw.currencies) ? raw.currencies : fallback.currencies;
  const currencies = [];
  const seenCodes = new Set();

  rawCurrencies.forEach((currency) => {
    const code = String(currency && currency.code ? currency.code : "").trim().toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(code) || seenCodes.has(code)) return;
    const rate = Number(currency.rate);
    if (!Number.isFinite(rate) || rate <= 0) return;
    seenCodes.add(code);
    currencies.push({
      code,
      name: String(currency.name || code).slice(0, 50),
      symbol: String(currency.symbol || code).slice(0, 6),
      rate
    });
  });

  if (!currencies.length) {
    currencies.push(...fallback.currencies.map((currency) => ({ ...currency })));
  }

  let baseCurrency = raw.settings && raw.settings.baseCurrency;
  if (!currencies.some((currency) => currency.code === baseCurrency)) {
    baseCurrency = currencies[0].code;
  }
  currencies.forEach((currency) => {
    if (currency.code === baseCurrency) currency.rate = 1;
  });

  const accounts = [];
  const accountIds = new Set();
  const rawAccounts = Array.isArray(raw.accounts) ? raw.accounts : [];

  rawAccounts.forEach((account) => {
    if (!account || typeof account !== "object") return;
    const type = String(account.type || "checking");
    if (!ACCOUNT_TYPES[type] && type !== "credit") return;
    const currency = String(account.currency || baseCurrency).toUpperCase();
    if (!currencies.some((item) => item.code === currency)) return;

    const id = String(account.id || uid("acc"));
    if (accountIds.has(id)) return;
    accountIds.add(id);

    const openingBalance = Number(account.openingBalance);
    const color = /^#[0-9a-f]{6}$/i.test(String(account.color)) ? account.color : ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length];

    const item = {
      id,
      name: String(account.name || "Account").slice(0, 80),
      type,
      currency,
      openingBalance: Number.isFinite(openingBalance) ? openingBalance : 0,
      color,
      createdAt: account.createdAt || new Date().toISOString()
    };

    if (type === "credit") {
      const limit = Number(account.limit);
      const dueDay = Number(account.dueDay);
      const minPayment = Number(account.minPayment);
      const apr = Number(account.apr);
      item.name = String(account.name || "Credit card").slice(0, 80);
      item.issuer = String(account.issuer || "").slice(0, 50);
      item.last4 = String(account.last4 || "").replace(/\D/g, "").slice(0, 4);
      item.limit = Number.isFinite(limit) && limit >= 0 ? limit : 0;
      item.dueDay = Number.isFinite(dueDay) ? clamp(Math.round(dueDay), 1, 31) : 1;
      item.minPayment = Number.isFinite(minPayment) && minPayment >= 0 ? minPayment : 0;
      item.apr = Number.isFinite(apr) && apr >= 0 ? apr : 0;
      item.theme = CARD_THEMES[account.theme] ? account.theme : "forest";
    }

    accounts.push(item);
  });

  const transactions = [];
  const rawTransactions = Array.isArray(raw.transactions) ? raw.transactions : [];

  rawTransactions.forEach((transaction) => {
    if (!transaction || typeof transaction !== "object") return;
    const type = String(transaction.type || "");
    if (!["expense", "income", "transfer"].includes(type)) return;
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const accountId = String(transaction.accountId || "");
    if (!accountIds.has(accountId)) return;
    const date = String(transaction.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    const item = {
      id: String(transaction.id || uid("txn")),
      type,
      amount,
      accountId,
      category: String(transaction.category || "Other").slice(0, 60),
      date,
      note: String(transaction.note || "").slice(0, 160),
      createdAt: transaction.createdAt || new Date().toISOString()
    };

    if (type === "transfer") {
      const toAccountId = String(transaction.toAccountId || "");
      if (!accountIds.has(toAccountId) || toAccountId === accountId) return;
      const toAmount = Number(transaction.toAmount);
      if (!Number.isFinite(toAmount) || toAmount <= 0) return;
      item.toAccountId = toAccountId;
      item.toAmount = toAmount;
      item.category = "Transfer";
    }

    transactions.push(item);
  });

  const debts = [];
  const rawDebts = Array.isArray(raw.debts) ? raw.debts : [];

  rawDebts.forEach((debt) => {
    if (!debt || typeof debt !== "object") return;
    const direction = debt.direction === "borrowed" ? "borrowed" : "lent";
    const amount = Number(debt.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const currency = String(debt.currency || baseCurrency).toUpperCase();
    if (!currencies.some((item) => item.code === currency)) return;
    const date = String(debt.date || todayISO());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    const payments = [];
    const rawPayments = Array.isArray(debt.payments) ? debt.payments : [];
    rawPayments.forEach((payment) => {
      if (!payment || typeof payment !== "object") return;
      const paymentAmount = Number(payment.amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return;
      payments.push({
        id: String(payment.id || uid("pay")),
        amount: paymentAmount,
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(payment.date)) ? String(payment.date) : todayISO(),
        note: String(payment.note || "").slice(0, 120),
        createdAt: payment.createdAt || new Date().toISOString()
      });
    });

    debts.push({
      id: String(debt.id || uid("debt")),
      direction,
      person: String(debt.person || "Someone").slice(0, 80),
      amount,
      currency,
      date,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(debt.dueDate)) ? String(debt.dueDate) : "",
      note: String(debt.note || "").slice(0, 200),
      payments,
      createdAt: debt.createdAt || new Date().toISOString()
    });
  });

  return {
    version: APP_VERSION,
    createdAt: raw.createdAt || new Date().toISOString(),
    settings: {
      baseCurrency,
      hideBalances: Boolean(raw.settings && raw.settings.hideBalances),
      theme: ["light", "dark", "system"].includes(raw.settings && raw.settings.theme)
        ? raw.settings.theme
        : "system",
      ratesUpdatedAt:
        raw.settings && typeof raw.settings.ratesUpdatedAt === "string"
          ? raw.settings.ratesUpdatedAt
          : ""
    },
    currencies,
    accounts,
    transactions,
    debts
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Moneta could not read local data:", error);
    return createDefaultState();
  }
}

let state = loadState();

const ui = {
  view: "overview",
  debtFilter: "all",
  filters: {
    search: "",
    type: "all",
    account: "all",
    month: "all"
  }
};

let balanceCache = null;

function saveState(options = {}) {
  balanceCache = null;

  if (!options.skipFile && window.MonetaFileStorage) {
    try {
      window.MonetaFileStorage.scheduleSave(state);
    } catch (error) {
      console.warn("Moneta could not schedule the ledger file save:", error);
    }
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("Moneta could not save local data:", error);
    const fileConnected =
      window.MonetaFileStorage &&
      window.MonetaFileStorage.getStatus().mode === "file";
    showToast(
      fileConnected
        ? "The browser copy could not be saved; the ledger file is still in use."
        : "Could not save — local storage may be full.",
      "error"
    );
    return false;
  }
}

/* ---------------------------------------------------------
   Appearance
   --------------------------------------------------------- */

function systemPrefersDark() {
  return Boolean(
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolvedTheme() {
  const preference = state.settings.theme;
  if (preference === "dark" || preference === "light") return preference;
  return systemPrefersDark() ? "dark" : "light";
}

function applyTheme() {
  const theme = resolvedTheme();
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "dark" ? "dark" : "light";

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", theme === "dark" ? "#101411" : "#13251d");
  }

  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (schemeMeta) {
    schemeMeta.setAttribute("content", theme === "dark" ? "dark" : "light");
  }
}

/* ---------------------------------------------------------
   Currency helpers
   --------------------------------------------------------- */

function currencyByCode(code) {
  return state.currencies.find((currency) => currency.code === code) || null;
}

function baseCurrencyCode() {
  return state.settings.baseCurrency;
}

function baseCurrency() {
  return currencyByCode(baseCurrencyCode()) || state.currencies[0];
}

function rateFor(code) {
  const currency = currencyByCode(code);
  return currency && currency.rate > 0 ? currency.rate : 0;
}

function toBase(amount, code) {
  const rate = rateFor(code);
  return Number.isFinite(Number(amount)) ? Number(amount) * rate : 0;
}

function convertCurrency(amount, fromCode, toCode) {
  const fromRate = rateFor(fromCode);
  const toRate = rateFor(toCode);
  if (!fromRate || !toRate) return 0;
  return (Number(amount) * fromRate) / toRate;
}

function formatRateValue(value) {
  if (!Number.isFinite(value)) return "0";
  return String(Number(value.toPrecision(6)));
}

function formatMoney(amount, code, options = {}) {
  const value = Number(amount) || 0;
  if (state.settings.hideBalances && !options.force) return "••••••";

  const currency = currencyByCode(code);
  const currencyCode = currency ? currency.code : String(code || baseCurrencyCode());
  const sign = options.signed && value > 0 ? "+" : "";

  try {
    const formatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2
    }).format(value);
    return `${sign}${formatted}`;
  } catch (error) {
    const number = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    const symbol = currency && currency.symbol ? currency.symbol : "";
    return `${sign}${value < 0 ? "-" : ""}${symbol}${number.replace("-", "")} ${currencyCode}`;
  }
}

function formatBase(amount) {
  return formatMoney(amount, baseCurrencyCode());
}

function formatSignedBase(amount) {
  return formatMoney(amount, baseCurrencyCode(), { signed: true });
}

function maskIfPrivate(value) {
  return state.settings.hideBalances ? "••••" : value;
}

/* ---------------------------------------------------------
   Derived data
   --------------------------------------------------------- */

function getBalances() {
  if (balanceCache) return balanceCache;
  const balances = {};
  state.accounts.forEach((account) => {
    balances[account.id] = Number(account.openingBalance) || 0;
  });

  state.transactions.forEach((transaction) => {
    if (transaction.type === "income") {
      balances[transaction.accountId] = (balances[transaction.accountId] || 0) + transaction.amount;
    } else if (transaction.type === "expense") {
      balances[transaction.accountId] = (balances[transaction.accountId] || 0) - transaction.amount;
    } else if (transaction.type === "transfer") {
      balances[transaction.accountId] = (balances[transaction.accountId] || 0) - transaction.amount;
      balances[transaction.toAccountId] = (balances[transaction.toAccountId] || 0) + transaction.toAmount;
    }
  });

  Object.keys(balances).forEach((key) => {
    balances[key] = round2(balances[key]);
  });

  balanceCache = balances;
  return balances;
}

function accountById(id) {
  return state.accounts.find((account) => account.id === id) || null;
}

function accountName(id) {
  const account = accountById(id);
  return account ? account.name : "Deleted account";
}

function accountCurrency(id) {
  const account = accountById(id);
  return account ? account.currency : baseCurrencyCode();
}

function isCreditAccount(account) {
  return Boolean(account && account.type === "credit");
}

function assetAccounts() {
  return state.accounts.filter((account) => account.type !== "credit");
}

function creditAccounts() {
  return state.accounts.filter((account) => account.type === "credit");
}

function accountTypeLabel(account) {
  if (!account) return "";
  if (account.type === "credit") return "Credit card";
  return ACCOUNT_TYPES[account.type] ? ACCOUNT_TYPES[account.type].label : "Account";
}

function accountIcon(account) {
  if (!account) return "wallet";
  if (account.type === "credit") return "card";
  return ACCOUNT_TYPES[account.type] ? ACCOUNT_TYPES[account.type].icon : "wallet";
}

function getNetWorth() {
  const balances = getBalances();
  return round2(
    state.accounts.reduce((total, account) => total + toBase(balances[account.id] || 0, account.currency), 0)
  );
}

function transactionBaseDelta(transaction) {
  const account = accountById(transaction.accountId);
  if (!account) return 0;
  if (transaction.type === "income") return toBase(transaction.amount, account.currency);
  if (transaction.type === "expense") return -toBase(transaction.amount, account.currency);
  if (transaction.type === "transfer") {
    const toAccount = accountById(transaction.toAccountId);
    if (!toAccount) return 0;
    return toBase(transaction.toAmount, toAccount.currency) - toBase(transaction.amount, account.currency);
  }
  return 0;
}

function netWorthAt(endISO) {
  const current = getNetWorth();
  const laterDelta = state.transactions
    .filter((transaction) => transaction.date > endISO)
    .reduce((total, transaction) => total + transactionBaseDelta(transaction), 0);
  return round2(current - laterDelta);
}

function netWorthSeries() {
  const now = new Date();
  const points = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const isCurrent = offset === 0;
    const endDate = isCurrent ? now : new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
    points.push({
      label: formatDate(monthDate, { month: "short" }),
      value: netWorthAt(toISODate(endDate))
    });
  }
  return points;
}

function getMonthStats(date = new Date()) {
  const start = startOfMonthISO(date);
  const end = endOfMonthISO(date);
  let income = 0;
  let expense = 0;

  state.transactions.forEach((transaction) => {
    if (transaction.date < start || transaction.date > end) return;
    const account = accountById(transaction.accountId);
    if (!account) return;
    if (transaction.type === "income") income += toBase(transaction.amount, account.currency);
    if (transaction.type === "expense") expense += toBase(transaction.amount, account.currency);
  });

  return {
    income: round2(income),
    expense: round2(expense),
    net: round2(income - expense),
    start,
    end
  };
}

function getSpendingBreakdown(date = new Date()) {
  const start = startOfMonthISO(date);
  const end = endOfMonthISO(date);
  const totals = new Map();

  state.transactions.forEach((transaction) => {
    if (transaction.type !== "expense") return;
    if (transaction.date < start || transaction.date > end) return;
    const account = accountById(transaction.accountId);
    if (!account) return;
    const key = transaction.category || "Other";
    totals.set(key, (totals.get(key) || 0) + toBase(transaction.amount, account.currency));
  });

  return Array.from(totals.entries())
    .map(([name, value], index) => ({
      name,
      value: round2(value),
      color: CATEGORY_META[name] ? CATEGORY_META[name].color : SPEND_COLORS[index % SPEND_COLORS.length]
    }))
    .sort((a, b) => b.value - a.value);
}

function getCashFlowSeries() {
  const now = new Date();
  const months = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      key: `${monthDate.getFullYear()}-${pad2(monthDate.getMonth() + 1)}`,
      label: formatDate(monthDate, { month: "short" }),
      income: 0,
      expense: 0
    });
  }

  state.transactions.forEach((transaction) => {
    if (transaction.type !== "income" && transaction.type !== "expense") return;
    const account = accountById(transaction.accountId);
    if (!account) return;
    const key = transaction.date.slice(0, 7);
    const month = months.find((item) => item.key === key);
    if (!month) return;
    const amount = toBase(transaction.amount, account.currency);
    if (transaction.type === "income") month.income += amount;
    else month.expense += amount;
  });

  months.forEach((month) => {
    month.income = round2(month.income);
    month.expense = round2(month.expense);
  });

  return months;
}

function debtPaid(debt) {
  return round2((debt.payments || []).reduce((total, payment) => total + payment.amount, 0));
}

function debtOutstanding(debt) {
  return Math.max(0, round2(debt.amount - debtPaid(debt)));
}

function debtProgress(debt) {
  if (!debt.amount) return 0;
  return clamp((debtPaid(debt) / debt.amount) * 100, 0, 100);
}

function getDebtTotals() {
  let lent = 0;
  let borrowed = 0;
  let openLent = 0;
  let openBorrowed = 0;
  let overdue = 0;

  state.debts.forEach((debt) => {
    const outstanding = debtOutstanding(debt);
    if (outstanding <= 0) return;
    if (debt.direction === "lent") {
      lent += toBase(outstanding, debt.currency);
      openLent += 1;
    } else {
      borrowed += toBase(outstanding, debt.currency);
      openBorrowed += 1;
    }
    if (debt.dueDate && debt.dueDate < todayISO()) overdue += 1;
  });

  return {
    lent: round2(lent),
    borrowed: round2(borrowed),
    net: round2(lent - borrowed),
    openLent,
    openBorrowed,
    overdue
  };
}

function cardCurrentOwed(card) {
  const balance = getBalances()[card.id] || 0;
  return round2(Math.max(0, -balance));
}

function cardPaidAmount(card) {
  const balance = getBalances()[card.id] || 0;
  return balance > 0 ? round2(balance) : 0;
}

function cardMinimumDue(card) {
  const owed = cardCurrentOwed(card);
  if (owed <= 0) return 0;
  const fixed = Number(card.minPayment) || 0;
  return round2(Math.min(owed, fixed > 0 ? fixed : owed * 0.02));
}

function cardNextDueDate(card) {
  const today = startOfDay(new Date());
  const dueDay = clamp(Number(card.dueDay) || 1, 1, 31);
  let year = today.getFullYear();
  let month = today.getMonth();
  let day = Math.min(dueDay, daysInMonth(year, month));
  let date = new Date(year, month, day);
  if (date < today) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    day = Math.min(dueDay, daysInMonth(year, month));
    date = new Date(year, month, day);
  }
  return date;
}

function getCardTotals() {
  let owed = 0;
  let limit = 0;
  let minimum = 0;
  let nextDue = null;

  creditAccounts().forEach((card) => {
    const cardOwed = cardCurrentOwed(card);
    owed += toBase(cardOwed, card.currency);
    limit += toBase(Number(card.limit) || 0, card.currency);
    minimum += toBase(cardMinimumDue(card), card.currency);
    if (cardOwed > 0) {
      const due = cardNextDueDate(card);
      if (!nextDue || due < nextDue) nextDue = due;
    }
  });

  return {
    owed: round2(owed),
    limit: round2(limit),
    available: round2(Math.max(0, limit - owed)),
    minimum: round2(minimum),
    utilization: limit > 0 ? Math.min(100, (owed / limit) * 100) : 0,
    nextDue
  };
}

function transactionTitle(transaction) {
  if (transaction.type === "transfer") {
    return `Transfer to ${accountName(transaction.toAccountId)}`;
  }
  if (transaction.note && transaction.note.trim()) return transaction.note.trim();
  return transaction.category || (transaction.type === "income" ? "Income" : "Expense");
}

function transactionMeta(transaction) {
  const account = accountById(transaction.accountId);
  if (transaction.type === "transfer") {
    return `${accountName(transaction.accountId)} → ${accountName(transaction.toAccountId)}`;
  }
  const typeLabel = transaction.type === "income" ? "Income" : "Expense";
  const cardLabel = isCreditAccount(account) ? " · Credit card" : "";
  return `${transaction.category || typeLabel} · ${account ? account.name : "Account"}${cardLabel}`;
}

function transactionVisual(transaction) {
  if (transaction.type === "transfer") {
    return { icon: "arrows", color: "#4b708d" };
  }
  const meta = CATEGORY_META[transaction.category] || CATEGORY_META.Other;
  return { icon: meta.icon, color: meta.color };
}

function sortedTransactions(list = state.transactions) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function transactionsForAccount(accountId) {
  return state.transactions.filter(
    (transaction) => transaction.accountId === accountId || transaction.toAccountId === accountId
  );
}

function usedCurrencyCodes() {
  const codes = new Set();
  state.accounts.forEach((account) => codes.add(account.currency));
  state.debts.forEach((debt) => codes.add(debt.currency));
  return codes;
}

function debtStatus(debt) {
  const outstanding = debtOutstanding(debt);
  if (outstanding <= 0) return { label: "Settled", className: "is-settled" };
  if (!debt.dueDate) return { label: "Open", className: "" };

  const days = daysBetween(todayISO(), debt.dueDate);
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, className: "is-overdue" };
  if (days === 0) return { label: "Due today", className: "is-soon" };
  if (days <= 7) return { label: `${days}d left`, className: "is-soon" };
  return { label: `Due ${formatShortDate(debt.dueDate)}`, className: "" };
}

function categoryOptionsFor(type) {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function categoryMeta(name) {
  return CATEGORY_META[name] || CATEGORY_META.Other;
}

function monthOptionsFromTransactions() {
  const keys = Array.from(new Set(state.transactions.map((transaction) => transaction.date.slice(0, 7))));
  keys.sort((a, b) => (a < b ? 1 : -1));
  return keys.map((key) => ({ key, label: formatMonthLabel(key) }));
}

function filteredTransactions() {
  const query = ui.filters.search.trim().toLowerCase();
  const { type, account, month } = ui.filters;

  return sortedTransactions().filter((transaction) => {
    if (type !== "all" && transaction.type !== type) return false;
    if (account !== "all" && transaction.accountId !== account && transaction.toAccountId !== account) return false;
    if (month !== "all" && transaction.date.slice(0, 7) !== month) return false;
    if (!query) return true;
    const haystack = [
      transaction.note,
      transaction.category,
      accountName(transaction.accountId),
      transaction.toAccountId ? accountName(transaction.toAccountId) : "",
      String(transaction.amount)
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function dataCounts() {
  return {
    accounts: state.accounts.length,
    transactions: state.transactions.length,
    debts: state.debts.length,
    currencies: state.currencies.length
  };
}
