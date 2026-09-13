---
id: 0009
title: budget-ranges-derived-grouping
status: Accepted
date: 2026-08-06
supersedes: []
superseded_by: null
---

# 0009. Budget Ranges as Derived Grouping (Per-Month Documents)

## Context
Budgets should reflect actual spending patterns, not arbitrary pre-set limits. Hardcoded budget values go stale quickly and create false "over-budget" alerts.

## Decision
Budget ranges are derived from transaction history. `calculateBudgetRanges()` analyzes 3 months of spending per category and produces min/typical/max ranges. These are stored as `BudgetRange[]` in state and refreshed when transactions change. No hardcoded budget values exist in the domain model.

## Consequences
* **Positive:** Budgets stay current with actual spending; no manual budget entry required; ranges give a "normal" band rather than a hard limit.
* **Negative/Risks:** Ranges are reactive (lag behind spending changes); new categories with <3 months of data show no range; the derivation logic is a single function that could grow complex.
