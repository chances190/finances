---
id: 0001
title: clean-architecture-boundaries
status: Accepted
date: 2026-08-06
supersedes: []
superseded_by: null
---

# 0001. Clean Architecture Boundaries (domain → data → ui)

## Context
The app must keep pure finance logic testable and independent of the UI while staying a single-user prototype. Components mixing calculation, storage, and rendering would make rule changes (budgets, installments, spending pace) fragile.

## Decision
Enforce three layers under `src/`: `domain` (pure entities, constants, calculations — imports nothing from data/ui), `data` (repository, seed, validation, CSV import/export), and `ui` (React components + context). Shared non-domain utilities live in `lib`; shadcn primitives live in `components/ui`. No `application` layer: use cases run directly in the `ui` context reducer, matching v0.x scale.

## Consequences
* **Positive:** `domain/calculations.ts` is unit-tested without a browser; boundaries are visible from the folder tree.
* **Negative/Risks:** UI context holds orchestration logic that would move to an application layer if the app grows; the boundary relies on discipline — no lint rule enforces import direction.
