# Refactor Plan (8 commits)

## Done

- [x] **Commit 1 — Core types & constants cleanup**
  - Extract DebtConfig/DebtSplitUI to domain/entities.ts
  - Move PAYMENT_METHODS to domain/constants.ts
  - Remove unused SAVINGS_RATE
  - Remove 'use client' from shadcn components
  - Fix `as never` cast in BudgetPage.tsx

## In progress

- [x] **Commit 2 — Type safety patch**
  - Replace `rowData: any` in handleQuickAdd with proper QuickAddRowState type
  - Replace `rowData: any` in generateInstallments with typed parameters
  - Add runtime validator for FinanceData (JSON.parse safety)
  - Fix unsafe `as Transaction['paymentMethod']` in CSV import

- [x] **Commit 3 — State management fixes**
  - Remove `open` from useEffect dependency in TransactionForm.tsx
  - Fix BudgetPage stale closure — use setForm(f => ...) consistently
  - Add useRef cleanup for FileReader in CSVImportDialog

- [x] **Commit 4 — Replace alert/confirm with non-blocking UX**
  - Create lightweight toast notification system (ToastContext)
  - Create reusable ConfirmDialog component
  - Add ErrorBoundary wrapper
  - Replace all 10 alert()/confirm() calls with toast/dialog alternatives

- [x] **Commit 5 — Extract domain utilities & fix seed data**
  - Move generateInstallments() from TransactionTable.tsx to domain/calculations.ts
  - Make seed data deterministic (accepts optional Date param, defaults to 2026-07-01)
  - Fix parseDate to use UTC explicitly (Z suffix)

- [ ] **Commit 6 — UI consistency & dark mode**
  - Rewrite Tabs.tsx to use CSS variable tokens (bg-background, etc.)
  - Replace inline R$ formatting in CSVImportDialog with formatCurrency()
  - Remove noop ternary in CSVImportDialog.tsx
  - Unify export patterns (pick one convention)

- [ ] **Commit 7 — Fix original TODO.md bugs**
  - Fix "Is Debt" button wiring in the add dialog
  - Hide debt configuration for INCOME transactions
  - Redesign installments/debt UI to be consistent
  - Add validation to reject negative amounts at form level
  - Implement advance-pay feature for credit installments

- [ ] **Commit 8 — Refactor large components**
  - Split TransactionTable.tsx (~310 lines) — extract PaymentBadge, TransactionRow, month filtering
  - Split BudgetPage.tsx (~360 lines) — extract BudgetFormDialog into its own file

# Original bug list (from old TODO.md, migrated to Commit 7)

- [ ] The is Debit buttons on add transaction model STILL DON'T WORK
- [ ] Incomes shouldn't have debitors
- [ ] Installments and "is debt" should have consistent UI
- [ ] The user must be able to advance pay on credit transactions (pay the next N months, shift the rest if any)
- [ ] Ensure the application either rejects or doesn't break with negative values
