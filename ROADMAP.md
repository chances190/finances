# Repository Roadmap

*Goal: a feature-complete single-user personal finance tracker — transactions, budgets, debts, dashboard, trends, CSV import/export, dark mode. Direction: optional Google Drive sync now, then transactions re-profile, then skeleton loading, then advance-pay.*

---

## Active Card
> *There can only be ONE Active Card at a time. Finish or push to Next before opening another.*

- **Google Drive snapshot sync (opened 2026-11-04):** add optional cross-device sync for the same single-user dataset, so phone and desktop see the same transactions and budgets without manual file transfer. Local data stays authoritative; sync is one JSON snapshot in Google Drive's hidden `appDataFolder`, guarded by a remote version/ETag.

  **Decisions (closed — do not relitigate):**
  - **Google Drive `appDataFolder` only.** OAuth through Google Identity Services with the `drive.appdata` scope; no backend and no client secret. The app never sees the user's other Drive files.
  - **One snapshot, not a sync engine.** Upload `{ transactions, budgets }` as `finances.json`. No outbox, tombstones, per-record `_syncStatus`, CRDT, or field-level merge.
  - **Local-first.** `localStorage` remains the primary store; sync never blocks a local write. IndexedDB migration is out of scope.
  - **Triggers:** app start, `online`, tab visibility, and a manual **Sync now**. Debounce local changes ~2 s. No Background Sync API and no polling.
  - **Version guard.** Persist `lastSyncedRemoteVersion` / `lastSyncedAt` and a dirty flag. Before updating, compare the remote version and use `If-Match`/ETag. If the remote changed and local is dirty, prompt **Download** / **Overwrite**. No silent clobber.
  - **Strict render isolation.** Sync state lives outside `FinanceContext`; `TransactionTable` must not re-render because sync state changed. Serialization runs in `requestIdleCallback`/after paint; upload is a background `fetch`.

  **Trade-offs / risks:**
  - **Google-only dependency.** OAuth access tokens are short-lived; a reconnect may be required when silent renewal fails. Test the standalone PWA flow on iOS before calling it done.
  - **Full snapshot per settled change.** Fine at current data size, but only if it stays off the render path. A per-record sync model is explicitly rejected.
  - **The stale-device prompt is the only conflict UI.** Concurrent editing is unsupported by design; two offline edits still surface one prompt rather than merging.
  - **`appDataFolder` is private to the app, not end-to-end encrypted.** Google can read the file. Passphrase encryption is deferred.
  - **OAuth verification.** Test-user mode is enough while undeployed; public release needs Google verification for the scope.

  **Acceptance Criteria (DoD):**
  - Connect and disconnect Google Drive from a single control outside the transaction table; the granted scope is `drive.appdata` only and the app cannot list the user's other files.
  - First sync creates `finances.json` in `appDataFolder`; later syncs update the same file.
  - Add, edit, and delete on device A; sync; device B reloads and sees the change. The reverse direction works too.
  - An offline edit on A persists locally and uploads on reconnect, visibility, or **Sync now**; no data is lost.
  - If the remote version changed since the last sync and local is dirty, the Download/Overwrite prompt appears. Choosing Download replaces local; Overwrite uploads; neither path silently clobbers.
  - Sync status is visible: last synced time, syncing, error, and reconnect. No toast spam.
  - **Performance guard:** capture a baseline 4x-throttled mobile trace of the current transactions page at ~1,097 rows. Sync must add no long task over 100 ms, no extra `TransactionTable` render, and no measurable change to mutation-to-paint.
  - `bun run typecheck`, `bunx biome check src/`, `bun test`, `bun run build` all green.
  - **Lead Architect verifies the phone + desktop round trip with the same Google account.**

  **Out of Scope:**
  - IndexedDB migration; `localStorage` stays.
  - Outbox, tombstones, per-record sync metadata, CRDTs, field-level merge, or a conflict UI beyond the single stale-device prompt.
  - Background Sync API; sync triggers are app start, `online`, visibility, and manual action only.
  - End-to-end encryption / passphrase UX.
  - Multi-user or shared datasets; concurrent editing.
  - Dropbox, OneDrive, remoteStorage, or a custom sync backend.
  - Real-time sync or polling.
  - Reworking the transaction table's remaining performance problems; that is a separate concern.

---

## Next Cards
> *Direction-only one-liners for future work in this milestone.*

- **Skeleton loading states for Dashboard:** Lightweight loading placeholders for `DashboardPage` (carried over from the old UI/UX plan, Commit 9 — never implemented). Kept separate from the mobile card on purpose: it is one file and near-mechanical, and bundling it would have blurred two unrelated DoDs.
- **Transactions page re-profile:** capture a fresh 4x-throttled mobile trace of the virtualized transaction list at ~1,097 rows and identify any remaining long task over 100 ms. Kept separate from sync, which must not regress this baseline.
- **Advance-pay for credit installments:** Let the user pay the next N installments now and shift the remainder. Requires a `paidInstallments` marker in the model — a domain change, so it wants its own card and likely an ADR.

---

## Done Cards
> *Completed cards with objective outcomes.*

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
