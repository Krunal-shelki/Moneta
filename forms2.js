/* =========================================================
   Moneta — borrow/lend forms, details and currency form
   ========================================================= */

function openDebtModal(debt = null, options = {}) {
  const editing = Boolean(debt);
  const direction = debt ? debt.direction : options.direction || "lent";
  const lockedCurrency = editing && (debt.payments || []).length > 0;
  const paid = editing ? debtPaid(debt) : 0;

  const directionButton = (value, label, iconName) => `
    <label class="segment">
      <input type="radio" name="direction" value="${value}"${direction === value ? " checked" : ""} />
      <span>${icon(iconName)} ${label}</span>
    </label>`;

  const body = `
    <div class="segmented" role="radiogroup" aria-label="Direction">
      ${directionButton("lent", "I lent money", "arrowUpRight")}
      ${directionButton("borrowed", "I borrowed", "arrowDownLeft")}
    </div>
    <div class="form-divider" style="margin-top:16px"></div>
    <div class="form-grid">
      <div class="field field--full">
        <label for="debtPerson">Person or business</label>
        <input id="debtPerson" name="person" type="text" maxlength="80" required placeholder="Who is this with?" value="${editing ? esc(debt.person) : ""}" autocomplete="off" />
      </div>
      <div class="field">
        <label for="debtAmount">Amount</label>
        <div class="money-field">
          <span class="currency-prefix" id="debtCurrencyPrefix">${esc(debt ? debt.currency : baseCurrencyCode())}</span>
          <input id="debtAmount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0.00" value="${editing ? balanceInputValue(debt.amount) : ""}" />
        </div>
      </div>
      <div class="field">
        <label for="debtCurrency">Currency</label>
        <select id="debtCurrency" name="currency" ${lockedCurrency ? "disabled" : ""}>
          ${state.currencies
            .map(
              (currency) =>
                `<option value="${esc(currency.code)}"${(debt ? debt.currency : baseCurrencyCode()) === currency.code ? " selected" : ""}>${esc(currency.code)} — ${esc(currency.name)}</option>`
            )
            .join("")}
        </select>
        ${lockedCurrency ? '<p class="field-hint">Currency is locked because payments are recorded.</p>' : ""}
      </div>
      <div class="field">
        <label for="debtDate">Date</label>
        <input id="debtDate" name="date" type="date" required max="${todayISO()}" value="${editing ? esc(debt.date) : todayISO()}" />
      </div>
      <div class="field">
        <label for="debtDueDate">Due date <span style="font-weight:400;color:var(--faint)">(optional)</span></label>
        <input id="debtDueDate" name="dueDate" type="date" value="${editing ? esc(debt.dueDate || "") : ""}" />
      </div>
      <div class="field field--full">
        <label for="debtNote">Note <span style="font-weight:400;color:var(--faint)">(optional)</span></label>
        <input id="debtNote" name="note" type="text" maxlength="200" placeholder="What was it for?" value="${editing ? esc(debt.note || "") : ""}" autocomplete="off" />
      </div>
    </div>
    ${
      editing && paid > 0
        ? `<div class="modal-note">${icon("alert")}<span>${formatMoney(paid, debt.currency)} has already been repaid. The principal cannot be set below that amount.</span></div>`
        : ""
    }`;

  openModal({
    title: editing ? "Edit record" : "Add a borrow or lend record",
    eyebrow: "Borrow & lend",
    subtitle: editing ? "Update this personal loan." : "Track money outside your accounts. No linked bank required.",
    body,
    submitLabel: editing ? "Save changes" : "Add record",
    onSubmit: (formData) => {
      const selectedDirection = String(formData.get("direction") || direction);
      const person = String(formData.get("person") || "").trim();
      const amount = round2(parseNumber(formData.get("amount")));
      const selectedCurrency = lockedCurrency
        ? debt.currency
        : String(formData.get("currency") || baseCurrencyCode());
      const date = String(formData.get("date") || todayISO());
      const dueDate = String(formData.get("dueDate") || "");
      const note = String(formData.get("note") || "").trim();

      if (!person) {
        showToast("Add the person or business name.", "error");
        return false;
      }
      if (amount <= 0) {
        showToast("Enter an amount greater than zero.", "error");
        return false;
      }
      if (!currencyByCode(selectedCurrency)) {
        showToast("Choose a valid currency.", "error");
        return false;
      }
      if (editing && amount < paid) {
        showToast("The amount cannot be lower than what has already been repaid.", "error");
        return false;
      }
      if (dueDate && dueDate < date) {
        showToast("Due date cannot be before the start date.", "error");
        return false;
      }

      if (editing) {
        debt.direction = selectedDirection;
        debt.person = person;
        debt.amount = amount;
        debt.currency = selectedCurrency;
        debt.date = date;
        debt.dueDate = dueDate;
        debt.note = note;
      } else {
        state.debts.push({
          id: uid("debt"),
          direction: selectedDirection,
          person,
          amount,
          currency: selectedCurrency,
          date,
          dueDate,
          note,
          payments: [],
          createdAt: new Date().toISOString()
        });
      }

      saveState();
      renderApp();
      showToast(editing ? "Record updated" : "Record added");
      return true;
    },
    onMount: (dialog, form) => {
      const currencySelect = form.querySelector("#debtCurrency");
      const prefix = form.querySelector("#debtCurrencyPrefix");
      const dueInput = form.querySelector("#debtDueDate");
      const dateInput = form.querySelector("#debtDate");
      currencySelect.addEventListener("change", () => {
        prefix.textContent = currencySelect.value;
      });
      dateInput.addEventListener("change", () => {
        dueInput.min = dateInput.value || "";
      });
      if (dateInput.value) dueInput.min = dateInput.value;
    }
  });
}

function openPaymentModal(debt) {
  const outstanding = debtOutstanding(debt);
  if (outstanding <= 0) {
    showToast("This record is already settled.");
    return;
  }

  const paid = debtPaid(debt);
  const body = `
    <div class="modal-summary">
      <div class="modal-summary-row"><span>Principal</span><strong>${formatMoney(debt.amount, debt.currency)}</strong></div>
      <div class="modal-summary-row"><span>Already repaid</span><strong>${formatMoney(paid, debt.currency)}</strong></div>
      <div class="modal-summary-row is-total"><span>Still outstanding</span><strong>${formatMoney(outstanding, debt.currency)}</strong></div>
    </div>
    <div class="form-grid">
      <div class="field">
        <label for="paymentAmount">Payment amount</label>
        <div class="money-field">
          <span class="currency-prefix">${esc(debt.currency)}</span>
          <input id="paymentAmount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required value="${balanceInputValue(outstanding)}" />
        </div>
      </div>
      <div class="field">
        <label for="paymentDate">Date</label>
        <input id="paymentDate" name="date" type="date" required max="${todayISO()}" value="${todayISO()}" />
      </div>
      <div class="field field--full">
        <label for="paymentNote">Note <span style="font-weight:400;color:var(--faint)">(optional)</span></label>
        <input id="paymentNote" name="note" type="text" maxlength="120" placeholder="e.g. Bank transfer" autocomplete="off" />
      </div>
    </div>
    <div class="modal-note">
      ${icon("handshake")}
      <span>${debt.direction === "lent" ? "This records money received back from" : "This records money you paid to"} <strong>${esc(debt.person)}</strong>. It does not move money between your accounts.</span>
    </div>`;

  openModal({
    title: "Record a payment",
    eyebrow: debt.direction === "lent" ? "Money received" : "Money paid",
    subtitle: `${debt.person} · ${debt.currency}`,
    body,
    submitLabel: "Record payment",
    onSubmit: (formData) => {
      const amount = round2(parseNumber(formData.get("amount")));
      const date = String(formData.get("date") || todayISO());
      const note = String(formData.get("note") || "").trim();

      if (amount <= 0) {
        showToast("Enter a payment amount greater than zero.", "error");
        return false;
      }
      if (amount > outstanding + 0.005) {
        showToast("Payment cannot be more than the outstanding amount.", "error");
        return false;
      }

      debt.payments.push({
        id: uid("pay"),
        amount,
        date,
        note,
        createdAt: new Date().toISOString()
      });

      saveState();
      renderApp();
      const remaining = debtOutstanding(debt);
      showToast(remaining <= 0 ? "Payment recorded · fully settled" : "Payment recorded");
      return true;
    }
  });
}

function openDebtDetails(debt) {
  const outstanding = debtOutstanding(debt);
  const paid = debtPaid(debt);
  const status = debtStatus(debt);
  const isLent = debt.direction === "lent";
  const payments = [...(debt.payments || [])].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });

  const body = `
    <div class="modal-summary">
      <div class="modal-summary-row"><span>Direction</span><strong>${isLent ? "You lent money" : "You borrowed money"}</strong></div>
      <div class="modal-summary-row"><span>Principal</span><strong>${formatMoney(debt.amount, debt.currency)}</strong></div>
      <div class="modal-summary-row"><span>Repaid</span><strong>${formatMoney(paid, debt.currency)}</strong></div>
      <div class="modal-summary-row is-total"><span>Outstanding</span><strong>${formatMoney(outstanding, debt.currency)}</strong></div>
    </div>
    <div class="form-grid">
      <div class="field">
        <label>Person or business</label>
        <input type="text" value="${esc(debt.person)}" disabled />
      </div>
      <div class="field">
        <label>Status</label>
        <input type="text" value="${esc(status.label)}" disabled />
      </div>
      <div class="field">
        <label>Started</label>
        <input type="text" value="${esc(formatLongDate(debt.date))}" disabled />
      </div>
      <div class="field">
        <label>Due date</label>
        <input type="text" value="${debt.dueDate ? esc(formatLongDate(debt.dueDate)) : "No due date"}" disabled />
      </div>
      ${
        debt.note
          ? `<div class="field field--full"><label>Note</label><input type="text" value="${esc(debt.note)}" disabled /></div>`
          : ""
      }
    </div>
    <div class="payment-history">
      <h3>Payment history</h3>
      ${
        payments.length
          ? payments
              .map(
                (payment) => `
            <div class="payment-row">
              <span class="payment-dot"></span>
              <div class="payment-row-main">
                <strong>${formatMoney(payment.amount, debt.currency)}</strong>
                <span>${esc(formatLongDate(payment.date))}${payment.note ? ` · ${esc(payment.note)}` : ""}</span>
              </div>
              <span class="payment-row-amount">${formatMoney(payment.amount, debt.currency)}</span>
              <button class="payment-delete" type="button" data-action="delete-payment" data-id="${esc(debt.id)}" data-payment-id="${esc(payment.id)}" aria-label="Delete payment" title="Delete payment">${icon("trash")}</button>
            </div>`
              )
              .join("")
          : `<p class="field-hint">No payments recorded yet.</p>`
      }
    </div>`;

  openModal({
    title: debt.person,
    eyebrow: isLent ? "Owed to you" : "You owe",
    subtitle: debt.note || "Borrow and lend record",
    body,
    hideSubmit: true,
    cancelLabel: "Close",
    footerStart:
      outstanding > 0
        ? `<button class="btn btn-primary" type="button" data-action="pay-debt" data-id="${esc(debt.id)}">Record payment</button>`
        : "",
    onMount: () => {}
  });
}

function openCurrencyModal() {
  const body = `
    <div class="form-grid">
      <div class="field">
        <label for="currencyCode">Currency code</label>
        <input id="currencyCode" name="code" type="text" maxlength="6" required placeholder="e.g. THB" autocomplete="off" style="text-transform:uppercase" />
        <p class="field-hint">2–6 letters or numbers.</p>
      </div>
      <div class="field">
        <label for="currencySymbol">Symbol</label>
        <input id="currencySymbol" name="symbol" type="text" maxlength="6" placeholder="e.g. ฿" autocomplete="off" />
      </div>
      <div class="field field--full">
        <label for="currencyName">Currency name</label>
        <input id="currencyName" name="name" type="text" maxlength="50" required placeholder="e.g. Thai Baht" autocomplete="off" />
      </div>
      <div class="field field--full">
        <label for="currencyRate">Manual exchange rate</label>
        <div class="money-field">
          <span class="currency-prefix">1 unit =</span>
          <input id="currencyRate" name="rate" type="number" min="0.00000001" step="any" inputmode="decimal" required placeholder="0.00" />
          <span class="rate-base-label" style="padding-right:11px">${esc(baseCurrencyCode())}</span>
        </div>
        <p class="field-hint">How many ${esc(baseCurrencyCode())} one unit of the new currency is worth. You can edit this later in Settings.</p>
      </div>
    </div>
    <div class="modal-note">
      ${icon("lock")}
      <span>No rates are downloaded. This value is yours to maintain and is used for all converted totals.</span>
    </div>`;

  openModal({
    title: "Add a currency",
    eyebrow: "Manual rates",
    subtitle: `Rates are stored as units of ${baseCurrencyCode()}.`,
    body,
    submitLabel: "Add currency",
    onSubmit: (formData) => {
      const code = String(formData.get("code") || "").trim().toUpperCase();
      const name = String(formData.get("name") || "").trim();
      const symbol = String(formData.get("symbol") || "").trim();
      const rate = Number(formData.get("rate"));

      if (!/^[A-Z0-9]{2,6}$/.test(code)) {
        showToast("Use a 2–6 character currency code.", "error");
        return false;
      }
      if (currencyByCode(code)) {
        showToast("That currency already exists.", "error");
        return false;
      }
      if (!name) {
        showToast("Add a currency name.", "error");
        return false;
      }
      if (!Number.isFinite(rate) || rate <= 0) {
        showToast("Enter a rate greater than zero.", "error");
        return false;
      }

      state.currencies.push({
        code,
        name,
        symbol: symbol || code,
        rate: roundRate(rate)
      });
      saveState();
      renderApp();
      showToast(`${code} added`);
      return true;
    },
    onMount: (dialog, form) => {
      const code = form.querySelector("#currencyCode");
      code.addEventListener("input", () => {
        const position = code.selectionStart;
        code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
        code.setSelectionRange(position, position);
      });
    }
  });
}
