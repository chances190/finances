---
id: 0007
title: text-first-data-entry
status: Accepted
date: 2026-08-06
supersedes: []
superseded_by: null
---

# 0007. Text-First Data Entry (comma-delimited token autocomplete)

## Context
A finance tracker is primarily a data-entry tool. Dropdowns and modal forms slow down batch entry of 10–20 transactions. The user needs fast, keyboard-driven input that feels like typing a command.

## Decision
Primary data entry via `SmartTransactionInput` — a single text field that parses comma-delimited tokens into a `ParsedTransaction`. Tokens map to fields (amount, description, category, payment method, date) by position or keyword. Autocomplete suggestions appear as the user types. Fallback: `TransactionForm` for structured editing and edge cases.

## Consequences
* **Positive:** Rapid data entry for common cases; keyboard-only workflow; minimal clicks for repeat transactions.
* **Negative/Risks:** Parser rules must be learned; ambiguous input requires disambiguation UI; the fallback form adds maintenance surface.
