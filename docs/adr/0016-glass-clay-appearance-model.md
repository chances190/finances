---
id: 0016
title: glass-clay-appearance-model
status: Proposed
date: 2026-11-26
supersedes: []
superseded_by: null
---

# 0016. Glass + Clay Appearance Model

## Context

The design lab settled on one visual language and the Lead Architect accepted it: dark mode is frosted glass, light mode is high-contrast clay, the base radius is 4px, and colour is driven by four bases with an Ink-first accent set. Production still runs the Nova oklch palette, a binary theme and one hardcoded accent, and the lab duplicates the token set it previews. Porting needs one persisted appearance model, one token contract, and a decision on the lab's lifetime.

## Decision

* One material system, no user-selectable presets. Radius base 4px. UI text stays Manrope, figures stay JetBrains Mono.
* Bases are Ink, Sage, Steel, Plum. Ink additionally exposes `mono`, `system`, yellow, green, red, pink, blue, purple and orange accents.
* System theme is the default and resolves through `prefers-color-scheme`. The `system` ink accent maps to CSS `AccentColor`/`AccentColorText` behind `@supports`; unsupported platforms fall back to Ink mono in CSS, not JavaScript.
* One appearance blob lives in the existing `finances-theme` key: `{ theme, accent, inkAccent }`. Invalid or legacy values reset to system/ink/mono; no migration shim.
* Semantic red/green for income, expense, refunds and debt status are independent of the accent. Chart tokens follow the accent except income/expense.
* The production app is the only token source. The lab is deleted once the port is signed off; git history and the recorded screenshots are the reference.

## Consequences

* **Positive:** single token source, no duplicated palette, instant appearance changes that repaint charts, and a persistent model that survives reloads.
* **Negative/Risks:** accent surfaces are hand-tuned per base, so a fifth base means editing the token block; `AccentColor` cannot read Plasma or Material palettes and is missing on Chrome Android/ChromeOS; backdrop blur is a measurable mobile scroll cost on long lists.
