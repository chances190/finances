# Repository Roadmap

## Macro Plan
- **Current Milestone:** Bug-fix hardening (v0.1.x)
- **Goal:** The finances app is a feature-complete single-user personal finance tracker (transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode). Direction: the purchase-centric domain model rebuild (2026-09-08, ADR-0010) is active; then the UI/UX Consistency Pass, then the MED data-integrity round (silent-loss/inconsistency paths) before any move toward persistence or multi-user.

---

## Active Card
> *There can only be ONE Active card at a time. Finish or push to Next before opening another.*

### Purchase-centric domain model rebuild (2026-09-08, approved)

- **Intent:** Rebuild the transaction model so a transaction IS the purchase/receipt (ADR-0010): installment plans immutable (`installments?: number`, N derived monthly flows, remainder on the first flow), debts as attachments (`debts?: Debt[]`, `{name, amount, settled}`, full settlement only, always receivables), deleting `parentId`/`groupId`/`isDebt`/`debtorName`/`debtSplits`/`debtUserShare`/`isSettled`/stored `referenceMonth` in favor of derivation. Also redoes the data in/out work (CSV/JSON/validate) on the new shape; clean break, no migration.
- **Trade-offs / Risks:** Breaking change — versioned storage key drops old local data and old JSON backups (accepted, v0.x local, reseed). Touches every layer (domain → data → ui) and all tests. Derived-flow month math (month add, remainder split) is the one new correctness surface — unit-test it.
- **Acceptance Criteria (DoD):**
  - `bun run typecheck`, `bun test`, `bun run build` green; `bun run lint` clean.
  - Grep-clean: no `parentId`, `groupId`, `isDebt`, `debtorName`, `debtSplits`, `debtUserShare`, `isSettled`, or stored `referenceMonth` in `src/`.
  - Editing a purchase cannot desync installments (siblings are derived, not stored); installment count immutable after creation.
  - Debts: full-settle only; user share derived as `amount − Σdebts`; validation rejects `Σdebts > amount`, `installments` on non-CREDIT, `debts` on INCOME.
  - Exchange CSV: derived flows head-anchored by `ref`, debts in 1NF, cells quoted only when needed; export → hand-edit → import round-trips (tests).
  - JSON backup lossless on the new shape; old-format backups rejected with a clear message (never silently filtered).
  - ADR-0010 flipped Proposed → Accepted.
- **Out of Scope:** advance-pay (Next Cards — slots a `paidInstallments` marker into the model later), bank ingest parsers, mobile usability, UI/UX Consistency Pass, Ctrl+Z focus guard, float-money refactor (ADR-0004), DAYS_IN_MONTH.
- **Atomic tasks (one commit each):**
  1. Entities + derivation: purchase-centric `Transaction` + `Debt`; delete dead fields; `monthlyFlows()` (month math + remainder-on-first) with unit tests.
  2. Validation rewrite (installments⇒CREDIT, debts on EXPENSE only, Σdebts ≤ amount) + storage key version bump (drop old data, reseed) + tests.
  3. Calculations rewrite over derived flows (rollups, future commitments, category series, debt aggregates) + tests.
  4. FinanceContext: actions/reducers without parentId/groupId logic; undo/redo snapshots on the new shape.
  5. UI rebuild: TransactionForm (installments immutable on edit), SmartTransactionInput, TransactionTable (derived flow rows), DebtConfigModal + DebtPage (full settle).
  6. Exchange CSV redo: export flows (head-anchored, 1NF debts, minimal quoting), import groups rows → purchases; tests.
  7. JSON backup/restore on the new shape (reject old format with a clear message); tests.
  8. Flip ADR-0010 → Accepted; note the superseded format details in ADR-0005 if needed.

## Next Cards
> *Direction-only one-liners for future work in this milestone.*

- **UI/UX Consistency Pass (2026-08-07, PARTIALLY IMPLEMENTED):** pulled from Active into Next midway (2026-08-07) to make room for the data in/out card; remaining tasks carry the intent from docs/ui-ux-audit-2026-08-06.md — one segmented/toggle vocabulary, one confirmation pattern, money-entry via `parseCurrency`, one category source of truth, no `rounded-none` on interactive elements, no opacity-dimmed interactive rows without a state indicator, standardized h2/section headers, shared StatCard, unified empty states, toast pass (audit: docs/ui-ux-audit-2026-08-06.md).
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

- **Data in/out organization — partial, superseded mid-card (Active Card, 2026-08-07):** Landed the module split (`exchange/csv.ts` + `backup/json.ts` + barrel), the new exchange CSV shape (ref scheme, 1NF debt rows, head-anchored installments; commits 793ef30, 736a3ed) and ADR-0009. JSON/backup, validation and imports were NOT redone: the card surfaced that the installment/debt data model itself had to be rebuilt first → replaced by the Active Card above, which redoes them on the new model (fold-in: quote CSV cells only when needed).
- **Bug Fix Sweep — HIGH (Active Card, 2026-08-06):** Closed all six data-integrity/timezone bugs (add-modal no-op, JSON import dropping budgets, UTC month/day slicing, income payment-method validation bypass, lexicographic amount sort, invalid payment-method persistence) plus a dead-code pass (−410 lines, 7 dead tests removed; suite now 65 focused tests). Landed as commits 59d6302 → 380c687.
- **Budget ranges (Active Card, 2026-08-06):** Replaced per-month navigation with From→To range creation and derived grouping (`groupBudgetsByRange` + 7 tests); create/edit/delete all range-aware with shrink/overlap confirm (ADR-0008), off-by-one clone fix. Landed as commits 066e59d → b2e31b1.
- **Refactor plan (8 commits):** Core types/constants cleanup, type-safety patch, state-management fixes, non-blocking toast/ConfirmDialog UX, domain utility extraction, UI consistency & dark mode, original TODO bugs (isDebt toggle, negative validation), BudgetFormDialog extraction. Landed as commits 0a34bb1 → 007141d.
- **UI/UX fix plan (Commit 1–9 + polish):** Design system foundation, INCOME transaction support, accessibility, interaction safety, chart improvements, search/filters, budget form & debt polish, content/labels/empty states, dark mode toggle + persistence, plus follow-up polish (sortable columns, smart comma-delimited input, income-by-account cards, dark-mode text fixes). Landed as commits bac1178 → 407a5cd.
