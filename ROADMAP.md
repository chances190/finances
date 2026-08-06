# Repository Roadmap

## Macro Plan
- **Current Milestone:** Budget ranges & bug-fix sweep (v0.1.x hardening)
- **Goal:** The finances app is a feature-complete single-user personal finance tracker (transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode). Direction: budget ranges landed (2026-08-06); now run the Bug Fix Backlog sweep (hardening the data-integrity/timezone holes found in review), close the last polish gaps, and only then tackle the deferred debt/installment features before any move toward persistence or multi-user.

---

## Active Card
> *There can only be ONE Active card at a time. Finish or push to Next before opening another.*

### Bug Fix Sweep — HIGH (data integrity & timezone)
- **Intent:** Close the six user-visible HIGH bugs from the 2026-08-06 code review before feature work continues. These are the data-integrity holes that make the prototype untrustworthy: a silent no-op modal, lossy JSON import, UTC timezone slicing, a validation bypass, a lexicographic sort, and invalid payment-method persistence.
- **Trade-offs / Risks:**
  - Fixes are surgical per finding — this is hardening, not refactoring; do not redesign components beyond the minimum (KISS/YAGNI).
  - The UTC-slicing fix touches three call sites (DashboardPage, BudgetPage, SmartTransactionInput) — centralize one local `YYYY-MM`/`YYYY-MM-DD` helper in `domain/calculations.ts` (per ADR-0004) instead of patching each site.
  - BudgetPage's `nextMonth` fallback (BudgetPage.tsx:49) is one of the UTC sites — keep the budget-ranges behavior intact while fixing it.
- **Acceptance Criteria (DoD):**
  - [ ] Add-transaction modal Save actually creates the transaction (TransactionForm.tsx:109 early-return removed)
  - [ ] `.json` import restores budgets too — lossless round-trip per ADR-0005; add/extend a test
  - [ ] No `toISOString().slice(0,7/10)` left in UI code; all month/day strings use the local helper
  - [ ] Income payment-method validation can't be bypassed via `|| INCOME_PAYMENT_METHODS.includes(...)` (validation.ts:14-17); add a test
  - [ ] Amount column sorts numerically, not lexicographically (TransactionTable.tsx:108-110); add a test
  - [ ] Smart input only persists valid payment methods; invalid labels show an error instead of persisting (SmartTransactionInput.tsx:67-71)
  - [ ] `bun run typecheck`, `bun run lint`, and `bun test` pass
- **Out of Scope:** MED/LOW backlog items (installment regeneration, Ctrl+Z focus guard, float-money aggregations, etc.), no new features, no persistence changes, no debt/installment feature work, no rework of the landed budget-ranges behavior.

---

## Next Cards
> *Direction-only one-liners for future work in this milestone.*

- **Skeleton loading states for Dashboard:** Add lightweight loading placeholders for Dashboard (carried over from the old UI/UX plan, Commit 9 — not yet implemented).
- **Advance-pay for credit installments:** Let users pay the next N installments now and shift the remainder (deferred from the old Refactor Plan).
- **Unify income vs debt UX:** Income should hide debt/installment controls consistently across QuickAddRow, TransactionForm, and DebtConfigModal (deferred from the old Refactor Plan).
- **Actions panel label cleanup:** Rename the "Action History" panel title in AuditLogPanel to match the "Actions" terminology used elsewhere.

---

## Bug Fix Backlog
> *Code-review sweep 2026-08-06. Severity: HIGH = user-visible data/logic bug, MED = error-prone or inconsistent, LOW = hygiene. The six HIGH items are now tracked as the Active Card.*

### HIGH — User-visible bugs
- **Add-transaction modal is a silent no-op:** `TransactionForm.handleSave` early-returns when `editTransaction` is absent, but the Add dialog renders a fillable form; clicking Save does nothing. (TransactionForm.tsx:109, wired at TransactionTable.tsx:479)
- **JSON import drops budgets:** CSVImportDialog imports only `transactions` from `.json` files; the full-document backup restores without budgets, contradicting ADR-0005's lossless claim. (CSVImportDialog.tsx:60,83)
- **UTC month/day slicing shifts data for UTC-offset users:** `new Date().toISOString().slice(0,7/10)` in DashboardPage:76, BudgetPage:37, SmartTransactionInput:98 — off-by-one month/day for Brazil (UTC-3) at month start; domain uses local `currentYM()`. Contradicts ADR-0004; centralize a local `YYYY-MM`/`YYYY-MM-DD` helper.
- **Validation bypass for income payment methods:** `|| INCOME_PAYMENT_METHODS.includes(...)` escapes the field checks; any object with paymentMethod SALARY/TRANSFER/VOUCHER passes with no id/date/amount. (validation.ts:14-17)
- **Amount sort is lexicographic:** `String(a.amount).localeCompare(b)` orders "100" before "20". (TransactionTable.tsx:108-110)
- **Smart input persists invalid payment methods:** unmatched method label falls back to `raw.toUpperCase()`; invalid values are later silently dropped by validation on reload. (SmartTransactionInput.tsx:67-71)

### MED — Error-prone / inconsistent
- **Editing an installment series doesn't regenerate siblings:** changing `installmentTotal` updates one transaction's metadata only, leaving the group inconsistent. (TransactionForm.tsx:120-123)
- **Editing a debt resets per-split `settled` flags:** `DebtSplitUI` drops `settled`; partial settlements are lost on edit. (TransactionForm.tsx:83-94,126-129)
- **Global Ctrl+Z/Ctrl+Y hijacks text-input undo:** App.tsx keydown handler has no focus guard; typing in the smart input/forms and pressing Ctrl+Z undoes a finance action instead of text. (App.tsx)
- **Silent data filtering on import/load:** `validateFinanceData` filters invalid transactions, `importCSV` skips mismatched rows — partial data drops without notice. (validation.ts:46, exportImport.ts:94)
- **Money sums use raw float `+`:** calculations.ts aggregations and DebtPage totals bypass currency.js; safe only because display rounds to cents — conflicts with ADR-0004. (calculations.ts:87,98, etc.)
- **Fixed `DAYS_IN_MONTH = 30` pace:** February shows "Day 28/30" and day-31 spending is excluded from pace charts; acceptable convention but error-prone.
- **Type switch keeps stale payment method:** switching EXPENSE→INCOME in the form keeps CREDIT, producing an INCOME/CREDIT inconsistency. (TransactionForm.tsx:170-174)

### LOW — Hygiene & consistency
- **Dead code — QuickAddRow.tsx:** replaced by SmartTransactionInput (ec9bf55) but never deleted; contains float-money and UTC-slicing remnants.
- **tsconfig.tsbuildinfo tracked in git:** build artifact; add to `.gitignore` and untrack.
- **`parseFloat` for a disabled-state check** bypasses currency.js. (TransactionForm.tsx:308)

---

## Done Cards
> *Completed cards with objective outcomes.*

- **Budget ranges (Active Card, 2026-08-06):** Replaced per-month navigation with From→To range creation and derived grouping. Landed as commits 066e59d → b2e31b1:
  - Table groups consecutive equal budgets into `start – end` rows with a `· N months` hint and a single "Current" badge (`groupBudgetsByRange` in `domain/calculations.ts` + 7 unit tests)
  - Create and edit share a Single/Range toggle with a live "Creating/Editing budget for N months (from – to)" summary
  - Edit prefills the group's From→To; extend/shrink/override all work; shrinking or overlapping asks for in-dialog confirmation listing the affected months (policy per ADR-0008)
  - Delete on a group row removes every month in the range after confirmation
  - Clone from prev keeps the target month (off-by-one fix)
  - Also landed with the checkpoint: trends chart `allowDataOverflow` fix (cdcfd98)
- **Refactor plan (8 commits):** Core types/constants cleanup, type-safety patch, state-management fixes, non-blocking toast/ConfirmDialog UX, domain utility extraction, UI consistency & dark mode, original TODO bugs (isDebt toggle, negative validation), BudgetFormDialog extraction. Landed as commits 0a34bb1 → 007141d.
- **UI/UX fix plan (Commit 1–9 + polish):** Design system foundation, INCOME transaction support, accessibility, interaction safety, chart improvements, search/filters, budget form & debt polish, content/labels/empty states, dark mode toggle + persistence, plus follow-up polish (sortable columns, smart comma-delimited input, income-by-account cards, dark-mode text fixes). Landed as commits bac1178 → 407a5cd.
