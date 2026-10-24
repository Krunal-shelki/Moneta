/* =========================================================
   Moneta — views (borrow & lend, credit cards, settings)
   ========================================================= */

function debtCardHTML(debt) {
  const outstanding = debtOutstanding(debt);
  const paid = debtPaid(debt);
  const progress = debtProgress(debt);
  const status = debtStatus(debt);
  const baseValue = toBase(outstanding, debt.currency);
  const isLent = debt.direction === "lent";
  const color = isLent ? "#2f6b53" : "#b9523c";

  return `
    <article class="debt-card${outstanding <= 0 ? " is-settled" : ""}" style="--debt-color:${color}">
      <div class="debt-card-head">
        <span class="person-avatar">${esc(initials(debt.person))}</span>
        <div class="debt-person">
          <h3>${esc(debt.person)}</h3>
          <p>${isLent ? "You lent money" : "You borrowed money"} · ${esc(formatShortDate(debt.date))}</p>
        </div>
        <span class="status-badge ${status.className}">${esc(status.label)}</span>
      </div>
      <div class="debt-amount">
        <span>${outstanding > 0 ? (isLent ? "Still owed to you" : "Still to repay") : "Fully settled"}</span>
        <strong>${formatMoney(outstanding, debt.currency)}</strong>
        ${debt.currency !== baseCurrencyCode() ? `<small>≈ ${formatBase(baseValue)}</small>` : `<small>${outstanding > 0 ? (isLent ? "Receivable" : "Payable") : "Settled"}</small>`}
      </div>
      <div class="debt-progress"><i style="width:${progress}%"></i></div>
      <div class="debt-meta">
        <span>${formatMoney(paid, debt.currency)} paid of ${formatMoney(debt.amount, debt.currency)}</span>
        <span>${debt.dueDate ? `Due ${esc(formatShortDate(debt.dueDate))}` : "No due date"}</span>
      </div>
      <div class="debt-foot">
        <button class="btn ${outstanding > 0 ? "btn-secondary" : "btn-ghost"}" type="button" data-action="pay-debt" data-id="${esc(debt.id)}"${outstanding <= 0 ? " disabled" : ""}>
          ${outstanding > 0 ? "Record payment" : "Settled"}
        </button>
        <span class="spacer"></span>
        <button class="debt-icon-btn" type="button" data-action="debt-details" data-id="${esc(debt.id)}" aria-label="View details for ${esc(debt.person)}" title="Details">${icon("activity")}</button>
        <button class="debt-icon-btn" type="button" data-action="edit-debt" data-id="${esc(debt.id)}" aria-label="Edit record for ${esc(debt.person)}" title="Edit">${icon("edit")}</button>
        <button class="debt-icon-btn is-delete" type="button" data-action="delete-debt" data-id="${esc(debt.id)}" aria-label="Delete record for ${esc(debt.person)}" title="Delete">${icon("trash")}</button>
      </div>
    </article>`;
}

function renderDebts() {
  const totals = getDebtTotals();
  const filter = ui.debtFilter;
  const debts = state.debts
    .filter((debt) => filter === "all" || debt.direction === filter)
    .sort((a, b) => {
      const aSettled = debtOutstanding(a) <= 0 ? 1 : 0;
      const bSettled = debtOutstanding(b) <= 0 ? 1 : 0;
      if (aSettled !== bSettled) return aSettled - bSettled;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

  const summary = `
    <div class="debt-summary">
      <div class="debt-summary-card">
        <span class="summary-icon">${icon("arrowDownLeft")}</span>
        <div><span>Owed to you</span><strong>${formatBase(totals.lent)}</strong></div>
      </div>
      <div class="debt-summary-card">
        <span class="summary-icon is-coral">${icon("arrowUpRight")}</span>
        <div><span>You owe</span><strong>${formatBase(totals.borrowed)}</strong></div>
      </div>
      <div class="debt-summary-card">
        <span class="summary-icon is-neutral">${icon("handshake")}</span>
        <div>
          <span>Net position</span>
          <strong class="${totals.net >= 0 ? "pos" : "neg"}">${formatSignedBase(totals.net)}</strong>
        </div>
      </div>
    </div>`;

  if (!state.debts.length) {
    return `
      ${summary}
      <div class="panel empty-state" style="padding:55px 22px">
        <span class="empty-icon">${icon("handshake")}</span>
        <h3>Keep personal loans clear</h3>
        <p>Record money you have lent to someone or borrowed from them. Add repayments over time and Moneta will do the rest.</p>
        <button class="btn btn-primary" type="button" data-action="add-debt">${icon("plus", "btn-icon")} Add a record</button>
      </div>`;
  }

  const tabButtons = [
    { key: "all", label: "All records" },
    { key: "lent", label: "Owed to me" },
    { key: "borrowed", label: "I owe" }
  ];

  return `
    ${summary}
    <div class="debt-tabs" role="tablist" aria-label="Filter borrow and lend records">
      ${tabButtons
        .map(
          (tab) => `
        <button class="debt-tab${filter === tab.key ? " is-active" : ""}" type="button" role="tab" aria-selected="${filter === tab.key}" data-action="filter-debts" data-filter="${tab.key}">
          ${tab.label}
        </button>`
        )
        .join("")}
    </div>
    ${
      debts.length
        ? `<div class="debt-grid">${debts.map(debtCardHTML).join("")}</div>`
        : `<div class="panel empty-state" style="padding:42px 22px">
             <span class="empty-icon">${icon("handshake")}</span>
             <h3>No records here</h3>
             <p>${filter === "lent" ? "You have not lent any money yet." : filter === "borrowed" ? "You have not borrowed any money yet." : "Add a record to get started."}</p>
             <button class="btn btn-secondary" type="button" data-action="add-debt">Add a record</button>
           </div>`
    }`;
}

/* ---------------------------------------------------------
   Credit cards
   --------------------------------------------------------- */

function creditCardHTML(card) {
  const owed = cardCurrentOwed(card);
  const limit = Number(card.limit) || 0;
  const available = Math.max(0, limit - owed);
  const utilization = limit > 0 ? Math.min(100, (owed / limit) * 100) : 0;
  const due = cardNextDueDate(card);
  const minimum = cardMinimumDue(card);
  const theme = CARD_THEMES[card.theme] || CARD_THEMES.forest;
  const last4 = card.last4 || "0000";
  const issuer = card.issuer || "Credit card";

  return `
    <div class="card-item">
      <div class="credit-card credit-card--${esc(card.theme || "forest")}">
        <div class="cc-top">
          <div class="cc-identity">
            <span class="cc-issuer">${esc(issuer)}</span>
            <span class="cc-name">${esc(card.name)}</span>
          </div>
          <span class="cc-number">•••• ${esc(last4)}</span>
        </div>
        <span class="cc-chip" aria-hidden="true"></span>
        <p class="cc-label">Current balance</p>
        <div class="cc-balance">${formatMoney(owed, card.currency)}</div>
        <div class="cc-bottom">
          <div><span>Credit limit</span><strong>${formatMoney(limit, card.currency)}</strong></div>
          <div><span>Next due</span><strong>${esc(formatShortDate(toISODate(due)))}</strong></div>
        </div>
        <div class="cc-utilization">
          <div class="cc-utilization-track"><i style="width:${utilization}%"></i></div>
          <span>${utilization.toFixed(0)}% used · ${formatMoney(available, card.currency)} available</span>
        </div>
      </div>
      <div class="card-item-actions">
        <button class="btn btn-secondary" type="button" data-action="spend-card" data-id="${esc(card.id)}">${icon("plus", "btn-icon")} Spend</button>
        <button class="btn btn-primary" type="button" data-action="pay-card" data-id="${esc(card.id)}"${owed <= 0 ? " disabled" : ""}>${icon("card", "btn-icon")} Pay card</button>
        <span class="spacer"></span>
        <button class="debt-icon-btn" type="button" data-action="edit-card" data-id="${esc(card.id)}" aria-label="Edit ${esc(card.name)}" title="Edit">${icon("edit")}</button>
        <button class="debt-icon-btn is-delete" type="button" data-action="delete-card" data-id="${esc(card.id)}" aria-label="Delete ${esc(card.name)}" title="Delete">${icon("trash")}</button>
      </div>
    </div>`;
}

function renderCards() {
  const cards = creditAccounts();
  const totals = getCardTotals();
  const nextDueLabel = totals.nextDue
    ? formatShortDate(toISODate(totals.nextDue))
    : "—";
  const utilizationHigh = totals.utilization >= 50;

  if (!cards.length) {
    return `
      <div class="panel empty-state" style="padding:55px 22px">
        <span class="empty-icon">${icon("card")}</span>
        <h3>Bring your cards into view</h3>
        <p>Add a credit card to track its balance, limit, utilisation, due date and minimum payment. Record spending and payments as they happen — no bank connection required.</p>
        <button class="btn btn-primary" type="button" data-action="add-card">${icon("plus", "btn-icon")} Add a credit card</button>
      </div>
      <div class="welcome-features" style="margin-top:16px">
        <article class="feature-card">
          <span class="feature-icon">${icon("trend")}</span>
          <h3>See utilisation</h3>
          <p>Know how much of each limit is in use at a glance.</p>
        </article>
        <article class="feature-card">
          <span class="feature-icon">${icon("calendar")}</span>
          <h3>Never miss a due date</h3>
          <p>Moneta calculates the next due date from the statement day.</p>
        </article>
        <article class="feature-card">
          <span class="feature-icon">${icon("arrows")}</span>
          <h3>Pay from any account</h3>
          <p>Record a payment and update both balances automatically.</p>
        </article>
      </div>`;
  }

  const cardActivity = sortedTransactions(
    state.transactions.filter((transaction) => {
      return cards.some((card) => transaction.accountId === card.id || transaction.toAccountId === card.id);
    })
  ).slice(0, 7);

  return `
    <div class="cards-overview">
      <section class="cards-summary">
        <span>Total card balance</span>
        <strong>${formatBase(totals.owed)}</strong>
        <div class="cards-summary-row">
          <div><span>Total limit</span><strong>${formatBase(totals.limit)}</strong></div>
          <div><span>Available</span><strong>${formatBase(totals.available)}</strong></div>
          <div><span>Next due</span><strong>${esc(nextDueLabel)}</strong></div>
        </div>
      </section>
      <section class="utilization-card">
        <div class="utilization-head">
          <span>Overall utilisation</span>
          <strong>${totals.utilization.toFixed(0)}%</strong>
        </div>
        <div class="utilization-track${utilizationHigh ? " is-high" : ""}"><i style="width:${totals.utilization}%"></i></div>
        <p>Minimum due across cards: <strong>${formatBase(totals.minimum)}</strong>. Paying a card from an account is recorded as a transfer, so your net worth stays accurate.</p>
      </section>
    </div>

    <div class="section-intro">
      <div>
        <h2>Your cards</h2>
        <p>${cards.length} card${cards.length === 1 ? "" : "s"} · balances in ${new Set(cards.map((card) => card.currency)).size} currenc${new Set(cards.map((card) => card.currency)).size === 1 ? "y" : "ies"}</p>
      </div>
    </div>
    <div class="card-grid">
      ${cards.map(creditCardHTML).join("")}
      <button class="add-tile" type="button" data-action="add-card" style="min-height:206px">
        <span class="add-tile-icon">${icon("plus")}</span>
        <strong>Add another card</strong>
        <span>Track limits and payments</span>
      </button>
    </div>

    <section class="panel card-activity">
      <div class="panel-head">
        <div>
          <h2>Card activity</h2>
          <p>Spending and payments on your cards</p>
        </div>
        <button class="panel-link" type="button" data-nav="transactions">View all ${icon("arrowRight")}</button>
      </div>
      ${
        cardActivity.length
          ? cardActivity.map(transactionRowHTML).join("")
          : `<div class="empty-state" style="padding:25px 8px">
               <span class="empty-icon">${icon("card")}</span>
               <h3>No card activity yet</h3>
               <p>Add a card purchase or record a payment to see it here.</p>
             </div>`
      }
    </section>`;
}

/* ---------------------------------------------------------
   Settings
   --------------------------------------------------------- */

function settingsCurrencyRow(currency) {
  const protectedCurrency = currency.code === baseCurrencyCode() || usedCurrencyCodes().has(currency.code);
  const isBase = currency.code === baseCurrencyCode();
  return `
    <div class="rate-row">
      <span class="rate-currency">${esc(currency.symbol || currency.code)}</span>
      <div class="rate-name">
        <strong>${esc(currency.name)}</strong>
        <span>${esc(currency.code)}${isBase ? " · base currency" : ""}</span>
      </div>
      <div class="rate-input-wrap">
        <input
          class="rate-input"
          type="number"
          inputmode="decimal"
          min="0"
          step="any"
          value="${esc(formatRateValue(currency.rate))}"
          data-currency-rate="${esc(currency.code)}"
          aria-label="Rate for 1 ${esc(currency.code)} in ${esc(baseCurrencyCode())}"
          ${isBase ? "disabled" : ""}
        />
        <span class="rate-base-label">${esc(baseCurrencyCode())}</span>
      </div>
      <button
        class="rate-remove"
        type="button"
        data-action="delete-currency"
        data-id="${esc(currency.code)}"
        aria-label="Remove ${esc(currency.code)}"
        title="${protectedCurrency ? "Used by an account or record" : "Remove currency"}"
        ${protectedCurrency ? "disabled" : ""}
      >${icon("trash")}</button>
    </div>`;
}

function settingsInstallRow() {
  if (isStandaloneApp()) {
    return `
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Install app</strong>
          <span>Moneta is running as an installed app on this device.</span>
        </div>
        <div class="setting-control">
          <span class="offline-badge">${icon("check")} Installed</span>
        </div>
      </div>`;
  }

  const hint = deferredInstallPrompt
    ? "Add Moneta to your home screen or dock. It launches offline like any other app."
    : isIosDevice()
      ? "In Safari, tap Share, then “Add to Home Screen”."
      : "Use your browser menu and choose “Install app”.";

  return `
    <div class="setting-row">
      <div class="setting-copy">
        <strong>Install app</strong>
        <span>${hint}</span>
      </div>
      <div class="setting-control">
        ${
          deferredInstallPrompt
            ? `<button class="btn btn-secondary" type="button" data-action="install-app">${icon("download", "btn-icon")} Install app</button>`
            : `<span class="offline-badge">${icon("shield")} Offline ready</span>`
        }
      </div>
    </div>`;
}

function formatFileSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ledgerFileStatusBadge(mode) {
  const badges = {
    file: { label: "Connected", icon: "check", className: "is-good" },
    reconnect: { label: "Permission needed", icon: "alert", className: "is-warn" },
    error: { label: "File problem", icon: "alert", className: "is-error" },
    browser: { label: "Browser storage", icon: "shield", className: "" },
    "first-run": { label: "Browser storage", icon: "shield", className: "" },
    unsupported: { label: "Browser storage", icon: "shield", className: "" }
  };
  const badge = badges[mode] || badges.browser;
  return `<span class="file-badge ${badge.className}">${icon(badge.icon)} ${badge.label}</span>`;
}

function ledgerFilePanelHTML() {
  const storage = window.MonetaFileStorage;
  if (!storage || typeof storage.getStatus !== "function") return "";

  const status = storage.getStatus();
  const mode = status.mode;
  const supported = storage.available();
  const name = status.name || "Moneta ledger";

  let title = "Ledger file";
  let copy = "";
  let actions = "";

  if (mode === "file") {
    title = name;
    const saved = status.lastSavedAt
      ? formatDate(status.lastSavedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
      : "just now";
    const problem = status.error
      ? ` <span class="file-problem">${esc(status.error)}</span>`
      : "";
    copy = `A SQLite file on this device holds your whole ledger. Changes are written automatically. <span class="file-meta">${formatFileSize(status.size)} · <span data-ledger-saved>saved ${esc(saved)}</span></span>${problem}`;
    actions = `
      <button class="btn btn-secondary" type="button" data-action="download-ledger-file">${icon("download", "btn-icon")} Download copy</button>
      <button class="btn btn-ghost" type="button" data-action="disconnect-ledger-file">Disconnect</button>`;
  } else if (mode === "reconnect") {
    title = name;
    copy = "Moneta remembers this file, but your browser needs permission to open it again. Reconnect to keep saving to the database.";
    actions = `
      <button class="btn btn-primary" type="button" data-action="reconnect-ledger-file">${icon("database", "btn-icon")} Reconnect file</button>
      <button class="btn btn-secondary" type="button" data-action="open-ledger-file">Open another file</button>
      <button class="btn btn-ghost" type="button" data-action="disconnect-ledger-file">Disconnect</button>`;
  } else if (mode === "error") {
    title = name;
    copy = `${esc(status.error || "Moneta could not read the ledger file.")} The browser copy is still in use, so your ledger is safe.`;
    actions = `
      <button class="btn btn-secondary" type="button" data-action="reconnect-ledger-file">Try again</button>
      <button class="btn btn-secondary" type="button" data-action="open-ledger-file">Open another file</button>
      <button class="btn btn-ghost" type="button" data-action="disconnect-ledger-file">Disconnect</button>`;
  } else if (mode === "unsupported") {
    copy = "This browser cannot read or write local database files, so Moneta keeps the ledger in browser storage. Chrome or Edge on desktop can use a real <code>.sqlite</code> file.";
    actions = "";
  } else {
    copy = "Your ledger is stored in this browser. Create a SQLite file to keep it in a real file you can move, sync or back up outside the browser.";
    actions = `
      <button class="btn btn-secondary" type="button" data-action="create-ledger-file">${icon("database", "btn-icon")} Create ledger file</button>
      <button class="btn btn-ghost" type="button" data-action="open-ledger-file">Open existing file</button>`;
  }

  if (!supported && mode !== "file" && mode !== "reconnect" && mode !== "error") {
    copy = "This browser cannot read or write local database files, so Moneta keeps the ledger in browser storage. Chrome or Edge on desktop can use a real <code>.sqlite</code> file.";
    actions = "";
  }

  return `
    <div class="file-card${mode === "reconnect" || mode === "error" || status.error ? " is-attention" : ""}" id="ledgerFileCard">
      <div class="file-card-head">
        <span class="file-card-icon">${icon("database")}</span>
        <div class="file-card-title"><strong>${esc(title)}</strong>${ledgerFileStatusBadge(status.error && mode === "file" ? "error" : mode)}</div>
      </div>
      <p class="file-pitch">${copy}</p>
      ${actions ? `<div class="file-actions">${actions}</div>` : ""}
    </div>`;
}

function renderSettings() {
  const counts = dataCounts();
  const protectedCurrencies = usedCurrencyCodes();
  const currencyCount = state.currencies.length;
  const usedCount = [...protectedCurrencies].filter((code) => currencyByCode(code)).length;
  const ratesUpdatedAt = state.settings.ratesUpdatedAt;
  const fileStatus = window.MonetaFileStorage ? window.MonetaFileStorage.getStatus() : null;
  const storageCopy =
    fileStatus && fileStatus.mode === "file"
      ? `Saved to ${esc(fileStatus.name || "your ledger file")} on this device.`
      : fileStatus && fileStatus.mode === "reconnect"
        ? `Reconnect ${esc(fileStatus.name || "your ledger file")} to resume saving to it.`
        : fileStatus && fileStatus.mode === "error"
          ? "The ledger file needs attention; the browser copy is still in use."
          : "Your browser keeps this ledger on this device only.";

  return `
    <div class="settings-grid">
      <section class="settings-panel panel">
        <h2>Preferences</h2>
        <p class="settings-desc">Choose how Moneta displays and values your money.</p>

        <div class="setting-row">
          <div class="setting-copy">
            <strong>Base currency</strong>
            <span>All totals are converted into this currency.</span>
          </div>
          <div class="setting-control">
            <select id="settingsBaseCurrency" data-setting-base aria-label="Base currency">
              ${state.currencies
                .map(
                  (currency) =>
                    `<option value="${esc(currency.code)}"${currency.code === baseCurrencyCode() ? " selected" : ""}>${esc(currency.code)} — ${esc(currency.name)}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <strong>Appearance</strong>
            <span>Switch between a light ledger, a dark one, or follow your system.</span>
          </div>
          <div class="setting-control">
            <select id="settingsTheme" aria-label="Appearance theme">
              <option value="light"${state.settings.theme === "light" ? " selected" : ""}>Light</option>
              <option value="dark"${state.settings.theme === "dark" ? " selected" : ""}>Dark</option>
              <option value="system"${state.settings.theme === "system" ? " selected" : ""}>System</option>
            </select>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <strong>Hide amounts</strong>
            <span>Blur monetary values for privacy. You can toggle this any time.</span>
          </div>
          <button
            class="toggle${state.settings.hideBalances ? " is-on" : ""}"
            type="button"
            role="switch"
            aria-checked="${state.settings.hideBalances}"
            data-action="toggle-privacy"
            aria-label="Hide amounts"
          ></button>
        </div>

        <div class="setting-row">
          <div class="setting-copy">
            <strong>Local storage</strong>
            <span>${storageCopy}</span>
          </div>
          <div class="setting-control">
            <span class="offline-badge">${icon("shield")} Offline</span>
          </div>
        </div>

        ${settingsInstallRow()}

        <div class="privacy-note">
          ${icon("lock")}
          <p>There is no account, server or sync. Your ledger stays on this device. If you clear browser data, reconnect or open your ledger file, or restore a Moneta backup.</p>
        </div>
      </section>

      <section class="settings-panel panel">
        <h2>Data &amp; backup</h2>
        <p class="settings-desc">Move your ledger safely or start fresh. Backups are plain JSON files you control.</p>

        <div class="data-actions">
          <button class="btn btn-secondary" type="button" data-action="export-json">${icon("download", "btn-icon")} Export backup</button>
          <button class="btn btn-secondary" type="button" data-action="import-json">${icon("upload", "btn-icon")} Import backup</button>
          <button class="btn btn-ghost" type="button" data-action="export-csv">${icon("activity", "btn-icon")} Export CSV</button>
        </div>

        <div class="data-summary">
          <strong>${counts.accounts}</strong> accounts · <strong>${counts.transactions}</strong> transactions · <strong>${counts.debts}</strong> borrow/lend records · <strong>${counts.currencies}</strong> currencies
        </div>

        ${ledgerFilePanelHTML()}

        <div class="danger-zone">
          <h3>Clear this ledger</h3>
          <p>This permanently removes every account, transaction, debt and card stored in this browser. Export a backup first if you may need it later.</p>
          <button class="btn btn-soft-danger" type="button" data-action="reset-data">${icon("trash", "btn-icon")} Delete all data</button>
        </div>
      </section>

      <section class="settings-panel panel settings-panel--full">
        <div class="rate-head">
          <div>
            <h2>Currencies &amp; rates</h2>
            <p>Rates are stored on this device. Moneta only contacts a rate service when you press “Fetch live rates”.</p>
          </div>
          <div class="rate-head-actions">
            <button class="btn btn-secondary" type="button" data-action="fetch-rates">
              ${icon("rotate", "btn-icon")} Fetch live rates
            </button>
            <span class="rate-updated">${
              ratesUpdatedAt
                ? `Last fetched ${esc(formatDate(ratesUpdatedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }))}`
                : "Never fetched · manual rates in use"
            }</span>
          </div>
        </div>

        <div class="rate-table">
          ${state.currencies.map(settingsCurrencyRow).join("")}
        </div>

        <div class="add-currency-row">
          <p>${currencyCount} currencies available · ${usedCount} in use. Values are converted as <strong>1 unit = rate ${esc(baseCurrencyCode())}</strong>.</p>
          <button class="btn btn-secondary" type="button" data-action="add-currency">${icon("plus", "btn-icon")} Add currency</button>
        </div>

        <p class="settings-footer-note">Changing your base currency recalculates every manual rate so existing balances keep the same relative value. Live rates come from open.er-api.com, a free service that needs no key; anything you type is kept as-is until the next fetch.</p>
      </section>
    </div>`;
}
