# Repository Roadmap

## Macro Plan
- **Current Milestone:** Bug-fix hardening (v0.1.x)
- **Goal:** The finances app is a feature-complete single-user personal finance tracker (transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode). Direction: UI/UX Consistency Pass next, then mobile usability + skeleton loading, then advance-pay.

---

## Active Card
> *There can only be ONE Active Card at a time. Finish or push to Next before opening another.*

- **UI/UX Consistency Pass + income/debt UX unification (2026-08-07, PARTIALLY IMPLEMENTED):** remaining tasks from docs/ui-ux-audit-2026-08-06.md plus: fold "Unify income vs debt UX" into this card (hide debt/installment controls for INCOME consistently across SmartTransactionInput, TransactionForm, DebtConfigModal); refactor import/export UI so ExportImport + CSVImportDialog surface the new v2 model cleanly (backup vs exchange distinction, clear version-mismatch guidance); one segmented/toggle vocabulary, one confirmation pattern, money-entry via `parseCurrency`, no `rounded-none` on interactive elements, no opacity-dimmed rows without state indicator, standardized h2/section headers, shared StatCard, unified empty states, toast pass.

  **New items (2026-09-12):**
  - **(a) Debt split "your share" visibility** — DebtConfigModal shows a read-only "Your share: R$X" row derived from `amount - Σdebts` so the user sees their remainder; no model change.
  - **(b) Debt button styling** in Add Transaction modal — align with rest of form.
  - **(c) Payment method case mismatch** — Select shows uppercase before click, lowercase in dropdown options; normalize to consistent casing.
  - **(d) Transactions table: future installments** — show as inline rows (one per monthlyFlow), dim future flows; add installment index badge (e.g. "2/6").
  - **(e) Rename "Details" → "Debts"** column in TransactionTable.
  - **(f) Debt splits validation** — prevent debt total from exceeding transaction amount (DebtConfigModal + TransactionForm save guard).

## Next Cards
> *Direction-only one-liners for future work in this milestone.*

- **Mobile usability:** App must be 100% usable on mobile (intent: responsive-first via CSS — Tailwind v4 + shadcn are mobile-first, adapt Tabs → bottom nav, reflow the transactions table, bottom-sheet dialogs; no dedicated mobile UI unless PWA/native needs emerge).
- **Skeleton loading states for Dashboard:** Add lightweight loading placeholders for Dashboard (carried over from the old UI/UX plan, Commit 9 — not yet implemented).
- **Advance-pay for credit installments:** Let users pay the next N installments now and shift the remainder (deferred from the old Refactor Plan; requires a `paidInstallments` marker in the model).

---

## Bug Fix Backlog
> *Code-review sweep 2026-08-06. Severity: HIGH = user-visible data/logic bug, MED = error-prone or inconsistent, LOW = hygiene. The six HIGH items are closed (2026-08-06, commits 252382e → ef32afd + dead-code cleanup 380c687); the MED items are candidates for the next Active Card.*

### HIGH — User-visible bugs (all closed)
- ~~**Add-transaction modal is a silent no-op:**~~ `TransactionForm.handleSave` early-returns when `editTransaction` is absent, but the Add dialog renders a fillable form; clicking Save does nothing. (TransactionForm.tsx:109, wired at TransactionTable.tsx:479)
- ~~**JSON import drops budgets:**~~ CSVImportDialog imports only `transactions` from `.json` files; the full-document backup restores without budgets, contradicting ADR-0005's lossless claim. (CSVImportDialog.tsx:60,83)
- ~~**UTC month/day slicing shifts data for UTC-offset users:**~~ `new Date().toISOString().slice(0,7/10)` in DashboardPage:76, BudgetPage:37, SmartTransactionInput:98 — off-by-one month/day for Brazil (UTC-3) at month start; domain uses local `currentYM()`. Contradicts ADR-0004; centralize a local `YYYY-MM`/`YYYY-MM-DD` helper.
- ~~**Validation bypass for income payment methods:**~~ `|| INCOME_PAYMENT_METHODS.includes(...)` escapes the field checks; any object with paymentMethod SALARY/TRANSFER/VOUCHER passes with no id/date/amount. (validation.ts:14-17)
- ~~**Amount sort is lexicographic:**~~ `String(a.amount).localeCompare(b)` orders "100" before "20". (TransactionTable.tsx:108-110)
- ~~**Smart input persists invalid payment methods:**~~ unmatched method label falls back to `raw.toUpperCase()`; invalid values are later silently dropped by validation on reload. (SmartTransactionInput.tsx:67-71)

### MED — Error-prone / inconsistent (all closed)
- ~~**Editing an installment series doesn't regenerate siblings:**~~ RESOLVED (2026-09-08): siblings no longer exist — installments are derived from `installments?: number` via `monthlyFlows()`.
- ~~**Editing a debt resets per-split `settled` flags:**~~ RESOLVED (2026-09-08): debts stored as `Debt[]` with `settled` per entry; edit preserves the array.
- ~~**Type switch keeps stale payment method:**~~ RESOLVED (2026-09-12): payment method now resets to a valid default (SALARY for INCOME, DEBIT for EXPENSE) on type change. (TransactionForm.tsx)
- ~~**Global Ctrl+Z/Ctrl+Y hijacks text-input undo:**~~ RESOLVED (2026-09-12): focus guard skips undo/redo intercept when active element is input/textarea/select/contentEditable. (App.tsx)
- ~~**Silent data filtering on import/load:**~~ RESOLVED (2026-09-12): `validateFinanceData` and `importCSV` now return skipped row counts/line numbers; import dialog surfaces them to the user. (validation.ts, csv.ts, CSVImportDialog.tsx)
- ~~**Money sums use raw float `+`:~~ RESOLVED (2026-09-12): all monetary reduces/wraps in calculations.ts and DebtPage.tsx now use `addCurrency` (currency.js). (lib/currency.ts, calculations.ts, DebtPage.tsx)
- ~~**Fixed `DAYS_IN_MONTH = 30` pace:**~~ RESOLVED (2026-09-12): replaced with `daysInMonth(ym)` helper using actual calendar; pace chart shows real month length; `DAYS_IN_MONTH` constant deleted. (calculations.ts, constants.ts, DashboardPage.tsx)

### LOW — Hygiene & consistency
- ~~**Dead code — QuickAddRow.tsx:**~~ replaced by SmartTransactionInput (ec9bf55) and deleted 2026-08-06 (380c687).
- ~~**tsconfig.tsbuildinfo tracked in git:**~~ added to `.gitignore` and untracked (34ebd77).
- **`parseFloat` for a disabled-state check** bypasses currency.js. (TransactionForm.tsx:308)

---

## Done Cards
> *Completed cards with objective outcomes.*

- **MED bug fix round (Active Card, 2026-09-12):** Closed 5 MED bugs: (1) stale payment method on type switch — reset to valid default (SALARY/DEBIT); (2) Ctrl+Z/Ctrl+Y focus guard — skip intercept on text-input elements; (3) silent data filtering — `validateFinanceData` and `importCSV` now surface skipped row counts + CSV line numbers in the import dialog; (4) money sums — all monetary reduces/wraps in calculations.ts and DebtPage.tsx use `addCurrency` (currency.js); (5) fixed `DAYS_IN_MONTH=30` — replaced with `daysInMonth(ym)` using real calendar month length; constant deleted. Net +6 commits (`9f3c6e2` → `ff66660`), 100 tests, all gates green.
- **Purchase-centric domain model rebuild (Active Card, 2026-09-08):** Rebuilt the transaction model so a transaction IS the purchase/receipt (ADR-0010): `installments?: number` (immutable, N derived monthly flows, remainder on first), `debts?: Debt[]` (full-settle only, receivables), deleted `parentId`/`groupId`/`isDebt`/`debtorName`/`debtSplits`/`debtUserShare`/`isSettled`/stored `referenceMonth`. Validation enforces installments⇒CREDIT, debts on EXPENSE only. Storage key bumped to v2 (old data rejected with clear message). Exchange CSV rebuilt (head-anchored, 1NF debts, minimal quoting). JSON backup/restore on new shape. FinanceContext simplified (SETTLE_DEBT replaces old SETTLE_TRANSACTION). UI rebuilt (TransactionForm, TransactionTable, DebtConfigModal, DebtPage). ADR-0010 flipped Proposed→Accepted. Net −345 lines, 90 tests, all gates green. Landed as commits 0b010ba → c18a5f9.
- **Data in/out organization — partial, superseded mid-card (Active Card, 2026-08-07):** Landed the module split (`exchange/csv.ts` + `backup/json.ts` + barrel), the new exchange CSV shape (ref scheme, 1NF debt rows, head-anchored installments; commits 793ef30, 736a3ed) and ADR-0009. JSON/backup, validation and imports were NOT redone: the card surfaced that the installment/debt data model itself had to be rebuilt first → replaced by the Active Card above, which redoes them on the new model (fold-in: quote CSV cells only when needed).
- **Bug Fix Sweep — HIGH (Active Card, 2026-08-06):** Closed all six data-integrity/timezone bugs (add-modal no-op, JSON import dropping budgets, UTC month/day slicing, income payment-method validation bypass, lexicographic amount sort, invalid payment-method persistence) plus a dead-code pass (−410 lines, 7 dead tests removed; suite now 65 focused tests). Landed as commits 59d6302 → 380c687.
- **Budget ranges (Active Card, 2026-08-06):** Replaced per-month navigation with From→To range creation and derived grouping (`groupBudgetsByRange` + 7 tests); create/edit/delete all range-aware with shrink/overlap confirm (ADR-0008), off-by-one clone fix. Landed as commits 066e59d → b2e31b1.
- **Refactor plan (8 commits):** Core types/constants cleanup, type-safety patch, state-management fixes, non-blocking toast/ConfirmDialog UX, domain utility extraction, UI consistency & dark mode, original TODO bugs (isDebt toggle, negative validation), BudgetFormDialog extraction. Landed as commits 0a34bb1 → 007141d.
- **UI/UX fix plan (Commit 1–9 + polish):** Design system foundation, INCOME transaction support, accessibility, interaction safety, chart improvements, search/filters, budget form & debt polish, content/labels/empty states, dark mode toggle + persistence, plus follow-up polish (sortable columns, smart comma-delimited input, income-by-account cards, dark-mode text fixes). Landed as commits bac1178 → 407a5cd.
