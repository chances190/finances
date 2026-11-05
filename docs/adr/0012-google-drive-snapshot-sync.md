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
Add optional Google Drive sync through the hidden `appDataFolder` and one JSON snapshot (`finances.json`). `localStorage` remains the local source of truth. Sync runs on app start, `online`, visibility, and a manual action; local changes are debounced and serialized off the render path. A remote version/ETag guard prevents stale overwrites; the only conflict UI is a Pull/Push prompt. No sync backend, database, outbox, CRDT, or IndexedDB migration.

Authentication uses the Google Identity Services **code model** (authorization code + PKCE) in popup mode with only the `drive.appdata` scope. Google returns an authorization code to the browser; a single stateless Cloudflare Pages Function exchanges it at Google's token endpoint and keeps the client secret server-side. The refresh token is stored in an `HttpOnly; Secure; SameSite=Lax` cookie scoped to `/api/google`; the access token stays in memory and is renewed through the Function. The Function stores no user data and is not a sync backend.

## Alternatives considered
* **GIS token model (`initTokenClient`) — rejected after real-device testing.** It has no refresh token. In the Lead Architect's environment, silent renewal failed often enough to force Google's consent UI every few minutes, which defeats the purpose of a background sync.
* **Legacy implicit flow — rejected.** Google discourages direct use of the implicit endpoint. The GIS code model is the supported flow and avoids hand-rolled redirect and token parsing.

## Consequences
* **Positive:** Cross-device data without a sync server or manual files; one small module; no per-record sync metadata; offline-first behavior preserved. Refresh-token renewal ends the hourly consent cycle; the token-exchange Function is stateless and holds no user data.
* **Negative/Risks:** Google-only dependency; full snapshot upload per settled change; stale-device prompt; no end-to-end encryption; OAuth verification if published. **New trust boundary:** the Cloudflare Pages Function holds the client secret and the refresh-token cookie, so it needs strict Origin/CSRF checks and rate limiting. **Testing-mode refresh tokens** expire after seven days until the consent screen is published. **OAuth client setup:** the origin must be an authorized redirect URI for the popup code exchange. Supersedes ADR-0002's no-server clause while retaining `localStorage` as the primary store.
