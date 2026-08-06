# 0003. React Context + useReducer State Management

- **Status:** Accepted
- **Date:** 2026-08-06

## Context
The finance document is small and updated from many components (quick add, forms, imports, undo/redo). An external state library would add a dependency without solving a real problem at this scale.

## Decision
Manage all finance state in a single `FinanceContext` using `useReducer` with a typed `FinanceAction` union and an audit-log/redo-stack snapshot mechanism for undo/redo. UI feedback (toasts) lives in a separate lightweight `ToastContext`. No Redux, Zustand, React Query, or persistence middleware.

## Consequences
- **Positive:** Actions are typed and auditable; undo/redo reuses the same action stream; no new dependency.
- **Negative/Risks:** All mutations funnel through one reducer — if component growth continues, splitting contexts or adding an application layer (see ADR-0001) becomes necessary.
