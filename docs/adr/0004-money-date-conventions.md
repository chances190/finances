# 0004. Money & Date Conventions (cents via currency.js + ISO-8601)

- **Status:** Accepted
- **Date:** 2026-08-06

## Context
BRL money must be exact to the cent — installment splits, debt shares, budgets — but JS floats are not (0.1 + 0.2 drift corrupts totals). Formatting, natural-language dates, and month-based reporting (`referenceMonth`) add further edge cases: decimal separators, timezone drift, rounding.

## Decision
Handle money with cents through `currency.js`: it is the single money primitive. `parseCurrency`/`formatCurrency` (`lib/currency.ts`) and every money computation go through it — `generateInstallments` divides and rounds via currency.js, with the last installment absorbing the remainder. The `FinanceData` document stores decimal numbers for ergonomics, but code never performs raw float arithmetic on amounts. Dates are ISO `YYYY-MM-DD` strings; month keys `YYYY-MM` are compared arithmetically (`domain/calculations.ts`); date parsing pins UTC noon (`T12:00:00Z`) so timezone drift cannot shift a report month. Natural-language entry is parsed in `lib/parseDate.ts`.

## Consequences
- **Positive:** Cent-exact installments and debt splits; deterministic report months; one formatting path for badges, tables, and charts; natural-language entry is unit-tested.
- **Negative/Risks:** Currency.js must stay at every money boundary — bypassing it (e.g., `parseFloat` in legacy QuickAddRow code) reintroduces float drift; date strings are local-calendar concepts rather than true UTC timestamps.
