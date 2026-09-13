---
id: 0008
title: every-action-undoable-audit-snapshots
status: Accepted
date: 2026-08-06
supersedes: []
superseded_by: null
---

# 0008. Every Action Undoable (Audit Snapshot Undo/Redo)

## Context
Finance data is high-stakes — a wrong edit or accidental delete can corrupt months of records. Users need confidence that every mutation is reversible.

## Decision
The `FinanceContext` reducer stores a before-snapshot of the full state on every action. Undo pops the snapshot and pushes the current state onto a redo stack. `Ctrl+Z` / `Ctrl+Y` keybindings trigger undo/redo globally (with a focus guard to avoid hijacking text input undo).

## Consequences
* **Positive:** Every action is reversible; full audit trail; simple mental model.
* **Negative/Risks:** Snapshots duplicate the full state on each action (acceptable at <1000 transactions); Ctrl+Z focus guard must be maintained as new text inputs are added.
