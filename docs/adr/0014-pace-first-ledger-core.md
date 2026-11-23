---
id: 0014
title: pace-first-ledger-core
status: Accepted
date: 2026-11-23
supersedes: [0011, 0013]
superseded_by: null
---

# 0014. Pace-first ledger core

## Context
The single-entry `Transaction` model accumulated special cases: `ownAmount`/`debts`, `settled`, reimbursement netting, transfer skipping, and installment/debt flow math. It cannot answer when a debt was paid vs forgiven, cannot represent money the user owes, and double-counts reimbursements against shared expenses. Spending pace is the primary product goal; cash accuracy is secondary. A clean-room rewrite is approved.

## Decision
Replace stored `Transaction` rows with a minimal ledger: `movements` (date, kind, description, links, importId) and `postings` (movementId, account, signed amount, category?, counterparty?). Accounts are a fixed enum: checking, card, voucher, cash, receivable, payable, income, expense, forgiveness, adjustment. Movement kinds are UI intents: purchase, income, transfer, refund, settlement, adjustment. Builders enforce balanced postings and valid links; categories remain metadata and budgets remain a separate planning layer.

Pace is consumption-based: `expense postings − refund postings`. Transfers, settlements, forgiveness, and adjustments never affect pace. Reimbursements are linked contra-expense postings, not a transaction kind. Payables and receivables are first-class. The UI stays intent-first: no account setup, no debit/credit language, no journal editor; refunds are "Received back", settlements take received/forgiven amounts, imports link to existing movements. Balances are derived but hidden from the primary dashboard.

## Consequences
* **Positive:** One balance invariant replaces scattered rules; deletes `debts`, `settled`, `ownAmount`, installment/debt flow math, reimbursement netting, and transfer hacks; pace remains correct; payables and settlement history become visible; OFX import becomes linking.
* **Negative/Risks:** One-time migration (`settled` defaults to received in full), a new event-builder/selector layer, postings are less intuitive to debug, and the rewrite touches storage, CSV/OFX/JSON adapters, and sync snapshots. Non-goals: chart of accounts, periods, multi-currency, reconciliation workflow, account-balance UI.
