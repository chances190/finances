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

Authentication uses the Google Identity Services **token model** (`initTokenClient`) with only the `drive.appdata` scope. The access token is held in memory, never persisted. It expires after about one hour; renewal is lazy on the next sync trigger, first silently with `prompt: 'none'`, then interactively through **Reconnect** when silent renewal fails. There is no refresh token, refresh timer, or polling.

## Alternatives considered
* **GIS code model (authorization code + PKCE) with a refresh token — deferred, not rejected.** This is the stronger OAuth design and Google's recommendation: the refresh token lives in an `HttpOnly` cookie and access tokens renew without user interaction. It requires a token-exchange endpoint holding the client secret and a secure refresh-token store, which means a backend. A Cloudflare Pages Function or Worker could host it cleanly. It is deferred because it expands the trust boundary and contradicts this ADR's no-backend constraint; revisit as its own ADR if real-device testing shows the hourly reconnect is intrusive, especially on iOS/Safari.
* **Legacy implicit flow — rejected.** Google discourages direct use of the implicit endpoint. The GIS token model is the supported browser-only equivalent and avoids hand-rolled redirect and token parsing.

## Consequences
* **Positive:** Cross-device data without a server or manual files; one small module; no per-record sync metadata; offline-first behavior preserved.
* **Negative/Risks:** Google-only dependency; full snapshot upload per settled change; stale-device prompt; no end-to-end encryption; OAuth verification if published. **Access-token expiry:** the one-hour token is renewed lazily. Silent renewal usually succeeds, but browser privacy restrictions, a closed Google session, or a revoked grant surface as `needs-reconnect` and require one interaction. **No refresh token:** while the OAuth consent screen is in Testing, even the deferred code-model upgrade would still require re-consent about weekly because Google expires testing-mode refresh tokens after seven days; publishing removes that limit. Supersedes ADR-0002's no-server clause while retaining `localStorage` as the primary store.
