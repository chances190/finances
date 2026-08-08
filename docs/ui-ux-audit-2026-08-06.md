# UI/UX Audit — Findings Inventory (2026-08-06)

Evidence-backed inventory behind the **UI/UX Consistency Pass** Active Card (see `ROADMAP.md`). Produced by a full read of every UI surface: App, all 4 page components, both dialogs, common components, transaction table, smart input, import dialog, toasts, error boundary.

## Findings inventory

### A. Inconsistencies between pages / actions (the "internally-inconsistent" you flagged)

| # | Finding | Evidence |
|---|---------|----------|
| A1 | **Three different toggle/segmented-control implementations.** Hand-rolled `<button>` toggles (no aria, no keyboard nav) in TransactionForm (Expense/Income) and DebtPage (Per-Tx/Per-Person); shadcn `Tabs` in BudgetFormDialog (Single/Range) and App (tab bar). The hand-rolled pair doesn't even match each other (`flex-1 py-1.5 border-input` vs `px-2 py-0.5` in a bordered box) | `TransactionForm.tsx:186-217`, `DebtPage.tsx:108-125`, `BudgetFormDialog.tsx:262-282` |
| A2 | **Two confirmation patterns.** Delete flows use the modal `ConfirmDialog` (Cancel/Confirm); budget overwrite/removal uses an inline dialog view with "Back"/"Continue" — a navigation verb, not a cancel verb | `ConfirmDialog.tsx`, `BudgetFormDialog.tsx:223-246` |
| A3 | **Money entry is inconsistent across the app.** Smart input is text + `parseCurrency` (accepts `450,50`, `1.234,56`); the modal forms use `type="number"` (comma decimals break in most browsers, spinners, and edit-prefill shows `450.5` after you saved `450,50` via `String(budget.plannedIncome)`) | `SmartTransactionInput.tsx:108-118`, `TransactionForm.tsx:235-242`, `BudgetFormDialog.tsx:349-370,427-440,45-60` |
| A4 | **Custom categories are a one-way door.** BudgetFormDialog lets you create custom categories; TransactionForm's Category select lists only `DEFAULT_CATEGORIES` — so a category you created in Budget can never be assigned in the transaction modal. Meanwhile the smart input's *category* token suggests past **descriptions** (creating accidental custom categories) | `BudgetFormDialog.tsx:384-414`, `TransactionForm.tsx:270-275`, `SmartTransactionInput.tsx:47-51` |
| A5 | **Page-title/naming drift.** Tab "Trends" vs h2 "Yearly Trends" vs component TrendsPage; tab "Actions" vs panel title "Action History" (already on Next Cards — I'd fold it into this pass) | `App.tsx`, `TrendsPage.tsx:109`, `AuditLogPanel.tsx` |
| A6 | **Toolbar controls don't match.** Search Input + month Select use theme defaults; the Category/Payment filter triggers are hand-rolled PopoverTriggers with a giant inline class string including `rounded-none` (square corners next to rounded inputs) | `TransactionTable.tsx:251,277` |
| A7 | **`rounded-none` (square-corner language) leaks** into dropzone, error box, segmented controls — conflicts with shadcn's rounded defaults everywhere else | `CSVImportDialog.tsx:119,143`, `TransactionTable.tsx:251,277`, `DebtPage.tsx:108` |
| A8 | **Money axis labels bypass `formatCurrency`** (`R$${v}` → `R$1234` next to tooltip `R$ 1.234,00`) | `DashboardPage.tsx:346,415,492`, `TrendsPage.tsx:197,249,300,347` |

### B. Anti-patterns / glitches

| # | Finding | Evidence |
|---|---------|----------|
| B1 | **Identical suggestion sets for token 2 (description) and token 3 (category)** — description autocomplete offers categories; category autocomplete offers past descriptions. Semantics blurred | `SmartTransactionInput.tsx:42-51` |
| B2 | **`currentMonth` reimplements `currentYM()`** inline (the exact helper we added in the sweep) — drift risk; plus the *same* spending filter is duplicated twice in one file (`paceStatus` and `spentSoFar`, byte-identical) | `DashboardPage.tsx:121`, `:136-141` vs `:152-158` |
| B3 | **10+ copies of identical KPI-card JSX** (Dashboard 6, Trends 4) — and the Dashboard page mixes two card styles (`border bg-card` vs `PaceKpi`'s `rounded-lg bg-muted/50`) | `DashboardPage.tsx:202-261`, `TrendsPage.tsx:137-178`, `DashboardPage.tsx:63-70` |
| B4 | **Chart boilerplate duplicated ~7×** (same Tooltip contentStyle, axis tick props, Legend) — maintenance smell | `DashboardPage.tsx`, `TrendsPage.tsx` |
| B5 | **Section-header hierarchy varies within one page**: `text-xs uppercase tracking-wider` ("Income by Account") beside `text-sm font-semibold` ("Spending Pace", "Budget vs Actual", "Payment Methods") | `DashboardPage.tsx:265` vs `:297,:472,:523` |
| B6 | **Affordance lies**: future budgets (`opacity-60`) and settled rows (`opacity-50`) look disabled but are fully clickable | `BudgetPage.tsx:104`, `DebtPage.tsx:152,220`, `TransactionTable.tsx:373` |
| B7 | **Split-row settle toggles**: single-split button flips its label from `100%` to `Settled` (with line-through) — plain text, no button affordance, label changes meaning; `title` tooltips (mouse-only) duplicated onto `aria-label` | `DebtPage.tsx:263-275,282-283`, `TransactionTable.tsx:447-448` |
| B8 | **Empty states come in 3 shapes**: in-table centered row (Transactions, Budgets), separate bordered div (Debts), centered h-64 div (Dashboard, Trends) | `TransactionTable.tsx:359-364`, `BudgetPage.tsx:86-92`, `DebtPage.tsx:198-200` |
| B9 | **Toasts**: `font-mono` in a money app, 3s auto-dismiss, no close, no `role="status"`/`aria-live` | `ToastContext.tsx` |
| B10 | **`c` shadows `currency.js` import** in DebtConfigModal (`setTempConfig((c) => …)`) | `DebtConfigModal.tsx:2,41` |
| B11 | **Type column is `+`/`−` glyphs only** — no text, weak screen-reader output, no debt indicator | `TransactionTable.tsx:380-385` |
| B12 | **Page heading hierarchy quirk**: every page h2 is `text-sm font-semibold` — top-level page names are visually *smaller* than KPI numbers (`text-xl font-bold`) | all pages |
