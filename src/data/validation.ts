import { INCOME_PAYMENT_METHODS, PAYMENT_METHODS, TRANSACTION_TYPES } from '../domain/constants'
import type { Budget, FinanceData, PaymentMethod, Transaction } from '../domain/entities'

function isValidTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return (
    (typeof t.id === 'string' &&
      typeof t.date === 'string' &&
      typeof t.referenceMonth === 'string' &&
      typeof t.description === 'string' &&
      typeof t.amount === 'number' &&
      typeof t.category === 'string' &&
      TRANSACTION_TYPES.includes(t.type as (typeof TRANSACTION_TYPES)[number]) &&
      PAYMENT_METHODS.includes(t.paymentMethod as PaymentMethod)) ||
    INCOME_PAYMENT_METHODS.includes(t.paymentMethod as PaymentMethod)
  )
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

  const validTransactions = data.transactions.filter(isValidTransaction)
  const validBudgets = data.budgets.filter(isValidBudget)

  return { transactions: validTransactions, budgets: validBudgets }
}
