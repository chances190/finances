---
id: 0012
title: google-drive-snapshot-sync
status: Proposed
date: 2026-11-04
supersedes: [0002]
superseded_by: null
---

# 0012. Google Drive Snapshot Sync

## Context
The app is local-first and persists to `localStorage`. The Lead Architect wants the same single-user dataset on phone and desktop without manual file transfer, accepts OAuth, and does not intend concurrent writes. A full sync engine — outbox, tombstones, per-record metadata, CRDTs — is disproportionate.

## Decision
Add optional Google Drive sync through the hidden `appDataFolder` and one JSON snapshot (`finances.json`). `localStorage` remains the local source of truth. Sync runs on app start, `online`, visibility, and a manual action; local changes are debounced and serialized off the render path. A remote version/ETag guard prevents stale overwrites; the only conflict UI is a Download/Overwrite prompt. No backend, outbox, CRDT, or IndexedDB migration.

## Consequences
* **Positive:** Cross-device data without a server or manual files; one small module; no per-record sync metadata; offline-first behavior preserved.
* **Negative/Risks:** Google-only dependency; short-lived OAuth tokens and possible reconnect; full snapshot upload per settled change; stale-device prompt; no end-to-end encryption; OAuth verification if published. Supersedes ADR-0002's no-server clause while retaining `localStorage` as the primary store.
