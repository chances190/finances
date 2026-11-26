---
id: 0003
title: react-context-reducer-state
status: Superseded
date: 2026-08-06
supersedes: []
superseded_by: 0015
---

# 0003. React Context + useReducer State Management

## Context
The app needs shared state (transactions, budgets, audit log) across pages without the ceremony of Redux or Zustand for a single-user prototype.

## Decision
Use a single React Context + `useReducer` pattern (`FinanceContext.tsx`). The reducer handles all mutations; an `auditLog` array stores before-snapshots for undo/redo. Side effects (localStorage persistence, seed loading) run in `useEffect` after state changes.

## Consequences
* **Positive:** No external state dependency; undo/redo is built into the reducer; state shape is visible and testable.
* **Negative/Risks:** Large context updates re-render all consumers; the reducer file grows with action types; no selector/memoization optimization at this scale.
