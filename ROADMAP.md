# Repository Roadmap

## Macro Plan
- **Current Milestone:** Bug-fix hardening (v0.1.x)
- **Goal:** The finances app is a feature-complete single-user personal finance tracker (transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode). Direction: budget ranges landed, then the six HIGH bug fixes + dead-code cleanup landed (2026-08-06); the UI/UX Consistency Pass is now active; then the MED data-integrity round (silent-loss/inconsistency paths), then the deferred debt/installment features before any move toward persistence or multi-user.

---

## Active Card
> *There can only be ONE Active card at a time. Finish or push to Next before opening another.*

### UI/UX Consistency Pass (2026-08-06, approved)

- **Intent:** Make the app's UI/UX internally consistent — one toggle/segmented control vocabulary, one confirmation pattern, one money-entry convention, one category source of truth — and kill affordance lies (dimmed rows that are still clickable) and naming drift. Mirrors the bug sweep: audit → fix → verify per task.
- **Audit findings:** [docs/ui-ux-audit-2026-08-06.md](docs/ui-ux-audit-2026-08-06.md) — evidence-backed inventory (A1-A8 inconsistencies, B1-B12 anti-patterns/glitches) referenced by the tasks below.
- **Trade-offs / Risks:** Touches every page → commit per task, no mega-PR. Risk of scope-creeping into a visual redesign → DoD pins "consistency, not redesign". Money-input change touches validation paths (covered by existing tests).
- **Acceptance Criteria (DoD):**
  - `bun run typecheck`, `bun test`, `bun run build` green; `bun run lint` clean.
  - Exactly one segmented/toggle implementation remains (grep-verifiable).
  - `450,50` and `1.234,56` enter correctly in smart input, Add/Edit Transaction, and New/Edit Budget; edit-prefill displays the same decimal style you saved.
  - A custom category created in Budget appears in TransactionForm's Category select and smart-input category suggestions.
  - No `rounded-none` on interactive elements (grep clean).
  - No interactive row or control remains dimmed by opacity without a state indicator (badge/text).
  - Toasts: normal font, dismissible, aria-live announced.
- **Out of Scope:** mobile responsive reflow (own Next card), Ctrl+Z guard + MED data-integrity items (own MED card), PWA/native, theme/branding or icon redesign, chart-library changes, float-money refactor (ADR-0004), DAYS_IN_MONTH.
- **Atomic tasks (one commit each):**
  1. Extract one `SegmentedControl`; replace TransactionForm type toggle + DebtPage Per-Tx/Per-Person (keep or replace BudgetFormDialog Tabs — pick ONE implementation app-wide).
  2. Unify budget-conflict confirmation with the shared pattern (consistent Cancel/Continue verbs; reuse the component).
  3. Money inputs → text + `parseCurrency` everywhere (TransactionForm, BudgetFormDialog incl. edit prefill `String()` formatting).
  4. Category source of truth: TransactionForm Category select + smart-input suggestions + filter share one list incl. custom categories.
  5. Split smart-input suggestions: token 2 = known descriptions, token 3 = DEFAULT_CATEGORIES (+custom).
  6. Extract `StatCard`; replace 10 KPI-card copies; reconcile `PaceKpi` styling.
  7. Standardize page h2 + section headers; fix naming drift (Trends tab vs "Yearly Trends" h2; "Actions" vs "Action History").
  8. TransactionTable toolbar: replace hand-rolled PopoverTriggers with `Button variant="outline" size="xs"`; kill `rounded-none` leak on interactive elements.
  9. Affordance-lies cleanup: future/settled rows show a state indicator and stay interactive, or interaction is gated; split-row "100%"/"Settled" label fix.
  10. Unify empty states across pages.
  11. Toast pass: normal font, dismissible, `role="status"`/`aria-live`.
  12. Small cleanups: `currentYM()` reuse in DashboardPage, spending-filter dedupe, DebtPage badge-color constants, DebtConfigModal `c` shadow rename.

---

## Next Cards
> *Direction-only one-liners for future work in this milestone.*

- **Mobile usability:** App must be 100% usable on mobile (intent: responsive-first via CSS — Tailwind v4 + shadcn are mobile-first, adapt Tabs → bottom nav, reflow the transactions table, bottom-sheet dialogs; no dedicated mobile UI unless PWA/native needs emerge).
- **Skeleton loading states for Dashboard:** Add lightweight loading placeholders for Dashboard (carried over from the old UI/UX plan, Commit 9 — not yet implemented).
- **Advance-pay for credit installments:** Let users pay the next N installments now and shift the remainder (deferred from the old Refactor Plan).
- **Unify income vs debt UX:** Income should hide debt/installment controls consistently across SmartTransactionInput, TransactionForm, and DebtConfigModal (deferred from the old Refactor Plan).
- **Actions panel label cleanup:** ~~Rename the "Action History" panel title in AuditLogPanel to match the "Actions" terminology used elsewhere~~ (folded into UI/UX Consistency Pass task 7).

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

### MED — Error-prone / inconsistent (next-card candidates)
- **Type switch keeps stale payment method:** switching EXPENSE→INCOME in the form keeps CREDIT, producing an INCOME/CREDIT inconsistency. **Elevated since 2026-08-06:** the validation fix (082e757) now strips INCOME/CREDIT on reload — this is now a silent data-loss path. (TransactionForm.tsx:170-174)
- **Editing an installment series doesn't regenerate siblings:** changing `installmentTotal` updates one transaction's metadata only, leaving the group inconsistent. (TransactionForm.tsx:120-123)
- **Editing a debt resets per-split `settled` flags:** `DebtSplitUI` drops `settled`; partial settlements are lost on edit. (TransactionForm.tsx:83-94,126-129)
- **Global Ctrl+Z/Ctrl+Y hijacks text-input undo:** App.tsx keydown handler has no focus guard; typing in the smart input/forms and pressing Ctrl+Z undoes a finance action instead of text. (App.tsx)
- **Silent data filtering on import/load:** `validateFinanceData` filters invalid transactions, `importCSV` skips mismatched rows — partial data drops without notice. (validation.ts:46, exportImport.ts:94)
- **Money sums use raw float `+`:** calculations.ts aggregations and DebtPage totals bypass currency.js; safe only because display rounds to cents — conflicts with ADR-0004. (calculations.ts:87,98, etc.)
- **Fixed `DAYS_IN_MONTH = 30` pace:** February shows "Day 28/30" and day-31 spending is excluded from pace charts; acceptable convention but error-prone.

### LOW — Hygiene & consistency
- ~~**Dead code — QuickAddRow.tsx:**~~ replaced by SmartTransactionInput (ec9bf55) and deleted 2026-08-06 (380c687).
- ~~**tsconfig.tsbuildinfo tracked in git:**~~ added to `.gitignore` and untracked (34ebd77).
- **`parseFloat` for a disabled-state check** bypasses currency.js. (TransactionForm.tsx:308)

---

## Done Cards
> *Completed cards with objective outcomes.*

- **Bug Fix Sweep — HIGH (Active Card, 2026-08-06):** Closed all six data-integrity/timezone bugs (add-modal no-op, JSON import dropping budgets, UTC month/day slicing, income payment-method validation bypass, lexicographic amount sort, invalid payment-method persistence) plus a dead-code pass (−410 lines, 7 dead tests removed; suite now 65 focused tests). Landed as commits 59d6302 → 380c687.
- **Budget ranges (Active Card, 2026-08-06):** Replaced per-month navigation with From→To range creation and derived grouping (`groupBudgetsByRange` + 7 tests); create/edit/delete all range-aware with shrink/overlap confirm (ADR-0008), off-by-one clone fix. Landed as commits 066e59d → b2e31b1.
- **Refactor plan (8 commits):** Core types/constants cleanup, type-safety patch, state-management fixes, non-blocking toast/ConfirmDialog UX, domain utility extraction, UI consistency & dark mode, original TODO bugs (isDebt toggle, negative validation), BudgetFormDialog extraction. Landed as commits 0a34bb1 → 007141d.
- **UI/UX fix plan (Commit 1–9 + polish):** Design system foundation, INCOME transaction support, accessibility, interaction safety, chart improvements, search/filters, budget form & debt polish, content/labels/empty states, dark mode toggle + persistence, plus follow-up polish (sortable columns, smart comma-delimited input, income-by-account cards, dark-mode text fixes). Landed as commits bac1178 → 407a5cd.
