# Repository Roadmap

*Goal: a feature-complete single-user personal finance tracker — transactions, budgets, debts, dashboard, trends, CSV import/export and appearance settings. Direction: finish the accepted Glass + Clay design port and the Transactions ledger layout, then Drive sync device verification, skeleton loading and advance-pay.*

---

## Active Card
> *There can only be ONE Active Card at a time. Finish or push to Next before opening another.*

- **Design system port — Glass + Clay foundation (opened 2026-11-26):** replace the Nova oklch palette and one-off accents with the accepted Glass + Clay system — Ink-first bases, ink accents, system theme, 4px radii and accent-tinted surfaces — then split History from Settings and delete the design lab (ADR-0016).

  **Intent:**
  - Make `src/index.css` the single token source for the production app: base colours, ink accents, Glass/Clay surfaces, chart tokens and shadows.
  - Keep every existing flow and semantic colour; this is a visual and shell change, not a domain change.

  **Trade-offs / Risks:**
  - Blur on surfaces is accepted, but it is a real mobile scroll cost: the 1,097-row ledger and Dashboard must be checked on the phone.
  - Raw `AccentColor` is unsupported on Chrome Android/ChromeOS; a CSS `@supports` fallback to Ink mono keeps primary buttons valid. It also cannot read Plasma or Material palettes.
  - Reusing `finances-theme` for an appearance blob resets the current theme preference by design; no migration shim.

  **Acceptance Criteria (DoD):**
  - `src/index.css` owns every token; no `--lab-*`, `data-lab-*` or `.lab-stage` lookups remain. `src/lab/`, `lab.html`, `lab-stage.html`, the `lab` script, `setResolvedThemeForLab` and `setFinancePersistence` are deleted.
  - `<html>` carries `data-accent` and `data-ink-accent`; System is the default theme, reacts live to `prefers-color-scheme`, survives reload, and an old string value in `finances-theme` resets to system/ink/mono.
  - Changing base or ink colour immediately repaints surfaces, chips, charts and the inline brand mark.
  - Seven routes — Transactions, Budgets, Debts, Dashboard, Trends, History, Settings; `Tabs.svelte` is gone. Inline header nav at ≥1024px, drawer below; drawer focus trap and safe-area padding intact.
  - `/settings` owns Theme, Base colour, Ink accent and Data; `/history` is the audit log only.
  - Dialogs are bottom sheets below 640px with a `visualViewport` lift; the mobile nav stays a right drawer; selects/popovers stay undimmed and are not caught by the overlay.
  - Income, expense, refund and debt status keep semantic red/green; badges stay neutral outlines.
  - `bun run typecheck`, `bunx biome check src/ functions/`, `bun test` (225) and `bun run build` green; visual sign-off at 390/768/1280 × light/dark × four bases.

  **Out of Scope:**
  - The Transactions ledger layout rebuild (next card), sorting changes, new features, domain/data edits, icon migration beyond the nav, PWA manifest redesign.

---

## Next Cards
> *Direction-only one-liners for future work in this milestone.*

- **Transactions ledger layout:** replace the table/cards with the accepted grouped ledger — date groups with daily totals, hybrid grid ≥900px, feed below, inspector rail ≥1100px and a detail panel/sheet. Restore every production affordance on top: row action menu and detail actions for edit, reimburse (with remaining amount), go-to-debt and delete (cascade + undo), smart-input suggestions, URL filters/search/month/type/category/payment/person/`movement`, `movementMonth()` and `paymentLabelOf()` semantics, and an empty state with a clear-filters action. Keep window virtualization over flattened header/row entries to protect the 1,097-row trace; drop sorting state and UI. The lab's hardcoded day/month in the rail must use real values.
- **Google Drive sync — device verification (parked 2026-11-23):** the code landed (`edbf643`, `f8241fa`, `513ef0e`; ADR-0012 Proposed) with the `appDataFolder` snapshot, refresh-token cookie, version guard and Pull/Push prompt. Only the phone + desktop round-trip sign-off remains.
- **Skeleton loading states for Dashboard:** lightweight placeholders for `DashboardPage`, carried over from the old UI/UX plan; re-target to the final page.
- **Advance-pay for credit installments:** pay the next N installments now and shift the remainder; needs a `paidInstallments` marker in the model, so it wants its own card and probably an ADR.

---

## Done Cards
> *Completed cards with objective outcomes.*

- **Svelte 5 port — foundation (opened 2026-11-24, closed 2026-11-26):** React, wouter, Base UI and recharts were retired; the Svelte 5 runes shell, History-API router, finance/toast stores, shadcn-svelte primitives and every page slice (Transactions, Debts, Budgets, Dashboard/Trends, Sync/import/export/History) landed behind the existing domain/data core. `src/domain`, `src/data`, `src/lib` and `functions/` stayed contract-compatible; 225 tests green. Decisions live in ADR-0015.

- **Pace-first ledger rewrite (Active Card, opened 2026-11-23, closed 2026-11-24):** replaced the stored `Transaction` model with `movements` + `postings`, the fixed account enum and an intent-first UI (ADR-0014). Landed as `c747a54` (domain core) → `0f83168` (snapshot validation + migration) → `b1df48e` (transactions replaced) → `50f49ab`, `b672b5c`, `42df4e5`, `6b837df` (task-first UI, debt provenance, credit-card fields, visual-viewport dialogs). Lead Architect verified add, refund, settle, payable and import on the phone and signed the card off. Decisions and non-goals live in ADR-0014.

- **Transaction input and import reconciliation (Active Card, opened/closed 2026-11-23):** mobile category select verified at 360×740 in add and edit (`3947657`); imported Expense rows reconcile same-day/same-value with adopt/overwrite/keep-both, single-match adopt and multi-match prompt (`b4ece27`); 233 tests, typecheck/lint/build green.
- **Mobile design — from-scratch mobile surfaces (Active Card, opened 2026-09-28, closed 2026-11-04):** closed by Lead Architect sign-off at 360×740. The mobile surfaces and the 360px layout gate were accepted; no code changes in this close-out.
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
