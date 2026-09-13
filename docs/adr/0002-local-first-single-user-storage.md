---
id: 0002
title: local-first-single-user-storage
status: Accepted
date: 2026-08-06
supersedes: []
superseded_by: null
---

# 0002. Local-Only Single-User Storage (localStorage)

## Context
The prototype needs persistence without a backend. A server, database, or sync layer would add deployment and auth complexity that has no value at v0.x.

## Decision
Persist all data in `localStorage` via `data/repository.ts`. On load, parse and validate; on every state change, serialize. No server, no IndexedDB, no file-system access.

## Consequences
* **Positive:** Zero deployment cost; data stays on the user's machine; offline-first by default.
* **Negative/Risks:** Data is tied to one browser; clearing browser storage deletes everything; JSON size limited by localStorage (~5MB, sufficient for years of transactions).
