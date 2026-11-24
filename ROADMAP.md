# Repository Roadmap

*Goal: a feature-complete single-user personal finance tracker — transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode. Direction: full Svelte 5 UI port now (ADR-0015, React retired when parity lands), then Drive sync device verification, then skeleton loading, then advance-pay.*

---

## Active Card
> *There can only be ONE Active Card at a time. Finish or push to Next before opening another.*

- **Svelte 5 port — foundation (opened 2026-11-24):** replace React 18 + wouter + Base UI with Svelte 5 runes on Vite 8, a tiny History-API router and shadcn-svelte (bits-ui) primitives, so every later port card is a page slice instead of infrastructure work (ADR-0015).

  **Intent:**
  - Stand up the Svelte toolchain, app shell, finance/toast stores and the primitive layer behind the six existing routes.
  - Framework swap only: `domain/`, `data/`, `lib/` and `functions/` stay byte-identical, and no test file changes.

  **Trade-offs / Risks:**
  - A rewrite of ~9.4k lines of UI, not a codemod; the untouched domain/data suite is the only automated safety net. UI behavior is verified per page by checklist, not diff.
  - Restyle is in scope (visual language only): shadcn-svelte component defaults replace the hand-tuned Nova class strings, so pixel parity is explicitly not a goal; layout and information architecture stay fixed.
  - Biome's Svelte support is experimental. If `.svelte` formatting or linting proves unstable, fall back to Prettier + `prettier-plugin-svelte` for those files and record it in ADR-0015.

  **Acceptance Criteria (DoD):**
  - `package.json` drops `react`, `react-dom`, `wouter`, `@base-ui/react`, `recharts`, `@tanstack/react-virtual`, `@phosphor-icons/react`, `@types/react*`, `@vitejs/plugin-react`, `shadcn`; adds `svelte`, `@sveltejs/vite-plugin-svelte`, `bits-ui`, `phosphor-svelte`, `svelte-check` (Vite 8). `src/App.tsx` and `src/main.tsx` are gone; `index.html` mounts `src/main.ts`.
  - `components.json` is rewritten for shadcn-svelte with `@/components/ui` aliases; `src/index.css` no longer imports `shadcn/tailwind.css`, and the oklch tokens, fonts and `@custom-variant dark` survive unchanged.
  - `bun run typecheck` (svelte-check), `bunx biome check src/ functions/`, `bun test`, `bun run build` are green; `bun run dev` serves the shell.
  - Shell renders header, desktop tabs and mobile nav; all six routes navigate, survive reload, and unknown paths fall back to Transactions; query params round-trip through the router.
  - `FinanceStore` reproduces the reducer contract (movement add/update/delete/bulk-delete, budget upsert/delete, import, apply-remote, undo/redo with the 200-entry cap, idle save + `pagehide` flush); `git diff --stat main -- src/domain src/data src/lib functions` is empty and `bun test` count is unchanged.
  - Toast store renders success/error/info with the existing 3s/6s lifetimes; Ctrl/Cmd+Z and Shift+Z still skip text inputs and interactive controls.
  - Primitives live in `src/components/ui/*` (shadcn-svelte aliases configured): button, badge, input, textarea, label, checkbox, select, dialog, popover, table, segmented control, money input, input-group; pages import from there, never from bits-ui directly.
  - `vite-plugin-pwa` still emits the manifest + service worker and `functions/api/google/token.ts` deploys unchanged.
  - Lead Architect signs off the shell at 360×740 and desktop.

  **Out of Scope:**
  - Any edit to `src/domain`, `src/data`, `src/lib`, `functions/`, storage keys, snapshot shape or test files.
  - Page ports (Transactions, Debts, Budgets, Dashboard/Trends, sync, import/export) and their dependencies (`chart.js`, `svelte-chartjs`, `@tanstack/svelte-virtual`) — each lands with its page card.
  - SvelteKit/SSR, dark mode, new features, layout redesign.

---

## Next Cards
> *Direction-only one-liners for future work in this milestone.*

- **Svelte port — Transactions slice:** port `TransactionTable` (window virtualizer, month nav, filters, sort, search, bulk delete), `SmartTransactionInput`, `TransactionForm`, `SplitConfigModal` and the refund/settle dialogs; install `@tanstack/svelte-virtual`, then re-baseline the 4x-throttled 1,097-row trace on the Svelte build and sign off 360×740.
- **Svelte port — Debts:** port `DebtPage` — receivables/payables lists, settle with received/forgiven, provenance and the single-split control.
- **Svelte port — Budgets:** port `BudgetPage` + `BudgetFormDialog` — range CRUD with shrink/overlap confirm.
- **Svelte port — Dashboard & Trends:** port stat cards, pace and the seven charts onto `chart.js` + `svelte-chartjs`; delete the recharts wrappers and the React-typed `chartTheme`.
- **Svelte port — Sync, import/export & Actions:** port `SyncContext` to a rune store plus `SyncControl`, `ImportDialog` (CSV/OFX/JSON), backup/export and `AuditLogPanel`.
- **Svelte port — parity close-out:** delete the remaining React sources and shims, re-check PWA + `wrangler pages deploy`, phone sign-off on every flow, flip ADR-0015 to Accepted and move ADR-0003/0005 to `superseded/`.
- **Google Drive sync — device verification (parked 2026-11-23):** the code landed (`edbf643`, `f8241fa`, `513ef0e`; ADR-0012 Proposed) with the `appDataFolder` snapshot, refresh-token cookie, version guard and Pull/Push prompt. Only the phone + desktop round-trip sign-off remains; re-run after the port, before public release.
- **Skeleton loading states for Dashboard:** Lightweight loading placeholders for `DashboardPage` (carried over from the old UI/UX plan, Commit 9 — never implemented). Re-target to the Svelte page when it lands.
- **Advance-pay for credit installments:** Let the user pay the next N installments now and shift the remainder. Requires a `paidInstallments` marker in the model — a domain change, so it wants its own card and likely an ADR.

---

## Done Cards
> *Completed cards with objective outcomes.*

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
