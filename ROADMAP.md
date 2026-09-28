# Repository Roadmap

*Goal: a feature-complete single-user personal finance tracker — transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode. Direction: mobile usability now, then skeleton loading, then advance-pay.*

---

## Active Card
> *There can only be ONE Active Card at a time. Finish or push to Next before opening another.*

- **Mobile design — from-scratch mobile surfaces (opened 2026-09-28, re-scoped the same day):** the desktop layout is not adapted to mobile. The two surfaces that cannot survive the adaptation get their own designs. Hard gate — the Lead Architect is the sole acceptance authority and this card iterates until they sign off. Do not self-certify it closed.

  **Reference device:** 5.5" diagonal, 21:9 portrait → **360 CSS px wide, 840 CSS px tall** full screen. Browser chrome (~100px) means the layout gate is **360×740**. Everything keys off the **360px width**; if a real device reports otherwise, change this one number, not the card.

  **Why the responsive approach was abandoned (measured, not assumed):** six labeled tabs need ~553px (`text-sm` glyphs + `px-4` per button + `gap-1`) against **328px** of available content at 360px. `TransactionTable` carries **640px of fixed column width** (`w-24`+`w-24`+`w-20`+`w-24`+`w-16`+`w-32`+`w-20`) before the `flex-1` description column receives a single pixel; `DebtPage`'s second table has 7 columns. Neither is reachable with CSS: dropping to `text-xs` still leaves ~60px per tab against a ~73px "Transactions" label. Horizontal scrolling kept every datum reachable and made the app feel bad, so it is not the answer. Desktop scans *across* a row to compare; mobile scans *down* a list to recognise. That is a different information hierarchy and has to be designed, not transformed.

  **Current state (corrected — the previous version of this note was wrong):** the app is **not** desktop-fixed. 22 responsive variants across 9 files, and the dialog, form, dashboard and segmented-control work is already responsive. `Common/Tabs.tsx` and `Transactions/TransactionTable.tsx` have **zero** — not because they are fine, but because the strip overflows the page and the table delegates scrolling to the `Table` primitive. The card is aimed at those two surfaces, not at the whole app.

  **Decisions (closed — do not relitigate):**
  - **One breakpoint: `sm` (640px).** The strip needs ~585px including shell padding, so 640px is the smallest Tailwind step above the real break point. This is an **invariant, not a default**: no per-surface thresholds, no `lg:` on a table. Two breakpoints would leave the nav and the tables disagreeing about what "desktop" means.
  - **Nav → CSS-only.** The existing strip wraps in `hidden sm:block`; a hamburger trigger in the sticky header is `sm:hidden`. The header at `App.tsx:63-66` is already `flex items-center justify-between`, so the trigger drops in as a second child. Both read the same `tabs` array. No JS, and the desktop strip is untouched.
  - **Drawer → a `side` variant on the existing `dialog.tsx`.** There is no `sheet.tsx` in `src/components/ui/`, and shadcn's own Sheet is a Dialog variant, so this reuses the existing overlay, ESC handling and focus trap instead of adding a primitive. Closes on navigate.
  - **Tables → a JS branch.** A new `useMediaQuery` in `src/ui/hooks/` (`src/lib` holds pure functions only). Only one variant renders. *Mechanism rule, so the asymmetry does not look arbitrary: CSS when the duplicated subtree is static and small, a JS branch when it is data-sized.*
  - **Nested lists — Debts and Categories are always visible inline.** Never collapsed, never truncated behind a count, no expand state. A tap is the friction this card exists to remove.
  - **No ADR.** No new dependency, no data-model change, no boundary or paradigm change, and fully reversible. It fails the skill's own bar for the same reason ADR-0012 did.

  **Trade-offs / risks:**
  - **Every future table column is now designed twice.** That is the standing cost and it is accepted. It is explicitly *not* mitigated by keeping the two variants in agreement, because the desktop table is not a target for the mobile one — they are independent designs. The only invariant is that no datum becomes inaccessible on mobile.
  - **Three designs, not three reflows, and the transaction card is the hard one** — 8 fields plus a nested debt list carrying an inline settle action per debtor. "Always visible inline" is what makes those cards tall, and that is the accepted trade.
  - **Static analysis cannot see the render.** The CSS can be plausible and wrong in ways no gate catches. The DoD is weighted toward facts the Lead Architect can measure, and this card is not closable by `@coder`.

  **Acceptance Criteria (DoD):**
  - **No datum is inaccessible at 360px.** For each of `TransactionTable`, `BudgetPage` and `DebtPage`, every value the desktop variant renders has a visible counterpart in the mobile variant, with debts and categories inline and untruncated. No "N more", no expand, no scroll-to-reveal.
  - `document.documentElement.scrollWidth <= window.innerWidth` on all 6 routes at 360px.
  - The hamburger opens a drawer listing all 6 destinations with full untruncated labels; selecting one navigates and closes the drawer.
  - Above 640px the tab strip renders exactly as it does today — no restyle, no reflow.
  - Add and edit a transaction end-to-end at 360px via `TransactionForm` with the `DebtConfigModal` sub-flow intact; every field and both primary actions reachable, no pinch-zoom.
  - `CSVImportDialog` and `ConfirmDialog` are operable at 360px — dropzone, preview and buttons all reachable.
  - Dashboard and Trends charts legible at 360px, with no clipped axis labels or legend overlap.
  - Primary tap targets ≥ 40×40 CSS px, including the inline settle action in every debt row.
  - `bun run typecheck`, `bunx biome check src/`, `bun test`, `bun run build` all green.
  - **Lead Architect signs off in the browser at 360×740.** Until then the card stays open.

  **Out of Scope:**
  - **The nine shared components stay single-path.** Dialogs, forms, StatCards, charts, badges, EmptyState and the input primitives get no mobile variant. Their responsive work is already done; this card must not leak into them.
  - **Tablet-specific layouts.** One breakpoint means 640–840px uses the mobile design even where a table would technically fit. Accepted, not revisited here.
  - Bottom nav — considered and declined in favour of a hamburger drawer.
  - PWA / native shell / installability.
  - Skeleton loading states — separate card in `## Next Cards`.
  - Advance-pay — separate card.
  - Desktop visual redesign. Above 640px nothing changes.
  - New touch gestures (swipe-to-delete, pull-to-refresh).
  - Row virtualization, card expansion/collapse, and per-row expand state.

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
