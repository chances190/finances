# 0008. Budget Ranges as Derived Grouping (Per-Month Documents)

- **Status:** Accepted
- **Date:** 2026-08-06

## Context
Budgeting historically required per-month entries, but users plan in ranges (e.g., "2026-09 → 2026-12"). Two designs: persist range metadata on budget documents, or keep per-month documents and derive consecutive-equal groups at render.

## Decision
Budgets remain per-month documents (localStorage, per ADR-0002). `groupBudgetsByRange()` in `domain/calculations.ts` derives ranges from consecutive months with identical `plannedIncome`/`plannedMealVoucher`/`categoryLimits`. Creating/editing uses From→To and upserts each month in the range. Overlapping a month that already has a different budget, or dropping months from a group, is allowed only after an in-dialog confirm listing the affected months (Back is non-destructive).

## Consequences
- **Positive:** No schema migration; ranges stay consistent with per-month spend rollups; overlap decisions are explicit and recoverable.
- **Negative/Risks:** Range identity is implicit (equal values + adjacency); a transient one-month edit splits a group visually until values are re-unified.
