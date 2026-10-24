/* =========================================================
   Moneta — interactions, actions and boot
   ========================================================= */

function showToast(message, type = "success") {
  const host = document.getElementById("toastHost");
  if (!host) return;
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " is-error" : ""}`;
  toast.innerHTML = `${icon(type === "error" ? "alert" : "check")}<span>${esc(message)}</span>`;
  host.appendChild(toast);

  const remove = () => {
    toast.classList.add("is-out");
    window.setTimeout(() => toast.remove(), 190);
  };

  window.setTimeout(remove, type === "error" ? 4200 : 2900);
  while (host.children.length > 3) host.firstElementChild.remove();
}

function navigate(view) {
  if (!VIEWS[view]) return;
  ui.view = view;
  const hash = `#${view}`;
  if (window.location.hash !== hash) {
    window.history.pushState({ view }, "", hash);
  }
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function togglePrivacy() {
  state.settings.hideBalances = !state.settings.hideBalances;
  saveState();
  renderApp();
}

function switchBaseCurrency(code) {
  if (!currencyByCode(code) || code === baseCurrencyCode()) return;
  const factor = rateFor(code);
  if (!factor) return;

  state.currencies.forEach((currency) => {
    currency.rate = currency.code === code ? 1 : roundRate(currency.rate / factor);
  });
  state.settings.baseCurrency = code;
  saveState();
  renderApp();
  showToast(`Base currency changed to ${code}`);
}

function updateCurrencyRate(code, value) {
  const currency = currencyByCode(code);
  if (!currency || code === baseCurrencyCode()) return;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    showToast("Enter a rate greater than zero.", "error");
    const input = document.querySelector(`[data-currency-rate="${CSS.escape(code)}"]`);
    if (input) input.value = formatRateValue(currency.rate);
    return;
  }
  currency.rate = roundRate(rate);
  saveState();
  showToast(`${code} rate updated`);
}

function setTheme(theme) {
  if (!["light", "dark", "system"].includes(theme) || theme === state.settings.theme) return;
  state.settings.theme = theme;
  saveState();
  applyTheme();
  renderApp();
  showToast(`${theme === "system" ? "System" : capitalize(theme)} theme applied`);
}

const RATES_API_BASE = "https://open.er-api.com/v6/latest";
let ratesFetching = false;

async function fetchLiveRates(button) {
  if (ratesFetching) return;
  if (!state.currencies.some((currency) => currency.code !== baseCurrencyCode())) {
    showToast("Add another currency before fetching rates.", "error");
    return;
  }

  ratesFetching = true;
  const original = button ? button.innerHTML : "";
  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `${icon("rotate", "btn-icon is-spinning")}<span>Fetching rates…</span>`;
  }

  const base = baseCurrencyCode();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${RATES_API_BASE}/${encodeURIComponent(base)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`the rate service returned ${response.status}`);
    const payload = await response.json();
    if (!payload || payload.result !== "success" || !payload.rates) {
      throw new Error("unexpected response from the rate service");
    }
    if (Number(payload.rates[base]) !== 1) {
      throw new Error(`the rate service did not return ${base} rates`);
    }

    let updated = 0;
    const missing = [];

    state.currencies.forEach((currency) => {
      if (currency.code === base) {
        currency.rate = 1;
        return;
      }
      const perBase = Number(payload.rates[currency.code]);
      if (Number.isFinite(perBase) && perBase > 0) {
        currency.rate = roundRate(1 / perBase);
        updated += 1;
      } else {
        missing.push(currency.code);
      }
    });

    state.settings.ratesUpdatedAt = new Date().toISOString();
    saveState();
    renderApp();

    if (updated) {
      const missingNote = missing.length ? ` · no data for ${missing.join(", ")}` : "";
      showToast(`Updated ${updated} rate${updated === 1 ? "" : "s"}${missingNote}`);
    } else {
      showToast("No rates were updated.", "error");
    }
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "Rate request timed out."
        : `Could not fetch rates: ${error.message}`;
    showToast(message, "error");
  } finally {
    window.clearTimeout(timeout);
    ratesFetching = false;
    if (button && button.isConnected) {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.innerHTML = original;
    }
  }
}

function confirmDeleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  const account = accountById(transaction.accountId);
  const currency = account ? account.currency : baseCurrencyCode();
  openConfirm({
    title: "Delete transaction?",
    message: `<strong>${esc(transactionTitle(transaction))}</strong> for <strong>${formatMoney(transaction.amount, currency)}</strong> will be permanently removed. Account balances will update immediately.`,
    confirmLabel: "Delete transaction",
    onConfirm: () => {
      state.transactions = state.transactions.filter((item) => item.id !== id);
      saveState();
      renderApp();
      showToast("Transaction deleted");
    }
  });
}

function confirmDeleteAccount(id) {
  const account = accountById(id);
  if (!account) return;
  const count = transactionsForAccount(id).length;
  const isCard = isCreditAccount(account);
  const message = `Delete <strong>${esc(account.name)}</strong>${count ? ` and its <strong>${count} related ${count === 1 ? "entry" : "entries"}</strong>` : ""}? This permanently removes the ${isCard ? "card" : "account"} from your ledger.`;
  openConfirm({
    title: isCard ? "Delete credit card?" : "Delete account?",
    message,
    confirmLabel: isCard ? "Delete card" : "Delete account",
    onConfirm: () => {
      state.accounts = state.accounts.filter((item) => item.id !== id);
      state.transactions = state.transactions.filter(
        (transaction) => transaction.accountId !== id && transaction.toAccountId !== id
      );
      saveState();
      renderApp();
      showToast(isCard ? "Credit card deleted" : "Account deleted");
    }
  });
}

function confirmDeleteDebt(id) {
  const debt = state.debts.find((item) => item.id === id);
  if (!debt) return;
  openConfirm({
    title: "Delete this record?",
    message: `The borrow/lend record with <strong>${esc(debt.person)}</strong> for <strong>${formatMoney(debt.amount, debt.currency)}</strong> and its payment history will be permanently removed.`,
    confirmLabel: "Delete record",
    onConfirm: () => {
      state.debts = state.debts.filter((item) => item.id !== id);
      saveState();
      renderApp();
      showToast("Record deleted");
    }
  });
}

function confirmDeletePayment(debtId, paymentId) {
  const debt = state.debts.find((item) => item.id === debtId);
  const payment = debt ? debt.payments.find((item) => item.id === paymentId) : null;
  if (!debt || !payment) return;

  openConfirm({
    title: "Delete this payment?",
    message: `The payment of <strong>${formatMoney(payment.amount, debt.currency)}</strong> on ${esc(formatLongDate(payment.date))} will be removed and the outstanding balance recalculated.`,
    confirmLabel: "Delete payment",
    onConfirm: () => {
      debt.payments = debt.payments.filter((item) => item.id !== paymentId);
      saveState();
      renderApp();
      showToast("Payment deleted");
    }
  });
}

function confirmDeleteCurrency(code) {
  const currency = currencyByCode(code);
  if (!currency) return;
  if (code === baseCurrencyCode()) {
    showToast("The base currency cannot be removed.", "error");
    return;
  }
  if (usedCurrencyCodes().has(code)) {
    showToast("This currency is used by an account or record.", "error");
    return;
  }
  openConfirm({
    title: `Remove ${code}?`,
    message: `The <strong>${esc(currency.name)}</strong> currency and its manual rate will be removed from this ledger. You can add it again later.`,
    confirmLabel: "Remove currency",
    onConfirm: () => {
      state.currencies = state.currencies.filter((item) => item.code !== code);
      saveState();
      renderApp();
      showToast(`${code} removed`);
    }
  });
}

function startCardPayment(card) {
  const owed = cardCurrentOwed(card);
  if (owed <= 0) {
    showToast("This card has no outstanding balance.");
    return;
  }

  const paymentAccounts = state.accounts.filter((account) => account.type !== "credit");
  if (!paymentAccounts.length) {
    showToast("Add a bank or cash account first.", "error");
    openAccountModal();
    return;
  }

  const preferred =
    paymentAccounts.find((account) => account.currency === card.currency) ||
    paymentAccounts.find((account) => account.currency === baseCurrencyCode()) ||
    paymentAccounts[0];
  const amountInSource = round2(convertCurrency(owed, card.currency, preferred.currency));

  openTransactionModal(null, {
    presetType: "transfer",
    presetAccountId: preferred.id,
    presetToAccountId: card.id,
    presetAmount: amountInSource,
    presetToAmount: owed
  });
}

function handleAction(action, element) {
  const id = element.dataset.id;

  switch (action) {
    case "toggle-privacy":
      togglePrivacy();
      break;

    case "add-account":
      openAccountModal();
      break;
    case "edit-account": {
      const account = accountById(id);
      if (!account) break;
      if (isCreditAccount(account)) openCardModal(account);
      else openAccountModal(account);
      break;
    }
    case "delete-account":
      closeModal();
      window.setTimeout(() => confirmDeleteAccount(id), 0);
      break;

    case "add-card":
      openCardModal();
      break;
    case "edit-card": {
      const card = accountById(id);
      if (card) openCardModal(card);
      break;
    }
    case "delete-card":
      closeModal();
      window.setTimeout(() => confirmDeleteAccount(id), 0);
      break;
    case "pay-card": {
      const card = accountById(id);
      if (!card) break;
      closeModal();
      window.setTimeout(() => startCardPayment(card), 0);
      break;
    }
    case "spend-card": {
      const card = accountById(id);
      if (!card) break;
      closeModal();
      window.setTimeout(
        () => openTransactionModal(null, { presetType: "expense", presetAccountId: card.id }),
        0
      );
      break;
    }

    case "add-txn":
      if (!state.accounts.length) {
        showToast("Add an account first.");
        openAccountModal();
      } else {
        openTransactionModal();
      }
      break;

    case "edit-txn": {
      const transaction = state.transactions.find((item) => item.id === id);
      if (transaction) openTransactionModal(transaction);
      break;
    }

    case "delete-txn":
      closeModal();
      window.setTimeout(() => confirmDeleteTransaction(id), 0);
      break;

    case "add-debt":
      openDebtModal(null, {
        direction: ui.debtFilter === "borrowed" ? "borrowed" : "lent"
      });
      break;

    case "edit-debt": {
      const debt = state.debts.find((item) => item.id === id);
      if (debt) openDebtModal(debt);
      break;
    }

    case "delete-debt":
      closeModal();
      window.setTimeout(() => confirmDeleteDebt(id), 0);
      break;

    case "pay-debt": {
      const debt = state.debts.find((item) => item.id === id);
      if (!debt) break;
      closeModal();
      window.setTimeout(() => openPaymentModal(debt), 0);
      break;
    }

    case "debt-details": {
      const debt = state.debts.find((item) => item.id === id);
      if (debt) openDebtDetails(debt);
      break;
    }

    case "delete-payment": {
      const paymentId = element.dataset.paymentId;
      closeModal();
      window.setTimeout(() => confirmDeletePayment(id, paymentId), 0);
      break;
    }

    case "filter-debts":
      ui.debtFilter = ["all", "lent", "borrowed"].includes(element.dataset.filter)
        ? element.dataset.filter
        : "all";
      renderApp();
      break;

    case "clear-filters":
      ui.filters = { search: "", type: "all", account: "all", month: "all" };
      renderApp();
      break;

    case "add-currency":
      openCurrencyModal();
      break;

    case "fetch-rates":
      fetchLiveRates(element);
      break;

    case "install-app":
      promptInstall();
      break;

    case "create-ledger-file":
      startCreateLedgerFile();
      break;

    case "open-ledger-file":
      startOpenLedgerFile();
      break;

    case "reconnect-ledger-file":
      startReconnectLedgerFile();
      break;

    case "disconnect-ledger-file":
      startDisconnectLedgerFile();
      break;

    case "download-ledger-file":
      downloadLedgerFileCopy();
      break;

    case "delete-currency":
      confirmDeleteCurrency(id);
      break;

    case "export-json":
      exportJSON();
      break;

    case "export-csv":
      exportCSV();
      break;

    case "import-json":
      document.getElementById("importFile").click();
      break;

    case "reset-data":
      confirmReset();
      break;

    default:
      break;
  }
}

/* ---------------------------------------------------------
   Backup and restore
   --------------------------------------------------------- */

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportJSON() {
  const payload = {
    app: "moneta",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: state
  };
  downloadFile(
    `moneta-backup-${todayISO()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
  showToast("Backup exported");
}

function csvCell(value) {
  const string = String(value == null ? "" : value);
  return /[",\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

function exportCSV() {
  const rows = [
    [
      "date",
      "type",
      "amount",
      "currency",
      "account",
      "category",
      "note",
      "to_account",
      "to_amount",
      "to_currency"
    ]
  ];

  sortedTransactions()
    .slice()
    .reverse()
    .forEach((transaction) => {
      const account = accountById(transaction.accountId);
      const toAccount = transaction.toAccountId ? accountById(transaction.toAccountId) : null;
      rows.push([
        transaction.date,
        transaction.type,
        transaction.amount,
        account ? account.currency : "",
        account ? account.name : "",
        transaction.category,
        transaction.note,
        toAccount ? toAccount.name : "",
        transaction.toAmount || "",
        toAccount ? toAccount.currency : ""
      ]);
    });

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadFile(`moneta-transactions-${todayISO()}.csv`, csv, "text/csv;charset=utf-8");
  showToast("CSV exported");
}

async function handleImportFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const candidate = parsed && parsed.app === "moneta" && parsed.data ? parsed.data : parsed;

    if (
      !candidate ||
      typeof candidate !== "object" ||
      (!Array.isArray(candidate.accounts) &&
        !Array.isArray(candidate.transactions) &&
        !Array.isArray(candidate.debts))
    ) {
      throw new Error("This does not look like a Moneta backup.");
    }

    const normalized = normalizeState(candidate);
    const hasExistingData =
      state.accounts.length || state.transactions.length || state.debts.length;

    const replaceData = () => {
      state = normalized;
      ui.filters = { search: "", type: "all", account: "all", month: "all" };
      ui.debtFilter = "all";
      ui.view = "overview";
      window.history.replaceState({ view: "overview" }, "", "#overview");
      saveState();
      applyTheme();
      renderApp();
      showToast("Backup restored");
    };

    if (hasExistingData) {
      openConfirm({
        title: "Replace this ledger?",
        message:
          "Importing will replace <strong>everything currently stored</strong> on this device with the backup file. Export your current data first if you need it.",
        confirmLabel: "Replace with backup",
        danger: true,
        onConfirm: replaceData
      });
    } else {
      replaceData();
    }
  } catch (error) {
    showToast(error.message || "Could not read that backup.", "error");
  } finally {
    const input = document.getElementById("importFile");
    if (input) input.value = "";
  }
}

/* ---------------------------------------------------------
   Ledger file (client-side SQLite)
   --------------------------------------------------------- */

let ledgerPromptOpen = false;

function ledgerFileErrorMessage(error) {
  if (!error) return "Could not use that file.";
  if (error.name === "AbortError") return "No file selected.";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "File access was not allowed.";
  }
  if (error.name === "NotFoundError") {
    return "The ledger file could not be found. It may have been moved, renamed or deleted.";
  }
  return error.message || "Could not use that file.";
}

function adoptLedgerFileJson(json, reason) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    showToast("The ledger file contains unreadable data.", "error");
    return;
  }

  let previous = "";
  try {
    previous = JSON.stringify(state);
  } catch (error) {
    previous = "";
  }

  state = normalizeState(parsed);
  saveState({ skipFile: true });
  applyTheme();
  renderApp();

  let changed = true;
  try {
    changed = JSON.stringify(state) !== previous;
  } catch (error) {
    changed = true;
  }

  if (reason === "opened" || changed) {
    showToast(reason === "opened" ? "Ledger loaded from file" : "Ledger restored from file");
  }
}

function handleLedgerFileChange(status, detail = {}) {
  if (detail.loadedJson) {
    adoptLedgerFileJson(detail.loadedJson, detail.reason);
    return;
  }

  if (detail.created) showToast("Ledger file created");
  if (detail.disconnected) showToast("Using browser storage again");

  if (ui.view === "settings") renderApp();
}

function promptLedgerFile() {
  if (!window.MonetaFileStorage) return;
  const status = window.MonetaFileStorage.getStatus();
  if (status.mode !== "first-run") return;

  ledgerPromptOpen = true;
  openModal({
    title: "Choose where your ledger lives",
    eyebrow: "Local database",
    subtitle:
      "Moneta can keep your whole ledger in a SQLite file on this device — a real file you can move, sync or back up.",
    body: `
      <ul class="file-prompt-list">
        <li>${icon("database")}<span><strong>Create a ledger file</strong> — Moneta writes a <code>.sqlite</code> database you choose. Changes save automatically.</span></li>
        <li>${icon("shield")}<span><strong>Browser storage</strong> — keep using the copy this browser already holds. You can create a file later in Settings.</span></li>
      </ul>
      <p class="file-prompt-note">The file stays on this device. Nothing is uploaded. Saving to a file needs Chrome or Edge on desktop; other browsers keep using browser storage.</p>`,
    submitLabel: "Create ledger file",
    cancelLabel: "Use browser storage",
    onSubmit: () => {
      startCreateLedgerFile();
      return true;
    }
  });
}

async function startCreateLedgerFile() {
  const storage = window.MonetaFileStorage;
  if (!storage || !storage.available()) {
    showToast("This browser cannot create database files.", "error");
    return;
  }
  try {
    await storage.create();
  } catch (error) {
    showToast(ledgerFileErrorMessage(error), "error");
  }
}

function hasLedgerData() {
  return state.accounts.length > 0 || state.transactions.length > 0 || state.debts.length > 0;
}

function startOpenLedgerFile() {
  const storage = window.MonetaFileStorage;
  if (!storage || !storage.available()) {
    showToast("This browser cannot open database files.", "error");
    return;
  }

  if (!hasLedgerData()) {
    runOpenLedgerFile();
    return;
  }

  openConfirm({
    title: "Open a ledger file?",
    message:
      "The file you choose replaces the ledger currently on this device. Export a backup first if you might need this copy later.",
    confirmLabel: "Choose file",
    danger: false,
    onConfirm: () => runOpenLedgerFile()
  });
}

async function runOpenLedgerFile() {
  const storage = window.MonetaFileStorage;
  try {
    await storage.open();
  } catch (error) {
    showToast(ledgerFileErrorMessage(error), "error");
  }
}

async function startReconnectLedgerFile() {
  const storage = window.MonetaFileStorage;
  if (!storage) return;
  try {
    await storage.reconnect();
  } catch (error) {
    showToast(ledgerFileErrorMessage(error), "error");
  }
}

function startDisconnectLedgerFile() {
  const storage = window.MonetaFileStorage;
  if (!storage) return;
  const name = storage.getStatus().name || "the ledger file";
  openConfirm({
    title: "Disconnect the ledger file?",
    message: `Moneta will stop saving to ${esc(name)}. The file stays on disk and this browser keeps its own copy. You can reconnect from Settings at any time.`,
    confirmLabel: "Disconnect",
    danger: true,
    onConfirm: () => {
      storage.disconnect().catch(() => {
        showToast("Could not disconnect the file.", "error");
      });
    }
  });
}

async function downloadLedgerFileCopy() {
  const storage = window.MonetaFileStorage;
  if (!storage) return;
  try {
    if (typeof storage.flush === "function") await storage.flush();
    const bytes = storage.downloadCopy();
    if (!bytes) {
      showToast("The ledger file is not open.", "error");
      return;
    }
    const status = storage.getStatus();
    const name = /\.[a-z0-9]+$/i.test(status.name || "")
      ? status.name
      : "moneta-ledger.sqlite";
    downloadFile(name, bytes, "application/vnd.sqlite3");
    showToast("Ledger file downloaded");
  } catch (error) {
    showToast("Could not export the ledger file.", "error");
  }
}

function initLedgerFileStorage() {
  const storage = window.MonetaFileStorage;
  if (!storage) return;

  storage.onChange(handleLedgerFileChange);

  storage
    .init()
    .then((status) => {
      if (!status) return;
      if (status.mode === "first-run") {
        promptLedgerFile();
      } else if (status.mode === "reconnect") {
        showToast("Reconnect your ledger file to resume saving.", "error");
      } else if (status.mode === "error") {
        showToast(status.error || "Could not open the ledger file.", "error");
      }
    })
    .catch((error) => {
      console.warn("Moneta could not start the ledger file:", error);
    });
}

/* ---------------------------------------------------------
   Install (PWA)
   --------------------------------------------------------- */

let deferredInstallPrompt = null;

function isStandaloneApp() {
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true
  );
}

function isIosDevice() {
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) ||
    (/mac/i.test(ua) && window.navigator.maxTouchPoints > 1);
}

async function promptInstall() {
  if (!deferredInstallPrompt) {
    showToast("Use your browser's install option to add Moneta.", "error");
    return;
  }
  deferredInstallPrompt.prompt();
  try {
    const choice = await deferredInstallPrompt.userChoice;
    if (choice && choice.outcome === "accepted") {
      showToast("Installing Moneta…");
    }
  } catch (error) {
    showToast("Could not start the install.", "error");
  } finally {
    deferredInstallPrompt = null;
    renderApp();
  }
}

function confirmReset() {
  openConfirm({
    title: "Delete all local data?",
    message:
      "Every account, transaction, credit card and borrow/lend record will be permanently removed from this browser and, if a ledger file is connected, from that file too. This cannot be undone unless you have exported a backup.",
    confirmLabel: "Delete everything",
    danger: true,
    onConfirm: () => {
      state = createDefaultState();
      ui.view = "overview";
      ui.debtFilter = "all";
      ui.filters = { search: "", type: "all", account: "all", month: "all" };
      window.history.replaceState({ view: "overview" }, "", "#overview");
      saveState();
      applyTheme();
      renderApp();
      showToast("Ledger cleared");
    }
  });
}

/* ---------------------------------------------------------
   Events
   --------------------------------------------------------- */

function handleDocumentClick(event) {
  const navTarget = event.target.closest("[data-nav]");
  if (navTarget && !navTarget.disabled) {
    const view = navTarget.dataset.nav;
    if (VIEWS[view]) {
      event.preventDefault();
      navigate(view);
      return;
    }
  }

  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget && !actionTarget.disabled) {
    event.preventDefault();
    handleAction(actionTarget.dataset.action, actionTarget);
  }
}

function handleDocumentInput(event) {
  if (event.target.id !== "txnSearch") return;
  const position = event.target.selectionStart;
  ui.filters.search = event.target.value;
  renderApp();
  const input = document.getElementById("txnSearch");
  if (input) {
    input.focus();
    input.setSelectionRange(position, position);
  }
}

function handleDocumentChange(event) {
  const target = event.target;

  if (target.id === "filterType") {
    ui.filters.type = target.value;
    renderApp();
    return;
  }
  if (target.id === "filterAccount") {
    ui.filters.account = target.value;
    renderApp();
    return;
  }
  if (target.id === "filterMonth") {
    ui.filters.month = target.value;
    renderApp();
    return;
  }
  if (target.id === "settingsBaseCurrency") {
    switchBaseCurrency(target.value);
    return;
  }
  if (target.id === "settingsTheme") {
    setTheme(target.value);
    return;
  }
  if (target.matches("[data-currency-rate]")) {
    updateCurrencyRate(target.dataset.currencyRate, target.value);
  }
}

function setupEvents() {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleDocumentInput);
  document.addEventListener("change", handleDocumentChange);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (ui.view === "settings") renderApp();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    renderApp();
    showToast("Moneta installed");
  });

  const importInput = document.getElementById("importFile");
  importInput.addEventListener("change", () => {
    const file = importInput.files && importInput.files[0];
    handleImportFile(file);
  });

  const dialog = document.getElementById("appModal");
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeModal();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeModal();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    if (ledgerPromptOpen) {
      ledgerPromptOpen = false;
      if (window.MonetaFileStorage) window.MonetaFileStorage.dismissPrompt();
      if (ui.view === "settings") renderApp();
    }
  });

  window.addEventListener("popstate", () => {
    const view = window.location.hash.replace("#", "");
    if (VIEWS[view]) {
      ui.view = view;
      renderApp();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (dialog.open) return;
    const tag = document.activeElement ? document.activeElement.tagName : "";
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;

    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      if (ui.view === "debts") openDebtModal();
      else if (ui.view === "accounts") openAccountModal();
      else if (ui.view === "cards") openCardModal();
      else if (state.accounts.length) openTransactionModal();
      else openAccountModal();
      return;
    }

    if (event.key === "/" && ui.view === "transactions") {
      event.preventDefault();
      const input = document.getElementById("txnSearch");
      if (input) input.focus();
    }
  });
}

function boot() {
  setupEvents();
  applyTheme();

  if (window.matchMedia) {
    const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onThemeChange = () => {
      if (state.settings.theme === "system") applyTheme();
    };
    if (typeof themeQuery.addEventListener === "function") {
      themeQuery.addEventListener("change", onThemeChange);
    } else if (typeof themeQuery.addListener === "function") {
      themeQuery.addListener(onThemeChange);
    }
  }

  const hashView = window.location.hash.replace("#", "");
  if (VIEWS[hashView]) ui.view = hashView;
  if (!window.location.hash) {
    window.history.replaceState({ view: ui.view }, "", `#${ui.view}`);
  }

  renderApp();

  initLedgerFileStorage();

  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {
        /* The app still works offline from local files without a service worker. */
      });
    });
  }
}

boot();
