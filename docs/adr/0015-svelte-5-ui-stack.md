---
id: 0015
title: svelte-5-ui-stack
status: Proposed
date: 2026-11-24
supersedes: [0003, 0005]
superseded_by: null
---

# 0015. Svelte 5 UI Stack

## Context
ADR-0001 kept `domain/`, `data/` and `lib/` framework-free and fully tested, so only the 40 TSX files and their tooling are bound to React 18, wouter, Base UI and recharts. The Lead Architect approved replacing that UI layer with Svelte 5. The port restyles the visual language at the same time, but keeps the information architecture and every user flow unchanged. React stays on `main` until parity is signed off; the port lands on a `svelte-port` branch/worktree so both builds can run side by side.

## Decision
Use Svelte 5 runes on Vite 8 (`@sveltejs/vite-plugin-svelte`) as a plain SPA — no SvelteKit, no SSR, because the app has six static routes and local-first storage behind unchanged Cloudflare Pages Functions. Shared state becomes module-level `.svelte.ts` stores (`finance`, `sync`, `toast`) instead of context providers; the reducer, audit log and undo/redo semantics carry over verbatim. Routing is a ~60-line History-API router (`$state` path plus query string) rather than a dependency. Primitives come from shadcn-svelte on bits-ui v2, aliased to `src/components/ui`, keeping the existing oklch tokens, Inter + JetBrains Mono and the current layout; shadcn-svelte defaults replace the hand-tuned Nova class strings. Charts move to `chart.js` + `svelte-chartjs` (plus `chartjs-plugin-annotation` for the single "Today" reference line), the window virtualizer to `@tanstack/svelte-virtual`, and icons to `phosphor-svelte`. Types are checked by `svelte-check`; Biome 2.6 keeps lint/format with `html.experimentalFullSupportEnabled`.

## Consequences
* **Positive:** Drops the React runtime plus Base UI, wouter, recharts and their type packages; runes remove provider nesting and the `useRef` mirrors in sync; `domain/`/`data/` tests stay untouched and become the parity proof; one fewer framework boundary to maintain.
* **Negative/Risks:** A ~9.4k-line UI rewrite with no automated UI tests and no codemod; bits-ui uses different data attributes than Base UI, so primitive styles need adjusting; Biome's Svelte support is experimental (fallback: Prettier + `prettier-plugin-svelte`); chart.js needs an annotation plugin and imperative config for mixed axis charts. On acceptance, ADR-0003 and ADR-0005 move to `docs/adr/superseded/`.
