# 0006. Text-First Data Entry (comma-delimited token autocomplete)

- **Status:** Accepted
- **Date:** 2026-08-06

## Context
The dominant workflow is entering many expenditures quickly. The entry UX evolved deliberately: a full modal batch form (f55e76d), then an inline table-like quick-add row (QuickAddRow era), then a single-line text input (ec9bf55) that replaced the row — mirroring how power users complete tokens in a CLI or IDE.

## Decision
Use a single text field with a comma-delimited grammar: `payment method, amount, description, category, date` (e.g., `debit, 25.90, Lunch, Food, today`). `SmartTransactionInput.tsx` suggests completions per token position — payment-method labels, known categories/descriptions from history, natural-language date presets — accepted with Tab/Enter/Arrow keys; `lib/parseDate.ts` resolves relative dates ("3 days ago", "next month"). Inline validation refuses to submit invalid input.

## Consequences
- **Positive:** Fastest path for repeated entry — one line, keyboard-only, learned suggestions; natural-language dates remove date-picker friction.
- **Negative/Risks:** The grammar is an implicit power-user affordance — it relies on placeholder hints and the modal fallback (`onOpenModal`) for complex cases; token positions are positional, so an empty first field silently defaults the payment method instead of erroring.
