import { INCOME_PAYMENT_METHODS, PAYMENT_METHODS, TRANSACTION_TYPES } from '../domain/constants'
import type { Budget, FinanceData, PaymentMethod, Transaction } from '../domain/entities'

export type SkipReason = string

export function validateTransaction(
  value: unknown,
): { ok: true; tx: Transaction } | { ok: false; reason: SkipReason } {
  if (!value || typeof value !== 'object') return { ok: false, reason: 'not an object' }
  const t = value as Record<string, unknown>

  if (typeof t.id !== 'string') return { ok: false, reason: 'missing or invalid id' }
  if (typeof t.date !== 'string') return { ok: false, reason: 'missing or invalid date' }
  if (typeof t.description !== 'string')
    return { ok: false, reason: 'missing or invalid description' }
  if (typeof t.amount !== 'number' || Number.isNaN(t.amount) || t.amount < 0)
    return { ok: false, reason: 'amount must be a non-negative number' }
  if (typeof t.category !== 'string') return { ok: false, reason: 'missing or invalid category' }

  if (!TRANSACTION_TYPES.includes(t.type as (typeof TRANSACTION_TYPES)[number])) {
    return {
      ok: false,
      reason: `invalid type: "${t.type}" (expected: ${TRANSACTION_TYPES.join(', ')})`,
    }
  }

  const type = t.type as Transaction['type']

  if (type === 'Income') {
    if (!INCOME_PAYMENT_METHODS.includes(t.paymentMethod as PaymentMethod)) {
      return {
        ok: false,
        reason: `invalid payment method: "${t.paymentMethod}" for Income (expected: ${INCOME_PAYMENT_METHODS.join(', ')})`,
      }
    }
    if (t.installments != null)
      return { ok: false, reason: 'Income transaction cannot have installments' }
    if (t.debts != null) return { ok: false, reason: 'Income transaction cannot have debts' }
  } else {
    if (!PAYMENT_METHODS.includes(t.paymentMethod as PaymentMethod)) {
      return {
        ok: false,
        reason: `invalid payment method: "${t.paymentMethod}" for Expense (expected: ${PAYMENT_METHODS.join(', ')})`,
      }
    }
  }

  if (t.debts != null) {
    if (!Array.isArray(t.debts)) return { ok: false, reason: 'debts must be an array' }
    for (const d of t.debts) {
      if (!d || typeof d !== 'object') return { ok: false, reason: 'invalid debt entry' }
      const debt = d as Record<string, unknown>
      if (typeof debt.name !== 'string') return { ok: false, reason: 'debt.name must be a string' }
      if (typeof debt.amount !== 'number')
        return { ok: false, reason: 'debt.amount must be a number' }
      if (typeof debt.settled !== 'boolean')
        return { ok: false, reason: 'debt.settled must be a boolean' }
    }
  }

  if (t.installments != null) {
    if (type === 'Income')
      return { ok: false, reason: 'Income transaction cannot have installments' }
    if (
      typeof t.installments !== 'number' ||
      !Number.isInteger(t.installments) ||
      t.installments < 1
    ) {
      return { ok: false, reason: 'installments must be a positive integer' }
    }
  }

  return { ok: true, tx: value as Transaction }
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

export interface SkippedEntry {
  index: number
  reason: SkipReason
}

export interface ValidationResult {
  data: FinanceData
  skippedTransactions: SkippedEntry[]
  skippedBudgets: number
}

export function validateFinanceData(value: unknown): ValidationResult {
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

  const validTransactions: Transaction[] = []
  const skippedTransactions: SkippedEntry[] = []

  for (let i = 0; i < data.transactions.length; i++) {
    const result = validateTransaction(data.transactions[i])
    if (result.ok) {
      validTransactions.push(result.tx)
    } else {
      skippedTransactions.push({ index: i, reason: result.reason })
    }
  }

  const validBudgets = data.budgets.filter(isValidBudget)

  return {
    data: { transactions: validTransactions, budgets: validBudgets },
    skippedTransactions,
    skippedBudgets: data.budgets.length - validBudgets.length,
  }
}
