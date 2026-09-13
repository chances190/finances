---
id: 0004
title: money-date-conventions
status: Accepted
date: 2026-08-06
supersedes: []
superseded_by: null
---

# 0004. Money & Date Conventions (cents via currency.js + ISO-8601)

## Context
Floating-point arithmetic produces rounding errors in financial calculations. Dates must be consistent across localStorage, CSV export, and UI display.

## Decision
Money values are stored as integers (cents) and computed via `currency.js`. Display uses `formatCurrency` (BRL). Dates are ISO-8601 strings (`YYYY-MM-DD`); months are `YYYY-MM`. A local `currentYM()` helper avoids UTC off-by-one errors.

## Consequences
* **Positive:** Rounding errors eliminated for display; date handling consistent across timezones; currency.js handles BRL formatting.
* **Negative/Risks:** Internal floats still exist in calculations.ts aggregations (raw `+` operator) — a known debt flagged in MED backlog.
