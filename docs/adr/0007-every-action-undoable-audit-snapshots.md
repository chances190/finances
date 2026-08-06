# 0007. Every Action Undoable (Audit Snapshot Undo/Redo)

- **Status:** Accepted
- **Date:** 2026-08-06

## Context
Spreadsheet users expect to undo mistakes with Ctrl+Z or by consulting history; a finance app that makes accidental edits cumbersome to reverse erodes trust. Undoing safely here means restoring the exact prior document state, not compensating with inverse operations that can drift.

## Decision
Treat undoability as a hard requirement for every mutating action (add/update/delete/settle, budget upsert/delete, import, seed). All mutations flow through a single reducer (`FinanceContext`) that snapshots the pre-action document and appends an audit entry (capped at 200); undo restores the snapshot and pushes a forward snapshot to a redo stack. Global shortcuts Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y and per-entry undo buttons in the Actions panel both drive the same mechanism.

## Consequences
- **Positive:** Every action is uniformly reversible with no special cases; the audit log doubles as a human-readable activity history; undo/redo share one code path.
- **Negative/Risks:** Each audit entry holds a full document snapshot, so 200 entries cost memory proportional to dataset size; the audit log is not persisted, so undo history is lost on reload; group mutations (installments) must snapshot the whole group to be undone atomically.
