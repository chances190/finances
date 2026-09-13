---
id: 0005
title: frontend-toolchain
status: Accepted
date: 2026-08-06
supersedes: []
superseded_by: null
---

# 0005. Frontend Toolchain (bun + Vite + Tailwind v4 + shadcn/ui)

## Context
The prototype needs fast iteration, zero-config styling, and no framework lock-in beyond React. Defaults like Next.js, npm, or Radix-based shadcn would add routing/SSR or tooling overhead without value here.

## Decision
Use bun as package manager/runtime with Vite + React 18 + TypeScript. Styling is Tailwind v4 (Vite plugin) with shadcn/ui components on the Base UI preset (`base-lyra` style in `components.json`), tailored to the design system (rounded-none, Inter + JetBrains Mono). Charts: recharts; utilities: date-fns, uuid, currency.js, Phosphor icons; lint/format: Biome. Tests run with `bun test` — no separate test framework dependency.

## Consequences
* **Positive:** Fast installs/builds; consistent shadcn components; single lint/format tool; one package manager everywhere.
* **Negative/Risks:** Tailwind v4 + Base UI preset is newer than classic Radix shadcn — fewer community answers; shadcn CLI upgrades may re-introduce Radix assumptions.
