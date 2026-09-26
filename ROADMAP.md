# Repository Roadmap

## Macro Plan
- **Current Milestone:** Bug-fix hardening (v0.1.x)
- **Goal:** The finances app is a feature-complete single-user personal finance tracker (transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode). Direction: UI/UX Consistency Pass next, then mobile usability + skeleton loading, then advance-pay.

---

## Active Card
> *There can only be ONE Active Card at a time. Finish or push to Next before opening another.*

- **UI/UX Consistency Pass + income/debt UX unification (opened 2026-08-07; audited 2026-09-26 — 5 tasks left):** the card is mostly implemented. This entry was rewritten on 2026-09-26 after a line-by-line audit of `docs/ui-ux-audit-2026-08-06.md` (findings A1–A8, B1–B12) plus the 2026-09-12 additions, against the code as of `91c7b4c`. What follows is the verified remainder, not a restatement of the original brief.

  **Intent:** close the last five audit/card items, then stop. The consistency work this card was chartered for is already in the tree.

  **Verified complete — do not reopen:**
  - **A1** single toggle vocabulary: `SegmentedControl` in `TransactionForm`, `DebtPage`, `BudgetFormDialog`.
  - **A2** single confirmation pattern: `ConfirmDialog` in `TransactionForm` and `BudgetFormDialog`.
  - **A3** money entry via `parseCurrency`; amount fields are `type="text" inputMode="decimal"`. (The one surviving `type="number"` is the installment *count*, not money.)
  - **A4** custom categories: `getAllCategories` in both `BudgetFormDialog` and `TransactionForm`.
  - **A5** title drift: tab "Trends" = h2 "Trends", tab "Actions" = h2 "Actions".
  - **A8** money axis labels: `formatAxisCurrency` in `DashboardPage` and `TrendsPage`.
  - **B1** blurred suggestion sets: removed with the old comma-delimited token design.
  - **B2** `currentYM(today)` + one spending filter (`DashboardPage:115,131`).
  - **B3** shared `StatCard`; **B5** uniform `text-sm font-semibold` section headers; **B12** uniform `text-lg font-semibold` h2 across all six pages.
  - **B9** toast pass: `aria-live`, `role="status"`, dismiss button, no `font-mono`.
  - **B10** `c` shadowing gone; **B11** type column reads via amount colour + "Paid" badge, not bare `+`/`−` glyphs.
  - **(a)** "Your share:" row (`DebtConfigModal:186`); **(b)** debt button aligned (`TransactionForm:296-308`); **(c)** payment-method casing canonical (`TransactionForm:245-265`); **(f)** debt-total guards in both `TransactionForm:107` and `DebtConfigModal:74`.
  - **Income/debt unification:** `TransactionForm` gates debt + installment controls behind `form.type === 'Expense'`; `DebtConfigModal` is reachable only from that gate; `SmartTransactionInput` has no debt/installment surface, so there is nothing to hide.

  **Moot:** **(e) rename "Details" → "Debts"** — the column no longer exists. Heads are now Payment / Amount / Description / Category / Date; debt state moved into the Description cell ("Paid" badge) and the Debts page. Nothing to rename.

  **Remaining (6):**
  1. **`rounded-none` on interactive elements (A6/A7)** — `CSVImportDialog.tsx:180` dropzone, `:212` error box, `:235` preview list. `TransactionTable`'s rounded-none filter triggers are already gone.
  2. **Installment index badge (d)** — `TransactionTable.tsx:510-514` dims future flows (`opacity-45`) with no state indicator, which itself breaks this card's "no opacity-dimmed rows without state indicator" rule. Add the `n/total` badge (e.g. "2/6") to the future row.
  3. **Settled-row affordance (B6)** — `DebtPage.tsx:166,233` dim settled rows `opacity-50` while leaving them clickable. Add a state indicator so dimming no longer reads as disabled.
  4. **Single-split settle toggle (B7)** — `DebtPage.tsx:279-282` still renders plain text flipping `100%` ↔ `Settled` with no button affordance. (The multi-split case is already a real `<Button>` with `aria-label`; make the single-split case match.)
  5. **Unified empty states (B8)** — `EmptyState` is used only by `DashboardPage:152` and `TrendsPage:119`. `TransactionTable.tsx:500-506` (in-table row), `BudgetPage` (in-table row) and `DebtPage:198-200` (bordered div) are still bespoke.

  **Closed without an ADR (2026-09-26):** version-mismatch guidance for backup imports is **dropped as a non-goal.** The export/import UI already separates backup from exchange (`ExportImport.tsx:14,22`; `CSVImportDialog.tsx:74,170-171`), and the app is not deployed, so there is no legacy document in the wild to mismatch. `data/backup/json.ts:14` returning per-row skip reasons and `data/repository.ts:9-15` swallowing a load failure to `null` only affect a developer's own stale `localStorage`. Per `AGENTS.md` (no backward-compatibility shims, YAGNI), the fix is to delete the stale store, not to add a version marker to detect it. Revisit only if the app ships and real user data exists.

  **Trade-offs / risks:**
  - Empty-state unification touches four components at once. `EmptyState` needs a `variant` (or a slot) for the in-table case, or the table rows get visually wrong — resist collapsing all four into one shape.

  **Acceptance Criteria (DoD):**
  - `grep -rn "rounded-none" src/ui` returns no hits in any interactive/dropzone/error surface (shadcn vendored primitives under `src/components/ui/` are exempt).
  - A future installment row shows a `n/total` badge; no row anywhere is dimmed without a visible state indicator.
  - Every settle control (single-split and multi-split) is a real button with an `aria-label`.
  - Every empty surface renders through `Common/EmptyState`.
  - `bun run typecheck`, `bunx biome check src/`, `bun test`, `bun run build` all green.

  **Out of Scope:**
  - **B4** (chart boilerplate duplicated across `DashboardPage`/`TrendsPage`) — a maintenance smell, never a card requirement. De-scoped.
  - Reworking the shadcn vendored primitives in `src/components/ui/` to drop their own `rounded-none`.
  - The smart-input parser / `docs/text-input-specification.md` work (commit `91c7b4c`) — that was untracked feature work, not part of this card. It should be filed as its own card or left out of the roadmap.

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
