# 0002. Local-Only Single-User Storage (localStorage)

- **Status:** Accepted
- **Date:** 2026-08-06

## Context
The app is a personal finance tool for one user. Requirements never included accounts, sync, sharing, or cloud access — a server, auth, and database would be unproductive complexity.

## Decision
Keep the app local-only. The entire `FinanceData` document persists to `localStorage` under key `finances-data` (`data/repository.ts`) with runtime validation on load (`data/validation.ts`). Fresh state bootstraps from a deterministic seed (`data/seed.ts`) accepting an optional `Date`, defaulting to 2026-07-01. Data never leaves the browser except by explicit user action (JSON/CSV export, see ADR-0005).

## Consequences
- **Positive:** Zero infrastructure, instant startup, offline by default; deterministic seed keeps charts and demos reproducible.
- **Negative/Risks:** Data is bound to one browser profile — a cleared profile or new machine starts empty unless the user exports; a single JSON blob means no incremental writes or schema migrations (schema changes are handled inside `validateFinanceData`).
