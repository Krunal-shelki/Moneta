/* =========================================================
   Moneta — modal core and primary forms
   ========================================================= */

function modalDialog() {
  return document.getElementById("appModal");
}

function closeModal() {
  const dialog = modalDialog();
  if (!dialog) return;
  if (dialog.open) dialog.close();
  dialog.innerHTML = "";
  document.body.classList.remove("modal-open");
}

function openModal(options) {
  const {
    title,
    eyebrow = "",
    subtitle = "",
    body = "",
    submitLabel = "Save",
    cancelLabel = "Cancel",
    submitClass = "btn-primary",
    wide = false,
    onSubmit = null,
    onMount = null,
    footerStart = "",
    hideSubmit = false,
    footNote = ""
  } = options;

  const dialog = modalDialog();
  dialog.innerHTML = `
    <div class="modal-card${wide ? " is-wide" : ""}">
      <header class="modal-head">
        <div class="modal-heading">
          ${eyebrow ? `<p class="modal-eyebrow">${esc(eyebrow)}</p>` : ""}
          <h2 id="modalTitle">${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        </div>
        <button class="modal-close" type="button" data-close aria-label="Close dialog">${icon("x")}</button>
      </header>
      <form class="modal-form" novalidate>
        <div class="modal-body">${body}</div>
        <footer class="modal-foot">
          ${footerStart}
          ${footNote ? `<span class="modal-foot-note">${footNote}</span>` : ""}
          <button class="btn btn-secondary" type="button" data-close>${esc(cancelLabel)}</button>
          ${
            hideSubmit
              ? ""
              : `<button class="btn ${submitClass}" type="submit">${esc(submitLabel)}</button>`
          }
        </footer>
      </form>
    </div>`;

  const form = dialog.querySelector("form");
  dialog.classList.add("is-open");
  document.body.classList.add("modal-open");
  dialog.showModal();

  dialog.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (typeof onSubmit !== "function") return;
    const result = onSubmit(new FormData(form), form);
    if (result !== false) closeModal();
  });

  if (typeof onMount === "function") {
    onMount(dialog, form);
  }

  window.requestAnimationFrame(() => {
    const firstField = form.querySelector("input:not([type=radio]):not([disabled]), select:not([disabled]), textarea");
    if (firstField) {
      firstField.focus();
      if (typeof firstField.select === "function" && firstField.tagName === "INPUT" && firstField.type !== "date") {
        firstField.select();
      }
    }
  });
}

function openConfirm({ title, message, confirmLabel = "Delete", danger = true, onConfirm }) {
  openModal({
    title,
    eyebrow: "Please confirm",
    body: `<p class="confirm-copy">${message}</p>`,
    submitLabel: confirmLabel,
    submitClass: danger ? "btn-danger" : "btn-primary",
    cancelLabel: "Cancel",
    onSubmit: () => {
      if (typeof onConfirm === "function") onConfirm();
      return true;
    }
  });
}

function nextAccountColor() {
  return ACCOUNT_COLORS[state.accounts.length % ACCOUNT_COLORS.length];
}

function balanceInputValue(value) {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function openAccountModal(account = null) {
  const editing = Boolean(account);
  const balances = getBalances();
  const currentBalance = editing ? balances[account.id] || 0 : 0;
  const lockedCurrency = editing && transactionsForAccount(account.id).length > 0;
  const color = account ? account.color : nextAccountColor();
  const typeKey = account ? account.type : "checking";
  const typeOptions = Object.entries(ACCOUNT_TYPES)
    .map(
      ([key, meta]) =>
        `<option value="${key}"${typeKey === key ? " selected" : ""}>${esc(meta.label)}</option>`
    )
    .join("");

  const body = `
    <div class="form-grid">
      <div class="field field--full">
        <label for="accountName">Account name</label>
        <input id="accountName" name="name" type="text" maxlength="80" required placeholder="e.g. Main checking" value="${editing ? esc(account.name) : ""}" autocomplete="off" />
      </div>
      <div class="field">
        <label for="accountType">Account type</label>
        <select id="accountType" name="type" ${editing ? "disabled" : ""}>
          ${typeOptions}
        </select>
        ${editing ? '<p class="field-hint">Account type cannot be changed after creation.</p>' : ""}
      </div>
      <div class="field">
        <label for="accountCurrency">Currency</label>
        <select id="accountCurrency" name="currency" ${lockedCurrency ? "disabled" : ""}>
          ${state.currencies
            .map(
              (currency) =>
                `<option value="${esc(currency.code)}"${(account ? account.currency : baseCurrencyCode()) === currency.code ? " selected" : ""}>${esc(currency.code)} — ${esc(currency.name)}</option>`
            )
            .join("")}
        </select>
        ${lockedCurrency ? '<p class="field-hint">Currency is locked because this account has entries.</p>' : ""}
      </div>
      <div class="field field--full">
        <label for="accountBalance">${editing ? "Current balance" : "Starting balance"}</label>
        <div class="money-field">
          <span class="currency-prefix" id="accountCurrencyPrefix">${esc(account ? account.currency : baseCurrencyCode())}</span>
          <input id="accountBalance" name="balance" type="number" step="0.01" inputmode="decimal" value="${balanceInputValue(currentBalance)}" />
        </div>
        <p class="field-hint">${editing ? "Adjusting this changes the account's opening balance so the current balance matches." : "Use a negative number if the account is overdrawn. You can change this later."}</p>
      </div>
      <div class="field field--full">
        <span class="field-label">Accent colour</span>
        <div class="color-swatches">
          ${ACCOUNT_COLORS.map(
            (swatch) => `
            <label class="swatch-label" title="Accent ${swatch}">
              <input type="radio" name="color" value="${swatch}"${color === swatch ? " checked" : ""} />
              <span style="--swatch:${swatch}"></span>
            </label>`
          ).join("")}
        </div>
      </div>
    </div>
    <div class="modal-note">
      ${icon("lock")}
      <span>This account and its balance stay entirely on this device. Multi-currency totals use your manual rates.</span>
    </div>`;

  openModal({
    title: editing ? "Edit account" : "Add an account",
    eyebrow: "Accounts",
    subtitle: editing ? "Update the details of this account." : "Cash, bank, wallet or investment — in any currency.",
    body,
    submitLabel: editing ? "Save changes" : "Add account",
    onSubmit: (formData) => {
      const name = String(formData.get("name") || "").trim();
      const selectedType = editing ? account.type : String(formData.get("type") || "checking");
      const targetCurrency = lockedCurrency
        ? account.currency
        : String(formData.get("currency") || baseCurrencyCode());
      const targetBalance = round2(parseNumber(formData.get("balance")));
      const selectedColor = String(formData.get("color") || color);

      if (!name) {
        showToast("Give the account a name.", "error");
        return false;
      }
      if (!ACCOUNT_TYPES[selectedType]) {
        showToast("Choose a valid account type.", "error");
        return false;
      }
      if (!currencyByCode(targetCurrency)) {
        showToast("Choose a valid currency.", "error");
        return false;
      }

      if (editing) {
        const current = getBalances()[account.id] || 0;
        account.name = name;
        account.type = selectedType;
        account.currency = targetCurrency;
        account.color = selectedColor;
        account.openingBalance = round2(account.openingBalance + (targetBalance - current));
      } else {
        state.accounts.push({
          id: uid("acc"),
          name,
          type: selectedType,
          currency: targetCurrency,
          openingBalance: targetBalance,
          color: selectedColor,
          createdAt: new Date().toISOString()
        });
      }

      saveState();
      renderApp();
      showToast(editing ? "Account updated" : "Account added");
      return true;
    },
    onMount: (dialog, form) => {
      const typeSelect = form.querySelector("#accountType");
      const currencySelect = form.querySelector("#accountCurrency");
      const prefix = form.querySelector("#accountCurrencyPrefix");
      typeSelect.addEventListener("change", () => {
        const meta = ACCOUNT_TYPES[typeSelect.value];
        if (meta && currencySelect) prefix.textContent = currencySelect.value;
      });
      currencySelect.addEventListener("change", () => {
        prefix.textContent = currencySelect.value;
      });
    }
  });
}

function openCardModal(card = null) {
  const editing = Boolean(card);
  const currentOwed = editing ? cardCurrentOwed(card) : 0;
  const lockedCurrency = editing && transactionsForAccount(card.id).length > 0;
  const theme = card && CARD_THEMES[card.theme] ? card.theme : "forest";
  const defaultLimit = editing && Number(card.limit) > 0 ? card.limit : "";

  const body = `
    <div class="form-grid">
      <div class="field">
        <label for="cardName">Card name</label>
        <input id="cardName" name="name" type="text" maxlength="80" required placeholder="e.g. Everyday Visa" value="${editing ? esc(card.name) : ""}" autocomplete="off" />
      </div>
      <div class="field">
        <label for="cardIssuer">Issuer <span style="font-weight:400;color:var(--faint)">(optional)</span></label>
        <input id="cardIssuer" name="issuer" type="text" maxlength="50" placeholder="e.g. Chase" value="${editing ? esc(card.issuer || "") : ""}" autocomplete="off" />
      </div>
      <div class="field">
        <label for="cardLast4">Last 4 digits <span style="font-weight:400;color:var(--faint)">(optional)</span></label>
        <input id="cardLast4" name="last4" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]*" placeholder="1234" value="${editing ? esc(card.last4 || "") : ""}" />
      </div>
      <div class="field">
        <label for="cardCurrency">Currency</label>
        <select id="cardCurrency" name="currency" ${lockedCurrency ? "disabled" : ""}>
          ${state.currencies
            .map(
              (currency) =>
                `<option value="${esc(currency.code)}"${(card ? card.currency : baseCurrencyCode()) === currency.code ? " selected" : ""}>${esc(currency.code)} — ${esc(currency.name)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="field">
        <label for="cardLimit">Credit limit</label>
        <div class="money-field">
          <span class="currency-prefix" id="limitCurrencyPrefix">${esc(card ? card.currency : baseCurrencyCode())}</span>
          <input id="cardLimit" name="limit" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="5000" value="${defaultLimit === "" ? "" : balanceInputValue(defaultLimit)}" />
        </div>
      </div>
      <div class="field">
        <label for="cardOwed">${editing ? "Current balance owed" : "Amount owed now"}</label>
        <div class="money-field">
          <span class="currency-prefix" id="owedCurrencyPrefix">${esc(card ? card.currency : baseCurrencyCode())}</span>
          <input id="cardOwed" name="owed" type="number" min="0" step="0.01" inputmode="decimal" value="${balanceInputValue(currentOwed)}" />
        </div>
      </div>
      <div class="field">
        <label for="cardDueDay">Payment due day</label>
        <input id="cardDueDay" name="dueDay" type="number" min="1" max="31" step="1" required value="${editing ? Number(card.dueDay) || 1 : 1}" />
        <p class="field-hint">Day of each month, e.g. 28.</p>
      </div>
      <div class="field">
        <label for="cardMin">Minimum payment</label>
        <div class="money-field">
          <span class="currency-prefix" id="minCurrencyPrefix">${esc(card ? card.currency : baseCurrencyCode())}</span>
          <input id="cardMin" name="minPayment" type="number" min="0" step="0.01" inputmode="decimal" value="${editing ? balanceInputValue(card.minPayment || 0) : "0"}" />
        </div>
      </div>
      <div class="field">
        <label for="cardApr">APR <span style="font-weight:400;color:var(--faint)">(optional)</span></label>
        <div class="money-field">
          <span class="currency-prefix">%</span>
          <input id="cardApr" name="apr" type="number" min="0" step="0.01" inputmode="decimal" value="${editing ? balanceInputValue(card.apr || 0) : "0"}" />
        </div>
      </div>
      <div class="field">
        <span class="field-label">Card colour</span>
        <div class="color-swatches card-theme-swatches">
          ${Object.entries(CARD_THEMES)
            .map(
              ([key, item]) => `
              <label class="swatch-label" title="${esc(item.label)}">
                <input type="radio" name="theme" value="${key}"${theme === key ? " checked" : ""} />
                <span style="--swatch:linear-gradient(135deg, ${item.from}, ${item.to})"></span>
              </label>`
            )
            .join("")}
        </div>
      </div>
    </div>
    <div class="modal-note">
      ${icon("card")}
      <span>Add purchases from the card as expenses, and use “Pay card” to record a payment from one of your accounts. Both update this balance automatically.</span>
    </div>`;

  openModal({
    title: editing ? "Edit credit card" : "Add a credit card",
    eyebrow: "Credit cards",
    subtitle: editing ? "Update the card details and current owed amount." : "Track a card without connecting to a bank.",
    body,
    submitLabel: editing ? "Save changes" : "Add card",
    onSubmit: (formData) => {
      const name = String(formData.get("name") || "").trim();
      const issuer = String(formData.get("issuer") || "").trim();
      const last4 = String(formData.get("last4") || "").replace(/\D/g, "").slice(0, 4);
      const targetCurrency = lockedCurrency
        ? card.currency
        : String(formData.get("currency") || baseCurrencyCode());
      const limit = round2(parseNumber(formData.get("limit")));
      const owed = round2(parseNumber(formData.get("owed")));
      const dueDay = Math.round(parseNumber(formData.get("dueDay")));
      const minPayment = round2(parseNumber(formData.get("minPayment")));
      const apr = round2(parseNumber(formData.get("apr")));
      const selectedTheme = CARD_THEMES[String(formData.get("theme") || theme)]
        ? String(formData.get("theme") || theme)
        : "forest";

      if (!name) {
        showToast("Give the card a name.", "error");
        return false;
      }
      if (!currencyByCode(targetCurrency)) {
        showToast("Choose a valid currency.", "error");
        return false;
      }
      if (limit < 0 || owed < 0 || minPayment < 0 || apr < 0) {
        showToast("Amounts cannot be negative.", "error");
        return false;
      }
      if (dueDay < 1 || dueDay > 31) {
        showToast("Due day must be between 1 and 31.", "error");
        return false;
      }
      if (last4 && last4.length !== 4) {
        showToast("Enter four digits, or leave the card number blank.", "error");
        return false;
      }

      if (editing) {
        const current = getBalances()[card.id] || 0;
        const targetSigned = -owed;
        card.name = name;
        card.issuer = issuer;
        card.last4 = last4;
        card.currency = targetCurrency;
        card.limit = limit;
        card.dueDay = dueDay;
        card.minPayment = minPayment;
        card.apr = apr;
        card.theme = selectedTheme;
        card.color = CARD_THEMES[selectedTheme].from;
        card.openingBalance = round2(card.openingBalance + (targetSigned - current));
      } else {
        state.accounts.push({
          id: uid("card"),
          name,
          type: "credit",
          issuer,
          last4,
          currency: targetCurrency,
          openingBalance: -owed,
          limit,
          dueDay,
          minPayment,
          apr,
          theme: selectedTheme,
          color: CARD_THEMES[selectedTheme].from,
          createdAt: new Date().toISOString()
        });
      }

      saveState();
      renderApp();
      showToast(editing ? "Card updated" : "Credit card added");
      return true;
    },
    onMount: (dialog, form) => {
      const currencySelect = form.querySelector("#cardCurrency");
      const prefixes = [
        form.querySelector("#limitCurrencyPrefix"),
        form.querySelector("#owedCurrencyPrefix"),
        form.querySelector("#minCurrencyPrefix")
      ];
      currencySelect.addEventListener("change", () => {
        prefixes.forEach((prefix) => {
          prefix.textContent = currencySelect.value;
        });
      });
    }
  });
}

function accountOptions(selectedId, includeCredit = true) {
  const groups = [
    { label: "Cash, bank & investments", accounts: state.accounts.filter((account) => account.type !== "credit") },
    { label: "Credit cards", accounts: state.accounts.filter((account) => account.type === "credit") }
  ];

  return groups
    .filter((group) => group.accounts.length && (includeCredit || group.label !== "Credit cards"))
    .map(
      (group) => `
      <optgroup label="${group.label}">
        ${group.accounts
          .map(
            (account) =>
              `<option value="${esc(account.id)}"${account.id === selectedId ? " selected" : ""}>${esc(account.name)} · ${esc(account.currency)}</option>`
          )
          .join("")}
      </optgroup>`
    )
    .join("");
}

function categorySelectHTML(type, selected = "") {
  const list = categoryOptionsFor(type);
  return list
    .map(
      (category) =>
        `<option value="${esc(category)}"${category === selected ? " selected" : ""}>${esc(category)}</option>`
    )
    .join("");
}

function openTransactionModal(transaction = null, options = {}) {
  if (!state.accounts.length) {
    showToast("Add an account before logging a transaction.", "error");
    openAccountModal();
    return;
  }

  const editing = Boolean(transaction);
  const presetType = transaction ? transaction.type : options.presetType || "expense";
  const firstAsset = state.accounts.find((account) => account.type !== "credit");
  const presetAccountId =
    transaction?.accountId || options.presetAccountId || (firstAsset ? firstAsset.id : state.accounts[0].id);
  const presetToAccountId =
    transaction?.toAccountId || options.presetToAccountId || state.accounts.find((account) => account.id !== presetAccountId)?.id || presetAccountId;
  const presetAccount = accountById(presetAccountId) || state.accounts[0];
  const presetAmount = transaction
    ? transaction.amount
    : options.presetAmount && Number.isFinite(Number(options.presetAmount))
      ? round2(Number(options.presetAmount))
      : "";
  const prefilledToAmount = transaction && transaction.type === "transfer" ? transaction.toAmount : options.presetToAmount;
  const selectedCategory = transaction
    ? transaction.category
    : presetType === "income"
      ? "Salary"
      : "Groceries";

  const typeButton = (value, label, iconName) => `
    <label class="segment">
      <input type="radio" name="type" value="${value}"${presetType === value ? " checked" : ""} />
      <span>${icon(iconName)} ${label}</span>
    </label>`;

  const body = `
    <div class="segmented" role="radiogroup" aria-label="Transaction type">
      ${typeButton("expense", "Expense", "arrowUpRight")}
      ${typeButton("income", "Income", "arrowDownLeft")}
      ${typeButton("transfer", "Transfer", "arrows")}
    </div>
    <div class="form-divider" style="margin-top:16px"></div>
    <div class="form-grid">
      <div class="field">
        <label id="txnAccountLabel" for="txnAccount">Account</label>
        <select id="txnAccount" name="accountId" required>
          ${accountOptions(presetAccountId)}
        </select>
      </div>
      <div class="field" data-transfer-only hidden>
        <label for="txnToAccount">To account</label>
        <select id="txnToAccount" name="toAccountId">
          ${accountOptions(presetToAccountId)}
        </select>
      </div>
      <div class="field">
        <label id="txnAmountLabel" for="txnAmount">Amount</label>
        <div class="money-field">
          <span class="currency-prefix" id="txnFromCurrency">${esc(presetAccount.currency)}</span>
          <input id="txnAmount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0.00" value="${presetAmount === "" ? "" : balanceInputValue(presetAmount)}" />
        </div>
      </div>
      <div class="field" data-transfer-only hidden>
        <label for="txnToAmount">Amount received</label>
        <div class="money-field">
          <span class="currency-prefix" id="txnToCurrency">${esc(accountById(presetToAccountId)?.currency || presetAccount.currency)}</span>
          <input id="txnToAmount" name="toAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" value="${prefilledToAmount ? balanceInputValue(prefilledToAmount) : ""}" />
        </div>
      </div>
      <div class="field" data-category-only>
        <label for="txnCategory">Category</label>
        <select id="txnCategory" name="category">
          ${categorySelectHTML(presetType === "income" ? "income" : "expense", selectedCategory)}
        </select>
      </div>
      <div class="field">
        <label for="txnDate">Date</label>
        <input id="txnDate" name="date" type="date" required max="${todayISO()}" value="${transaction ? esc(transaction.date) : todayISO()}" />
      </div>
      <div class="field field--full">
        <label for="txnNote">Note <span style="font-weight:400;color:var(--faint)">(optional)</span></label>
        <input id="txnNote" name="note" type="text" maxlength="160" placeholder="What was it for?" value="${transaction ? esc(transaction.note || "") : ""}" autocomplete="off" />
      </div>
    </div>
    <p class="field-hint" id="txnTransferHint" data-transfer-only hidden>
      Uses your manual exchange rates. You can adjust the received amount for fees or rate differences.
    </p>`;

  openModal({
    title: editing ? "Edit transaction" : "Add transaction",
    eyebrow: "Activity",
    subtitle: editing ? "Change the details of this entry." : "Log money in, money out or a transfer between accounts.",
    body,
    wide: true,
    submitLabel: editing ? "Save changes" : "Add transaction",
    footerStart: editing
      ? `<button class="btn btn-soft-danger" type="button" data-action="delete-txn" data-id="${esc(transaction.id)}">${icon("trash", "btn-icon")} Delete</button>`
      : "",
    onSubmit: (formData) => {
      const type = String(formData.get("type") || presetType);
      const accountId = String(formData.get("accountId") || "");
      const account = accountById(accountId);
      const amount = round2(parseNumber(formData.get("amount")));
      const date = String(formData.get("date") || todayISO());
      const note = String(formData.get("note") || "").trim();
      const category = String(formData.get("category") || "Other");

      if (!account) {
        showToast("Choose an account.", "error");
        return false;
      }
      if (amount <= 0) {
        showToast("Enter an amount greater than zero.", "error");
        return false;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        showToast("Choose a valid date.", "error");
        return false;
      }

      const item = {
        type,
        amount,
        accountId,
        date,
        note,
        category: type === "transfer" ? "Transfer" : category
      };

      if (type === "transfer") {
        const toAccountId = String(formData.get("toAccountId") || "");
        const toAmount = round2(parseNumber(formData.get("toAmount")));
        if (!toAccountId || !accountById(toAccountId)) {
          showToast("Choose a destination account.", "error");
          return false;
        }
        if (toAccountId === accountId) {
          showToast("Choose two different accounts for a transfer.", "error");
          return false;
        }
        if (toAmount <= 0) {
          showToast("Enter the amount received.", "error");
          return false;
        }
        item.toAccountId = toAccountId;
        item.toAmount = toAmount;
      }

      if (editing) {
        delete transaction.toAccountId;
        delete transaction.toAmount;
        Object.assign(transaction, item);
      } else {
        state.transactions.push({
          id: uid("txn"),
          ...item,
          createdAt: new Date().toISOString()
        });
      }

      saveState();
      renderApp();
      showToast(editing ? "Transaction updated" : "Transaction added");
      return true;
    },
    onMount: (dialog, form) => {
      const typeInputs = Array.from(form.querySelectorAll('input[name="type"]'));
      const accountSelect = form.querySelector("#txnAccount");
      const toAccountSelect = form.querySelector("#txnToAccount");
      const amountInput = form.querySelector("#txnAmount");
      const toAmountInput = form.querySelector("#txnToAmount");
      const fromCurrency = form.querySelector("#txnFromCurrency");
      const toCurrency = form.querySelector("#txnToCurrency");
      const categorySelect = form.querySelector("#txnCategory");
      const accountLabel = form.querySelector("#txnAccountLabel");
      const amountLabel = form.querySelector("#txnAmountLabel");
      const transferFields = Array.from(form.querySelectorAll("[data-transfer-only]"));
      const categoryFields = Array.from(form.querySelectorAll("[data-category-only]"));
      let toAmountTouched = Boolean(prefilledToAmount);

      const currentType = () => {
        const checked = typeInputs.find((input) => input.checked);
        return checked ? checked.value : "expense";
      };

      const autoFillToAmount = () => {
        if (currentType() !== "transfer" || toAmountTouched) return;
        const fromAccount = accountById(accountSelect.value);
        const toAccount = accountById(toAccountSelect.value);
        const amount = parseNumber(amountInput.value);
        if (!fromAccount || !toAccount || amount <= 0) return;
        const converted = fromAccount.currency === toAccount.currency
          ? amount
          : convertCurrency(amount, fromAccount.currency, toAccount.currency);
        toAmountInput.value = converted > 0 ? balanceInputValue(converted) : "";
      };

      const syncType = (resetCategory = false) => {
        const type = currentType();
        transferFields.forEach((field) => {
          field.hidden = type !== "transfer";
        });
        categoryFields.forEach((field) => {
          field.hidden = type === "transfer";
        });
        accountLabel.textContent = type === "transfer" ? "From account" : "Account";
        amountLabel.textContent = type === "transfer" ? "Amount sent" : "Amount";
        if (resetCategory) {
          const list = categoryOptionsFor(type === "income" ? "income" : "expense");
          categorySelect.innerHTML = categorySelectHTML(type === "income" ? "income" : "expense", list[0]);
        }
        if (type === "transfer") autoFillToAmount();
      };

      const syncCurrency = () => {
        const fromAccount = accountById(accountSelect.value);
        const toAccount = accountById(toAccountSelect.value);
        fromCurrency.textContent = fromAccount ? fromAccount.currency : baseCurrencyCode();
        toCurrency.textContent = toAccount ? toAccount.currency : fromAccount ? fromAccount.currency : baseCurrencyCode();
      };

      typeInputs.forEach((input) => {
        input.addEventListener("change", () => {
          toAmountTouched = false;
          if (input.value === "transfer" && toAmountInput.value) {
            toAmountTouched = false;
          }
          syncType(true);
        });
      });

      accountSelect.addEventListener("change", () => {
        syncCurrency();
        if (!toAmountTouched) autoFillToAmount();
      });

      toAccountSelect.addEventListener("change", () => {
        toAmountTouched = false;
        syncCurrency();
        autoFillToAmount();
      });

      amountInput.addEventListener("input", () => {
        if (!toAmountTouched) autoFillToAmount();
      });

      toAmountInput.addEventListener("input", () => {
        toAmountTouched = toAmountInput.value !== "";
      });

      syncType(false);
      syncCurrency();
      if (currentType() === "transfer" && !toAmountTouched) autoFillToAmount();
    }
  });
}
