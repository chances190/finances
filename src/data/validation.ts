import { INCOME_PAYMENT_METHODS, PAYMENT_METHODS, TRANSACTION_TYPES } from '../domain/constants'
import type { Budget, FinanceData, PaymentMethod, Transaction } from '../domain/entities'

function isValidTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  if (
    typeof t.id !== 'string' ||
    typeof t.date !== 'string' ||
    typeof t.description !== 'string' ||
    typeof t.amount !== 'number' ||
    typeof t.category !== 'string' ||
    !TRANSACTION_TYPES.includes(t.type as (typeof TRANSACTION_TYPES)[number])
  ) {
    return false
  }
  if (t.type === 'INCOME') {
    if (!INCOME_PAYMENT_METHODS.includes(t.paymentMethod as PaymentMethod)) return false
    if (t.installments != null) return false
    if (t.debts != null) return false
  } else {
    if (!PAYMENT_METHODS.includes(t.paymentMethod as PaymentMethod)) return false
  }
  return true
}

function isValidBudget(value: unknown): value is Budget {
  if (!value || typeof value !== 'object') return false
  const b = value as Record<string, unknown>
  return (
    typeof b.referenceMonth === 'string' &&
    typeof b.plannedIncome === 'number' &&
    typeof b.plannedMealVoucher === 'number' &&
    typeof b.categoryLimits === 'object' &&
    b.categoryLimits !== null
  )
}

export function validateFinanceData(value: unknown): FinanceData {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid data: expected an object')
  }

  const data = value as Record<string, unknown>

  if (!Array.isArray(data.transactions)) {
    throw new Error('Invalid data: transactions must be an array')
  }
  if (!Array.isArray(data.budgets)) {
    throw new Error('Invalid data: budgets must be an array')
  }

  if (data._version !== 2) {
    throw new Error(
      'Incompatible data format. This version requires v2 data. Please export your old data first, then reimport after upgrading.',
    )
  }

  const validTransactions = data.transactions.filter(isValidTransaction)
  const validBudgets = data.budgets.filter(isValidBudget)

  return { transactions: validTransactions, budgets: validBudgets }
}
