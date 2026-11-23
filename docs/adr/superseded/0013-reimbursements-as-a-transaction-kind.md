---
id: 0013
title: reimbursements-as-a-transaction-kind
status: Superseded
date: 2026-11-23
supersedes: []
superseded_by: 0014
---

# 0013. Reimbursements as a transaction kind

## Context
Money received back for an expense — someone paying their share, a refund, a correction — is currently entered as Income. That inflates income and the savings rate while the spending pace still counts the full purchase, so the month reads as both richer and more expensive than it is. A reimbursement is neither income nor a purchase: it is a credit against spending.

## Decision
Add a third transaction kind, `type: 'Reimbursement'`, with a positive amount, a category (the expense it offsets), and no payment method, installments, or debts. It is cash-basis: it reduces expenses and the matching category in the month it is recorded, not the month of the original purchase.

Expense aggregations subtract reimbursements — `expensesByMonth`, `byCategory`, `spendingPace`, `budgetVsActual`, `yearSummary`, `categoryTimeSeries` — and income aggregations exclude them. Centralize the netting in one helper so call sites cannot drift independently. The exchange CSV carries `type: Reimbursement` with an empty payment method; JSON snapshots and Drive sync carry the kind automatically.

OFX classification is structural only. A credit-card statement credit (`TRNTYPE=CREDIT`) other than the card bill payment (`Pagamento recebido`) is a Reimbursement. Bank statement credits remain Income. There is no memo or text matching: a Pix received from a person is indistinguishable from income, so the user marks it manually in the form.

## Alternatives considered
* **Negative Expense amount — rejected.** Weakens the positive-amount invariant, makes installments and debts meaningful for a non-purchase, and forces the form, validation, and importers to special-case the sign.
* **A reserved `Reimbursement` income category — rejected.** Categories are user-managed strings supplied by the budget; calculations must not depend on a name the user can rename or delete.
* **A `reimbursement` flag on Income — rejected.** Smaller type ripple, but it models a non-income as income and still permits payment-method and installment states that are invalid for a reimbursement.

## Consequences
* **Positive:** Net spending, pace, budgets, and savings rate are correct; positive amounts and the purchase model stay intact; the concept is explicit in the type.
* **Negative/Risks:** A third value in `TransactionType` ripples through the form segmented control, type filters, table rendering, validation, and the exchange CSV. Every expense aggregation must remember to net — one centralized helper, not per-call-site patches. Cash-basis attribution leaves the original month untouched. Detection is asymmetric: credit-card credits are reliable, but bank credits and Pix are not, so they stay Income until the user marks them.
