---
id: 0011
title: purchase-centric-transactions
status: Superseded
date: 2026-09-08
supersedes: []
superseded_by: 0014
---

# 0011. Purchase-Centric Transactions (Derived Installment Flows, Debts as Attachments)

## Context
The flat `Transaction` carried optional `installment`/`parentId`/`groupId` plus an `isDebt`/`debtorName`/`debtSplits`/`debtUserShare` complex, which allowed impossible states: installment siblings stored as independent rows that desync on edit, `installment` without a group, debts modeled as a kind of transaction. Domain reality: a credit purchase fixes its plan at creation (amounts immutable — only early payment can change pacing later), a debt is always a receivable attached to something I paid, and a debtor settles in full or not at all.

## Decision
A `Transaction` represents the purchase/receipt itself: common fields plus `installments?: number` (present iff `CREDIT` and > 1, immutable after creation) and `debts?: Debt[]` (expenses only), where `Debt = { name, amount, settled }`. Everything else is derived: monthly cash flows are computed from `date` + installment index (remainder absorbed by the first flow), a flow's `referenceMonth` follows its derived month, future commitments are flows whose month has not passed, and the user's share is `amount − Σdebts`. `parentId`, `groupId`, `isDebt`, `debtorName`, `debtSplits`, `debtUserShare`, `isSettled`, and stored `referenceMonth` are deleted. Clean break: no migration of old localStorage data or JSON backups.

## Consequences
* **Positive:** Sibling desync becomes unrepresentable (siblings are not stored rows); debt semantics match reality (receivable, full settlement); several fields and their sync code are deleted; the exchange CSV maps cleanly onto derived flows.
* **Negative/Risks:** Breaking change — old backups and local data are discarded (accepted at v0.x, single-user local); every consumer re-derives flows, making `monthlyFlows()` a hot path (acceptable at <1000 transactions); advance-pay of installments requires a future model extension.
