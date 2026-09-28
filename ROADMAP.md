# Repository Roadmap

*Goal: a feature-complete single-user personal finance tracker — transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode. Direction: mobile usability now, then skeleton loading, then advance-pay.*

---

## Active Card
> *There can only be ONE Active Card at a time. Finish or push to Next before opening another.*

- **Mobile usability — 360px gate (opened 2026-09-28):** make every flow usable on a 5.5" 21:9 phone and stop there. This is a **hard gate, not a vibe**: the Lead Architect is the sole acceptance authority and this card iterates until they sign off. Do not self-certify it closed.

  **Reference device:** 5.5" diagonal, 21:9 portrait → **360 CSS px wide, 840 CSS px tall** full screen. Browser chrome (~100px) means the layout gate is **360×740**. Everything keys off the **360px width**; if a real device reports otherwise, change this one number, not the card.

  **Current state (measured, not assumed):** the app is essentially desktop-fixed. Responsive classes total **8** across all of `src/ui` — `DashboardPage` 4, `TrendsPage` 2, and 1 each in `TransactionForm`, `DebtConfigModal`, `BudgetFormDialog`, `CSVImportDialog`, `ConfirmDialog`. `Common/Tabs.tsx` and `Transactions/TransactionTable.tsx` have **zero**. The 6-tab strip in `App.tsx:15-22` is a plain `flex` row of `px-4 py-2` buttons (~540px wide) with no overflow handling, so it already overflows 360px. This is greenfield work, not a retrofit.

  **Trade-offs / risks:**
  - **Bottom nav vs. horizontally-scrolling tab strip — OPEN DECISION, yours.** Six tabs do not fit 360px. A bottom nav is 6 items across 360px (~60px each, needs short labels + safe-area inset) and changes the app's most persistent UI. A scrollable strip is ~10 lines and preserves the current shape. My recommendation is the **scrollable strip for this card** — bottom nav is a persistent chrome commitment, and shipping it before the app has shipped once is premature. If you want bottom nav, say so and it becomes task 1.
  - **Table reflow is the bulk of the work and the main regression risk.** `TransactionTable`, `BudgetPage` and `DebtPage` are 6–8 column tables. Converting them to stacked cards can silently drop a datum or reorder columns relative to desktop. Whatever reflow is chosen, **both viewports must render the identical datum set** — that is the actual invariant, not "it looks fine on my phone".
  - Dialogs are the second risk: `TransactionForm` is the widest form in the app and the most likely to need a sheet instead of a modal at 360px.

  **Acceptance Criteria (DoD):**
  - No page produces a horizontal scrollbar at 360px (`document.documentElement.scrollWidth <= window.innerWidth`), on any of the 6 routes.
  - All 6 tabs are reachable at 360px with no clipped or truncated label.
  - `TransactionTable` renders **every** currently-visible datum at 360px: date, description, amount, category, payment method, debt state, and the edit/settle actions.
  - `BudgetPage` and `DebtPage` tables render their full datum set at 360px under the same rule.
  - Add + edit a transaction end-to-end at 360px using `TransactionForm`: every field reachable, primary action reachable, no pinch-zoom required, and the `DebtConfigModal` sub-flow intact.
  - `CSVImportDialog`, `ConfirmDialog` and `ExportImport` are operable at 360px (dropzone, preview, buttons all reachable).
  - Dashboard and Trends charts are legible at 360px with no clipped axis labels or legend overlap.
  - Primary tap targets are ≥ 40×40 CSS px.
  - `bun run typecheck`, `bunx biome check src/`, `bun test`, `bun run build` all green.
  - **Lead Architect signs off in the browser at 360×740.** Until then the card stays open.

  **Out of Scope:**
  - PWA / native shell / installability — no dedicated mobile UI unless PWA or native needs emerge.
  - Skeleton loading states — separate card in `## Next Cards`.
  - Advance-pay — separate card.
  - Desktop visual redesign. Responsive work may change desktop markup only where unavoidable; it must not restyle desktop.
  - New touch gestures (swipe-to-delete, pull-to-refresh). Make existing flows work; do not add interaction surface.

---

## Next Cards
> *Direction-only one-liners for future work in this milestone.*

- **Skeleton loading states for Dashboard:** Lightweight loading placeholders for `DashboardPage` (carried over from the old UI/UX plan, Commit 9 — never implemented). Kept separate from the mobile card on purpose: it is one file and near-mechanical, and bundling it would have blurred two unrelated DoDs.
- **Advance-pay for credit installments:** Let the user pay the next N installments now and shift the remainder. Requires a `paidInstallments` marker in the model — a domain change, so it wants its own card and likely an ADR.

---

## Done Cards
> *Completed cards with objective outcomes.*

- **UI/UX Consistency Pass + income/debt UX unification (Active Card, opened 2026-08-07, closed 2026-09-26):** 19 of 20 audit findings closed, plus a scoped close-out. Final pass (`b71a7d8`): `EmptyState` gained a `cell` variant and the three in-table empty states (`TransactionTable`, `BudgetPage`, `DebtPage`) now render through it; the single-split settle control in `DebtPage` became a ghost `Button` with `aria-label` (was plain text flipping `100%` ↔ `Settled`); `rounded-none` stripped from `CSVImportDialog`'s dropzone, error box and skipped list. Audit items (d) and B6 verified as already implemented and struck; (e) moot — the "Details" column no longer exists. Version-mismatch guidance dropped as a non-goal: the app is undeployed, so there is no legacy document to detect, and `AGENTS.md` forbids the compatibility shim an ADR for it would have prescribed. The audit doc behind the card was deleted on close; its findings live here and in git history. Net +87/−24, 195 tests, all gates green.
- **Span-based smart input parser (2026-09-26, `91c7b4c`):** implemented to `docs/text-input-specification.md`, the spec being the source of truth. Replaced the token + regex pre-pass parser with a maximal-munch span lexer and the §3 commitment model: provisional candidates (bare weekdays, `hoje`/`ontem`/`anteontem`/`amanhã`) commit by default and are demoted into the Description only when committing would break it. New `dateGrammar.ts` is the single source of truth for §2.2 date forms — ordered sticky patterns for lexing, structured shapes for §4 completions — so parser and autocompleter cannot disagree. Categories/payment methods resolve against their registries, which is what makes `@Meal Voucher` a single span. `parseSmartInput` now takes the category registry. `parseDate.ts` deleted (no consumers; its English/`dd/mm` fallbacks fall outside §2.2). Net +1101 lines incl. 422 lines of spec-derived tests, 195 tests, all gates green.
- **Bug Fix Backlog fully closed (2026-09-28):** the standing 2026-08-06 sweep is retired from the roadmap. All 6 HIGH items were closed by the HIGH sweep card below; all 7 MED items by the MED round (5) and the purchase-centric rebuild (2); both prior LOW items (dead `QuickAddRow.tsx`, tracked `tsconfig.tsbuildinfo`) closed in the same window. The final open LOW — `parseFloat` in the `TransactionForm` disabled-state check — verified closed: the check now calls `parseCurrency`. The 16 struck-through evidence rows were dropped rather than carried; their `file:line` citations were only actionable while the bugs were open.
- **MED bug fix round (Active Card, 2026-09-12):** Closed 5 MED bugs: (1) stale payment method on type switch — reset to valid default (SALARY/DEBIT); (2) Ctrl+Z/Ctrl+Y focus guard — skip intercept on text-input elements; (3) silent data filtering — `validateFinanceData` and `importCSV` now surface skipped row counts + CSV line numbers in the import dialog; (4) money sums — all monetary reduces/wraps in calculations.ts and DebtPage.tsx use `addCurrency` (currency.js); (5) fixed `DAYS_IN_MONTH=30` — replaced with `daysInMonth(ym)` using real calendar month length; constant deleted. Net +6 commits (`9f3c6e2` → `ff66660`), 100 tests, all gates green.
- **Purchase-centric domain model rebuild (Active Card, 2026-09-08):** Rebuilt the transaction model so a transaction IS the purchase/receipt (ADR-0010): `installments?: number` (immutable, N derived monthly flows, remainder on first), `debts?: Debt[]` (full-settle only, receivables), deleted `parentId`/`groupId`/`isDebt`/`debtorName`/`debtSplits`/`debtUserShare`/`isSettled`/stored `referenceMonth`. Validation enforces installments⇒CREDIT, debts on EXPENSE only. Storage key bumped to v2 (old data rejected with clear message). Exchange CSV rebuilt (head-anchored, 1NF debts, minimal quoting). JSON backup/restore on new shape. FinanceContext simplified (SETTLE_DEBT replaces old SETTLE_TRANSACTION). UI rebuilt (TransactionForm, TransactionTable, DebtConfigModal, DebtPage). ADR-0010 flipped Proposed→Accepted. Net −345 lines, 90 tests, all gates green. Landed as commits 0b010ba → c18a5f9.
- **Data in/out organization — partial, superseded mid-card (Active Card, 2026-08-07):** Landed the module split (`exchange/csv.ts` + `backup/json.ts` + barrel), the new exchange CSV shape (ref scheme, 1NF debt rows, head-anchored installments; commits 793ef30, 736a3ed) and ADR-0009. JSON/backup, validation and imports were NOT redone: the card surfaced that the installment/debt data model itself had to be rebuilt first → replaced by the card above, which redoes them on the new model (fold-in: quote CSV cells only when needed).
- **Bug Fix Sweep — HIGH (Active Card, 2026-08-06):** Closed all six data-integrity/timezone bugs (add-modal no-op, JSON import dropping budgets, UTC month/day slicing, income payment-method validation bypass, lexicographic amount sort, invalid payment-method persistence) plus a dead-code pass (−410 lines, 7 dead tests removed; suite now 65 focused tests). Landed as commits 59d6302 → 380c687.
- **Budget ranges (Active Card, 2026-08-06):** Replaced per-month navigation with From→To range creation and derived grouping (`groupBudgetsByRange` + 7 tests); create/edit/delete all range-aware with shrink/overlap confirm (ADR-0008), off-by-one clone fix. Landed as commits 066e59d → b2e31b1.
- **Refactor plan (8 commits):** Core types/constants cleanup, type-safety patch, state-management fixes, non-blocking toast/ConfirmDialog UX, domain utility extraction, UI consistency & dark mode, original TODO bugs (isDebt toggle, negative validation), BudgetFormDialog extraction. Landed as commits 0a34bb1 → 007141d.
- **UI/UX fix plan (Commit 1–9 + polish):** Design system foundation, INCOME transaction support, accessibility, interaction safety, chart improvements, search/filters, budget form & debt polish, content/labels/empty states, dark mode toggle + persistence, plus follow-up polish (sortable columns, smart comma-delimited input, income-by-account cards, dark-mode text fixes). Landed as commits bac1178 → 407a5cd.
