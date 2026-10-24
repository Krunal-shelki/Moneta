/* =========================================================
   Moneta — views (navigation, overview, activity, accounts)
   ========================================================= */

function renderApp() {
  balanceCache = null;

  const view = VIEWS[ui.view];
  const currentDate = new Date();
  const kicker = document.getElementById("topbarKicker");
  const title = document.getElementById("pageTitle");
  const subtitle = document.getElementById("pageSubtitle");
  const baseLabel = document.getElementById("baseCurrencyLabel");

  document.title = `${view.title} · Moneta`;
  kicker.textContent = formatDate(currentDate, { weekday: "long", day: "numeric", month: "long" });
  title.textContent = view.title;
  subtitle.textContent = view.subtitle;
  baseLabel.textContent = baseCurrencyCode();

  document.getElementById("privacyIcon").innerHTML = icon(state.settings.hideBalances ? "eyeOff" : "eye");
  document.getElementById("privacyBtn").setAttribute(
    "aria-label",
    state.settings.hideBalances ? "Show amounts" : "Hide amounts"
  );
  document.getElementById("privacyBtn").title = state.settings.hideBalances ? "Show amounts" : "Hide amounts";
  document.getElementById("baseCurrencyChevron").innerHTML = icon("chevronDown");
  document.getElementById("topSettingsIcon").innerHTML = icon("settings");
  document.getElementById("sideSettingsIcon").innerHTML = icon("settings");
  document.getElementById("offlineIcon").innerHTML = icon("shield");

  renderNavigation();
  renderPrimaryAction();

  const renderers = {
    overview: renderOverview,
    transactions: renderActivity,
    accounts: renderAccounts,
    debts: renderDebts,
    cards: renderCards,
    settings: renderSettings
  };

  const viewElement = document.getElementById("view");
  viewElement.innerHTML = (renderers[ui.view] || renderOverview)();
  viewElement.scrollTop = 0;
}

function renderNavigation() {
  const openDebts = state.debts.filter((debt) => debtOutstanding(debt) > 0).length;
  const cardCount = creditAccounts().length;

  const items = [
    { view: "overview", label: "Overview", mobileLabel: "Home", icon: "overview" },
    { view: "transactions", label: "Activity", mobileLabel: "Activity", icon: "activity" },
    { view: "accounts", label: "Accounts", mobileLabel: "Accounts", icon: "wallet" },
    {
      view: "debts",
      label: "Borrow & lend",
      mobileLabel: "Debts",
      icon: "handshake",
      badge: openDebts || ""
    },
    {
      view: "cards",
      label: "Credit cards",
      mobileLabel: "Cards",
      icon: "card",
      badge: cardCount || ""
    }
  ];

  document.getElementById("sideNav").innerHTML = items
    .map(
      (item) => `
      <button class="side-link${ui.view === item.view ? " is-active" : ""}" type="button" data-nav="${item.view}"${ui.view === item.view ? ' aria-current="page"' : ""}>
        <span class="side-icon">${icon(item.icon)}</span>
        <span>${item.label}</span>
        ${item.badge ? `<span class="side-badge">${item.badge}</span>` : ""}
      </button>`
    )
    .join("");

  document.getElementById("mobileNav").innerHTML = items
    .map(
      (item) => `
      <button class="mobile-link${ui.view === item.view ? " is-active" : ""}" type="button" data-nav="${item.view}" aria-label="${item.mobileLabel === item.label ? item.label : `${item.mobileLabel} — ${item.label}`}"${ui.view === item.view ? ' aria-current="page"' : ""}>
        ${icon(item.icon)}
        <span>${item.mobileLabel}</span>
      </button>`
    )
    .join("");
}

function renderPrimaryAction() {
  let action = "add-txn";
  let label = "Add transaction";
  let iconName = "plus";

  if (ui.view === "overview" || ui.view === "transactions") {
    if (!state.accounts.length) {
      action = "add-account";
      label = "Add account";
    }
  } else if (ui.view === "accounts") {
    action = "add-account";
    label = "Add account";
  } else if (ui.view === "debts") {
    action = "add-debt";
    label = "Add record";
  } else if (ui.view === "cards") {
    action = "add-card";
    label = "Add card";
  } else if (ui.view === "settings") {
    action = "export-json";
    label = "Export backup";
    iconName = "download";
  }

  const button = document.getElementById("primaryBtn");
  button.dataset.action = action;
  document.getElementById("primaryLabel").textContent = label;
  document.getElementById("primaryIcon").innerHTML = icon(iconName);
}

/* ---------------------------------------------------------
   Shared visual helpers
   --------------------------------------------------------- */

function sparklineSVG(values) {
  const width = 640;
  const height = 180;
  const padding = 7;
  const safeValues = values && values.length > 1 ? values : [0, 0];
  let min = Math.min(...safeValues);
  let max = Math.max(...safeValues);

  if (max - min < 1) {
    const center = (max + min) / 2;
    min = center - 1;
    max = center + 1;
  }

  const points = safeValues.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / (safeValues.length - 1);
    const y = padding + (1 - (value - min) / (max - min)) * (height - padding * 2);
    return { x, y };
  });

  let line = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (after.x - current.x) / 6;
    const cp2y = next.y - (after.y - current.y) / 6;
    line += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  const area = `${line} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Net worth trend">
    <defs>
      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d8ed9b" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#d8ed9b" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#a6ce8c"/>
        <stop offset="55%" stop-color="#d8ed9b"/>
        <stop offset="100%" stop-color="#eff7cf"/>
      </linearGradient>
      <filter id="sparkGlow" x="-10%" y="-30%" width="120%" height="160%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="${area}" fill="url(#sparkFill)"/>
    <path d="${line}" fill="none" stroke="url(#sparkStroke)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" filter="url(#sparkGlow)"/>
  </svg>`;
}

function donutStyle(items, total) {
  if (!items.length || total <= 0) return "conic-gradient(var(--surface-soft) 0 100%)";
  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function spendBreakdownHTML(breakdown) {
  const total = round2(breakdown.reduce((sum, item) => sum + item.value, 0));
  if (!total) {
    return `
      <div class="empty-state" style="padding:23px 8px">
        <span class="empty-icon">${icon("trend")}</span>
        <h3>No spending yet</h3>
        <p>Expenses you add this month will be grouped by category here.</p>
        <button class="btn btn-secondary" type="button" data-action="add-txn">Add an expense</button>
      </div>`;
  }

  const top = breakdown.slice(0, 4);
  const rest = breakdown.slice(4);
  const restTotal = rest.reduce((sum, item) => sum + item.value, 0);
  const legendItems = restTotal > 0 ? [...top, { name: "Other categories", value: restTotal, color: "#aeb6ae" }] : top;
  const gradientItems = restTotal > 0 ? [...top, { name: "Other", value: restTotal, color: "#aeb6ae" }] : top;

  return `
    <div class="spend-layout">
      <div class="donut" style="--donut:${donutStyle(gradientItems, total)}" role="img" aria-label="Spending by category">
        <div class="donut-center">
          <span>Spent</span>
          <strong>${formatBase(total)}</strong>
        </div>
      </div>
      <ul class="spend-legend">
        ${legendItems
          .map(
            (item) => `
          <li>
            <span class="spend-swatch" style="--swatch:${esc(item.color)}"></span>
            <span class="spend-name">${esc(item.name)}</span>
            <span class="spend-amount">${formatBase(item.value)}</span>
          </li>`
          )
          .join("")}
      </ul>
    </div>
    <p class="spend-more">${breakdown.length} categor${breakdown.length === 1 ? "y" : "ies"} this month</p>`;
}

function transactionAmountHTML(transaction, compact = false) {
  const account = accountById(transaction.accountId);
  const sourceCurrency = account ? account.currency : baseCurrencyCode();

  if (transaction.type === "transfer") {
    const toAccount = accountById(transaction.toAccountId);
    const targetCurrency = toAccount ? toAccount.currency : sourceCurrency;
    const targetText =
      sourceCurrency === targetCurrency
        ? accountName(transaction.toAccountId)
        : `→ ${formatMoney(transaction.toAmount, targetCurrency)}`;
    return {
      className: "",
      main: formatMoney(transaction.amount, sourceCurrency),
      sub: targetText
    };
  }

  const signedValue = transaction.type === "income" ? transaction.amount : -transaction.amount;
  const prefix = transaction.type === "income" ? "+" : "−";
  const display = state.settings.hideBalances
    ? `${prefix}••••••`
    : `${prefix}${formatMoney(transaction.amount, sourceCurrency)}`;
  let sub = "";

  if (sourceCurrency !== baseCurrencyCode()) {
    sub = `≈ ${formatBase(toBase(signedValue, sourceCurrency))}`;
  } else if (isCreditAccount(account)) {
    sub = "Credit card";
  } else {
    sub = transaction.type === "income" ? "Income" : accountTypeLabel(account);
  }

  return {
    className: transaction.type === "income" ? "is-income" : "",
    main: display,
    sub
  };
}

function recentRowHTML(transaction) {
  const visual = transactionVisual(transaction);
  const amount = transactionAmountHTML(transaction);
  return `
    <button class="recent-row" type="button" data-action="edit-txn" data-id="${esc(transaction.id)}">
      <span class="recent-icon" style="--cat-color:${esc(visual.color)}">${icon(visual.icon)}</span>
      <span class="recent-main">
        <span class="recent-title">${esc(transactionTitle(transaction))}</span>
        <span class="recent-meta">${esc(transactionMeta(transaction))}</span>
      </span>
      <span class="recent-amount ${amount.className}">
        ${amount.main}
        ${amount.sub ? `<small>${esc(amount.sub)}</small>` : ""}
      </span>
    </button>`;
}

function transactionRowHTML(transaction) {
  const visual = transactionVisual(transaction);
  const amount = transactionAmountHTML(transaction);
  const account = accountById(transaction.accountId);
  const cardTag =
    transaction.type !== "transfer" && isCreditAccount(account)
      ? '<span class="txn-tag">Card</span>'
      : "";

  return `
    <div class="txn-row">
      <span class="txn-icon" style="--cat-color:${esc(visual.color)}">${icon(visual.icon)}</span>
      <button class="txn-main" type="button" data-action="edit-txn" data-id="${esc(transaction.id)}" aria-label="Edit ${esc(transactionTitle(transaction))}">
        <span class="txn-title">${esc(transactionTitle(transaction))}</span>
        <span class="txn-meta">
          ${esc(transactionMeta(transaction))}
          ${cardTag}
        </span>
      </button>
      <div class="txn-amount ${amount.className}">
        ${amount.main}
        ${amount.sub ? `<small>${esc(amount.sub)}</small>` : ""}
      </div>
      <div class="txn-actions">
        <button class="txn-action" type="button" data-action="edit-txn" data-id="${esc(transaction.id)}" aria-label="Edit transaction" title="Edit">${icon("edit")}</button>
        <button class="txn-action is-delete" type="button" data-action="delete-txn" data-id="${esc(transaction.id)}" aria-label="Delete transaction" title="Delete">${icon("trash")}</button>
      </div>
    </div>`;
}

function accountMiniHTML(account) {
  const balance = getBalances()[account.id] || 0;
  const baseValue = toBase(balance, account.currency);
  const showBase = account.currency !== baseCurrencyCode();
  return `
    <div class="account-mini">
      <span class="account-mini-icon" style="--accent:${esc(account.color)}">${icon(accountIcon(account))}</span>
      <div class="account-mini-main">
        <strong>${esc(account.name)}</strong>
        <span>${accountTypeLabel(account)} · ${esc(account.currency)}</span>
      </div>
      <div class="account-mini-balance">
        <strong>${formatMoney(balance, account.currency)}</strong>
        ${showBase ? `<span>≈ ${formatBase(baseValue)}</span>` : ""}
      </div>
    </div>`;
}

function pageStatsHTML(stats) {
  return `<div class="page-stats">${stats
    .map(
      (stat) => `
      <div class="stat-card" style="--stat-color:${esc(stat.color || "#2f6b53")}">
        <span class="stat-label">${icon(stat.icon || "trend")}${esc(stat.label)}</span>
        <strong class="stat-value ${stat.className || ""}">${stat.value}</strong>
        <span class="stat-sub">${esc(stat.sub || "")}</span>
      </div>`
    )
    .join("")}</div>`;
}

/* ---------------------------------------------------------
   Overview
   --------------------------------------------------------- */

function welcomeViewHTML() {
  return `
    <section class="welcome">
      <div class="welcome-copy">
        <span class="welcome-eyebrow">${icon("lock")} Private by design</span>
        <h2>Your money,<br><em>without the cloud.</em></h2>
        <p>Moneta is a quiet, local-first ledger for everything you own and owe. Add accounts in any currency, track borrowing and lending, and keep credit cards in check — all without an account or an internet connection.</p>
        <div class="welcome-actions">
          <button class="btn btn-primary" type="button" data-action="add-account">${icon("plus", "btn-icon")} Add your first account</button>
          <button class="btn btn-secondary" type="button" data-nav="settings">${icon("settings", "btn-icon")} Set up currencies</button>
        </div>
        <ul class="welcome-points">
          <li>${icon("shield")} Stored locally</li>
          <li>${icon("wallet")} Multi-currency</li>
          <li>${icon("handshake")} Borrow &amp; lend</li>
          <li>${icon("card")} Credit cards</li>
        </ul>
      </div>
      <div class="welcome-art" aria-hidden="true">
        <div class="art-halo"></div>
        <div class="art-card">
          <div class="art-card-top"><span>Total net worth</span><span>USD</span></div>
          <strong>$ 0.00</strong>
          <span>Ready for your first entry</span>
          <div class="art-bars">
            <i style="--h:28%"></i><i style="--h:42%"></i><i style="--h:36%"></i><i style="--h:61%"></i><i style="--h:55%"></i><i style="--h:78%"></i><i style="--h:94%"></i>
          </div>
          <div class="art-card-foot"><span>Private ledger</span><span>•••• 2026</span></div>
        </div>
        <div class="art-mini-card">
          <span>Manual rates</span>
          <strong>1 EUR = 1.08 USD</strong>
          <small><span>No network</span><span>Always yours</span></small>
        </div>
        <span class="art-chip art-chip--one">${icon("shield")} No cloud</span>
        <span class="art-chip art-chip--two">${icon("sparkles")} Works offline</span>
      </div>
    </section>
    <div class="welcome-features">
      <article class="feature-card">
        <span class="feature-icon">${icon("wallet")}</span>
        <h3>Truly multi-currency</h3>
        <p>Keep accounts in different currencies and see one clear net worth using rates you control.</p>
      </article>
      <article class="feature-card">
        <span class="feature-icon">${icon("handshake")}</span>
        <h3>Borrow &amp; lend</h3>
        <p>Track who owes whom, record repayments and see what is still outstanding.</p>
      </article>
      <article class="feature-card">
        <span class="feature-icon">${icon("card")}</span>
        <h3>Credit cards, handled</h3>
        <p>Follow balances, limits, utilisation, due dates and minimum payments.</p>
      </article>
    </div>`;
}

function renderOverview() {
  const hasData = state.accounts.length || state.transactions.length || state.debts.length;
  if (!hasData) return welcomeViewHTML();

  const now = new Date();
  const netWorth = getNetWorth();
  const monthStats = getMonthStats(now);
  const debtTotals = getDebtTotals();
  const cardTotals = getCardTotals();
  const cards = creditAccounts();
  const assets = assetAccounts();
  const balances = getBalances();
  const previousMonthEnd = endOfMonthISO(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const monthChange = round2(netWorth - netWorthAt(previousMonthEnd));
  const series = netWorthSeries();
  const chart = sparklineSVG(series.map((point) => point.value));
  const cashTotal = assets
    .filter((account) => account.type !== "investment")
    .reduce((total, account) => total + toBase(balances[account.id] || 0, account.currency), 0);
  const investmentTotal = assets
    .filter((account) => account.type === "investment")
    .reduce((total, account) => total + toBase(balances[account.id] || 0, account.currency), 0);
  const spending = getSpendingBreakdown(now);
  const recent = sortedTransactions().slice(0, 5);
  const maxFlow = Math.max(monthStats.income, monthStats.expense, 1);
  const incomeWidth = monthStats.income > 0 ? Math.max(3, (monthStats.income / maxFlow) * 100) : 0;
  const expenseWidth = monthStats.expense > 0 ? Math.max(3, (monthStats.expense / maxFlow) * 100) : 0;
  const changeClass = monthChange < 0 ? "is-down" : "";
  const trendIcon = monthChange < 0 ? "arrowDownLeft" : "arrowUpRight";
  const trendPrefix = monthChange < 0 ? "−" : "+";
  const trendValue = `${trendPrefix}${formatBase(Math.abs(monthChange))}`;

  return `
    <div class="dashboard-top">
      <article class="hero-card">
        <div class="hero-top">
          <div>
            <p class="hero-label">Total net worth</p>
            <div class="hero-amount">
              <strong>${formatBase(netWorth)}</strong>
              <span class="hero-base">${esc(baseCurrencyCode())}</span>
            </div>
          </div>
          <div class="hero-trend ${changeClass}">
            <strong>${icon(trendIcon)} ${trendValue}</strong>
            <span>this month</span>
          </div>
        </div>
        <div class="hero-chart">${chart}</div>
        <div class="hero-chart-labels">${series.map((point) => `<span>${esc(point.label)}</span>`).join("")}</div>
        <div class="hero-split">
          <div><span>Cash &amp; bank</span><strong>${formatBase(cashTotal)}</strong></div>
          <div><span>Investments</span><strong>${formatBase(investmentTotal)}</strong></div>
          <div><span>Card balances</span><strong class="${cardTotals.owed > 0 ? "is-negative" : ""}">${cardTotals.owed > 0 ? `−${formatBase(cardTotals.owed)}` : formatBase(0)}</strong></div>
        </div>
      </article>

      <aside class="month-panel">
        <div class="month-head">
          <div>
            <p class="label">This month</p>
            <h2>${formatDate(now, { month: "long" })}</h2>
          </div>
          <span class="month-tag">${state.transactions.length} entries</span>
        </div>
        <div class="month-flows">
          <div class="flow-row">
            <div class="flow-top">
              <span class="flow-label"><i class="flow-dot"></i> Money in</span>
              <strong>${formatBase(monthStats.income)}</strong>
            </div>
            <div class="flow-track"><i style="width:${incomeWidth}%"></i></div>
          </div>
          <div class="flow-row is-out">
            <div class="flow-top">
              <span class="flow-label"><i class="flow-dot"></i> Money out</span>
              <strong>${formatBase(monthStats.expense)}</strong>
            </div>
            <div class="flow-track"><i style="width:${expenseWidth}%"></i></div>
          </div>
        </div>
        <div class="month-net">
          <span>${monthStats.net >= 0 ? "Net saved" : "Net spent"}</span>
          <strong class="${monthStats.net >= 0 ? "pos" : "neg"}">${formatSignedBase(monthStats.net)}</strong>
        </div>
        <button class="month-link" type="button" data-nav="transactions">
          <span>View all activity</span>
          ${icon("arrowRight")}
        </button>
      </aside>
    </div>

    <div class="metrics">
      <button class="metric" type="button" data-nav="debts">
        <span class="metric-icon">${icon("arrowDownLeft")}</span>
        <span class="metric-text">
          <span class="metric-label">Owed to you</span>
          <strong class="metric-value">${formatBase(debtTotals.lent)}</strong>
        </span>
        <span class="metric-side">${icon("chevronRight")}</span>
      </button>
      <button class="metric" type="button" data-nav="debts">
        <span class="metric-icon is-coral">${icon("arrowUpRight")}</span>
        <span class="metric-text">
          <span class="metric-label">You owe</span>
          <strong class="metric-value">${formatBase(debtTotals.borrowed)}</strong>
        </span>
        <span class="metric-side">${icon("chevronRight")}</span>
      </button>
      <button class="metric" type="button" data-nav="cards">
        <span class="metric-icon is-gold">${icon("card")}</span>
        <span class="metric-text">
          <span class="metric-label">Card balances</span>
          <strong class="metric-value">${formatBase(cardTotals.owed)}</strong>
        </span>
        <span class="metric-side">${icon("chevronRight")}</span>
      </button>
    </div>

    <div class="dashboard-grid">
      <section class="panel dash-panel">
        <div class="panel-head">
          <div>
            <h2>Accounts</h2>
            <p>${assets.length} active account${assets.length === 1 ? "" : "s"}</p>
          </div>
          <button class="panel-link" type="button" data-nav="accounts">View all ${icon("arrowRight")}</button>
        </div>
        ${
          assets.length
            ? `<div class="account-mini-list">${assets.slice(0, 4).map(accountMiniHTML).join("")}</div>
               <button class="panel-add" type="button" data-action="add-account">${icon("plus")} Add another account</button>`
            : `<div class="empty-state" style="padding:24px 8px 18px">
                 <span class="empty-icon">${icon("wallet")}</span>
                 <h3>No accounts yet</h3>
                 <p>Add a bank account, cash wallet or investment to start your ledger.</p>
                 <button class="btn btn-secondary" type="button" data-action="add-account">Add account</button>
               </div>`
        }
      </section>

      <section class="panel dash-panel">
        <div class="panel-head">
          <div>
            <h2>Spending this month</h2>
            <p>Grouped by category</p>
          </div>
        </div>
        ${spendBreakdownHTML(spending)}
      </section>
    </div>

    <section class="panel recent-panel">
      <div class="panel-head">
        <div>
          <h2>Recent activity</h2>
          <p>Your latest money movements</p>
        </div>
        <button class="panel-link" type="button" data-nav="transactions">View all ${icon("arrowRight")}</button>
      </div>
      ${
        recent.length
          ? `<div class="recent-list">${recent.map(recentRowHTML).join("")}</div>`
          : `<div class="empty-state" style="padding:25px 8px">
               <span class="empty-icon">${icon("activity")}</span>
               <h3>No activity yet</h3>
               <p>Log an expense, income or transfer and it will show up here.</p>
               <button class="btn btn-secondary" type="button" data-action="add-txn">Add transaction</button>
             </div>`
      }
    </section>`;
}

/* ---------------------------------------------------------
   Activity view
   --------------------------------------------------------- */

function renderActivity() {
  const monthStats = getMonthStats();
  const txns = filteredTransactions();
  const hasAnyTransactions = state.transactions.length > 0;
  const filterActive =
    ui.filters.search.trim() !== "" ||
    ui.filters.type !== "all" ||
    ui.filters.account !== "all" ||
    ui.filters.month !== "all";

  const months = monthOptionsFromTransactions();
  const grouped = new Map();
  txns.forEach((transaction) => {
    if (!grouped.has(transaction.date)) grouped.set(transaction.date, []);
    grouped.get(transaction.date).push(transaction);
  });

  const groups = Array.from(grouped.entries()).map(([date, transactions]) => {
    const dayTotal = transactions.reduce((total, transaction) => total + transactionBaseDelta(transaction), 0);
    return `
      <section class="activity-group">
        <div class="date-heading">
          <h2>${esc(dateGroupLabel(date))}</h2>
          <span>${transactions.length} ${transactions.length === 1 ? "entry" : "entries"}${dayTotal !== 0 ? ` · ${formatSignedBase(dayTotal)}` : ""}</span>
        </div>
        ${transactions.map(transactionRowHTML).join("")}
      </section>`;
  });

  const stats = pageStatsHTML([
    {
      label: "Money in this month",
      icon: "arrowDownLeft",
      color: "#2f6b53",
      value: formatBase(monthStats.income),
      sub: "Income across all accounts"
    },
    {
      label: "Money out this month",
      icon: "arrowUpRight",
      color: "#b9523c",
      value: formatBase(monthStats.expense),
      sub: "Expenses across all accounts"
    },
    {
      label: "Net this month",
      icon: monthStats.net >= 0 ? "trend" : "activity",
      color: monthStats.net >= 0 ? "#2f6b53" : "#b9523c",
      value: formatSignedBase(monthStats.net),
      sub: monthStats.net >= 0 ? "You are saving" : "Spending is ahead",
      className: monthStats.net >= 0 ? "pos" : "neg"
    }
  ]);

  let emptyMarkup = "";
  if (!hasAnyTransactions) {
    emptyMarkup = `
      <div class="panel empty-state">
        <span class="empty-icon">${icon("activity")}</span>
        <h3>Your activity is empty</h3>
        <p>Add your first expense, income or transfer. Every entry is stored locally on this device.</p>
        <button class="btn btn-primary" type="button" data-action="${state.accounts.length ? "add-txn" : "add-account"}">${state.accounts.length ? "Add transaction" : "Add an account first"}</button>
      </div>`;
  } else if (!txns.length) {
    emptyMarkup = `
      <div class="panel empty-state">
        <span class="empty-icon">${icon("search")}</span>
        <h3>No matching entries</h3>
        <p>Try a different search, account or date range.</p>
        <button class="btn btn-secondary" type="button" data-action="clear-filters">Clear filters</button>
      </div>`;
  }

  return `
    ${stats}
    <div class="panel toolbar">
      <label class="search-field">
        ${icon("search")}
        <input id="txnSearch" type="search" placeholder="Search notes, categories, accounts…" value="${esc(ui.filters.search)}" autocomplete="off" aria-label="Search transactions" />
      </label>
      <label class="filter-select">
        <select id="filterType" aria-label="Filter by type">
          <option value="all"${ui.filters.type === "all" ? " selected" : ""}>All types</option>
          <option value="expense"${ui.filters.type === "expense" ? " selected" : ""}>Expenses</option>
          <option value="income"${ui.filters.type === "income" ? " selected" : ""}>Income</option>
          <option value="transfer"${ui.filters.type === "transfer" ? " selected" : ""}>Transfers</option>
        </select>
        <span class="select-caret">${icon("chevronDown")}</span>
      </label>
      <label class="filter-select">
        <select id="filterAccount" aria-label="Filter by account">
          <option value="all"${ui.filters.account === "all" ? " selected" : ""}>All accounts</option>
          ${state.accounts
            .map(
              (account) =>
                `<option value="${esc(account.id)}"${ui.filters.account === account.id ? " selected" : ""}>${esc(account.name)} · ${esc(account.currency)}</option>`
            )
            .join("")}
        </select>
        <span class="select-caret">${icon("chevronDown")}</span>
      </label>
      <label class="filter-select">
        <select id="filterMonth" aria-label="Filter by month">
          <option value="all"${ui.filters.month === "all" ? " selected" : ""}>All time</option>
          ${months
            .map(
              (month) =>
                `<option value="${esc(month.key)}"${ui.filters.month === month.key ? " selected" : ""}>${esc(month.label)}</option>`
            )
            .join("")}
        </select>
        <span class="select-caret">${icon("chevronDown")}</span>
      </label>
      ${filterActive ? '<button class="clear-filters" type="button" data-action="clear-filters">Clear</button>' : ""}
    </div>

    ${
      emptyMarkup ||
      `<div class="activity-groups">${groups.join("")}</div>`
    }`;
}

/* ---------------------------------------------------------
   Accounts view
   --------------------------------------------------------- */

function accountCardHTML(account) {
  const balances = getBalances();
  const balance = balances[account.id] || 0;
  const baseValue = toBase(balance, account.currency);
  const showBase = account.currency !== baseCurrencyCode();
  const transactionCount = transactionsForAccount(account.id).length;
  const type = ACCOUNT_TYPES[account.type];
  const iconName = type ? type.icon : "wallet";
  const typeLabel = type ? type.label : "Account";

  return `
    <article class="account-card" style="--accent:${esc(account.color)}">
      <div class="account-card-head">
        <span class="account-icon">${icon(iconName)}</span>
        <div class="account-name">
          <h3>${esc(account.name)}</h3>
          <p>${esc(typeLabel)} · ${esc(account.currency)}</p>
        </div>
        <div class="account-menu">
          <button type="button" data-action="edit-account" data-id="${esc(account.id)}" aria-label="Edit ${esc(account.name)}" title="Edit">${icon("edit")}</button>
          <button class="is-delete" type="button" data-action="delete-account" data-id="${esc(account.id)}" aria-label="Delete ${esc(account.name)}" title="Delete">${icon("trash")}</button>
        </div>
      </div>
      <div class="account-balance">
        <span>Current balance</span>
        <strong>${formatMoney(balance, account.currency)}</strong>
        <small>${showBase ? `≈ ${formatBase(baseValue)}` : `Base currency · ${esc(baseCurrencyCode())}`}</small>
      </div>
      <div class="account-foot">
        <span>${transactionCount} ${transactionCount === 1 ? "entry" : "entries"}</span>
        <span class="type-pill">${esc(account.currency)}</span>
      </div>
    </article>`;
}

function renderAccounts() {
  const accounts = assetAccounts();
  const balances = getBalances();
  const cash = accounts
    .filter((account) => account.type !== "investment")
    .reduce((total, account) => total + toBase(balances[account.id] || 0, account.currency), 0);
  const investments = accounts
    .filter((account) => account.type === "investment")
    .reduce((total, account) => total + toBase(balances[account.id] || 0, account.currency), 0);
  const currencies = new Set(accounts.map((account) => account.currency));

  const stats = pageStatsHTML([
    {
      label: "Cash & bank",
      icon: "bank",
      color: "#2f6b53",
      value: formatBase(cash),
      sub: "Across cash, bank and wallets"
    },
    {
      label: "Investments",
      icon: "trend",
      color: "#8a6a3a",
      value: formatBase(investments),
      sub: "Long-term holdings"
    },
    {
      label: "Currencies in use",
      icon: "wallet",
      color: "#4b708d",
      value: String(currencies.size),
      sub: `Base currency is ${baseCurrencyCode()}`
    }
  ]);

  if (!accounts.length) {
    return `
      ${stats}
      <div class="panel empty-state" style="padding:55px 22px">
        <span class="empty-icon">${icon("wallet")}</span>
        <h3>Add your first account</h3>
        <p>A bank account, cash in hand, digital wallet or investment. You can use a different currency for each one.</p>
        <button class="btn btn-primary" type="button" data-action="add-account">${icon("plus", "btn-icon")} Add account</button>
      </div>
      <p class="settings-footer-note" style="text-align:center">Looking for credit cards? They live in the <button class="text-button" type="button" data-nav="cards">Credit cards</button> tab.</p>`;
  }

  return `
    ${stats}
    <div class="section-intro">
      <div>
        <h2>Your accounts</h2>
        <p>${accounts.length} account${accounts.length === 1 ? "" : "s"} in ${currencies.size} currenc${currencies.size === 1 ? "y" : "ies"}. Credit cards are managed separately.</p>
      </div>
    </div>
    <div class="account-grid">
      ${accounts.map(accountCardHTML).join("")}
      <button class="add-tile" type="button" data-action="add-account">
        <span class="add-tile-icon">${icon("plus")}</span>
        <strong>Add account</strong>
        <span>Bank, cash, wallet or investment</span>
      </button>
    </div>`;
}
