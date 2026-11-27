import { DEFAULT_INVESTMENT_RATE } from '../domain/constants'
import type { Budget } from '../domain/entities'

// Legacy snapshot shape, kept only to read old localStorage/JSON/Drive data.
export const LEGACY_TRANSACTION_TYPES = ['Income', 'Expense'] as const
export type LegacyTransactionType = (typeof LEGACY_TRANSACTION_TYPES)[number]

export const LEGACY_EXPENSE_PAYMENT_METHODS = ['Debit/PIX', 'Credit', 'Voucher Debit'] as const
export const LEGACY_INCOME_PAYMENT_METHODS = ['Salary', 'Transfer', 'Voucher'] as const
export type LegacyExpensePaymentMethod = (typeof LEGACY_EXPENSE_PAYMENT_METHODS)[number]
export type LegacyIncomePaymentMethod = (typeof LEGACY_INCOME_PAYMENT_METHODS)[number]
export type LegacyPaymentMethod = LegacyExpensePaymentMethod | LegacyIncomePaymentMethod

export interface LegacyDebt {
  name: string
  amount: number
  settled: boolean
}

interface LegacyTransactionBase {
  id: string
  date: string
  description: string
  amount: number
  category: string
  importId?: string
}

export interface LegacyIncomeTransaction extends LegacyTransactionBase {
  type: 'Income'
  paymentMethod: LegacyIncomePaymentMethod
}

export interface LegacyExpenseTransaction extends LegacyTransactionBase {
  type: 'Expense'
  paymentMethod: LegacyExpensePaymentMethod
  installments?: number
  debts?: LegacyDebt[]
}

export type LegacyTransaction = LegacyIncomeTransaction | LegacyExpenseTransaction

export interface LegacyFinanceData {
  transactions: LegacyTransaction[]
  budgets: Budget[]
}

export type SkipReason = string

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function isYearMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return false
  const month = Number(match[2])
  return month >= 1 && month <= 12
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function canonicalType(value: unknown): LegacyTransactionType | null {
  if (typeof value !== 'string') return null
  const needle = value.trim().toLowerCase()
  return LEGACY_TRANSACTION_TYPES.find((type) => type.toLowerCase() === needle) ?? null
}

function canonicalMethod<T extends LegacyPaymentMethod>(
  value: unknown,
  methods: readonly T[],
): T | null {
  if (typeof value !== 'string') return null
  const needle = value.trim().toLowerCase()
  return methods.find((method) => method.toLowerCase() === needle) ?? null
}

export function validateTransaction(
  value: unknown,
): { ok: true; tx: LegacyTransaction } | { ok: false; reason: SkipReason } {
  if (!value || typeof value !== 'object') return { ok: false, reason: 'not an object' }
  const t = value as Record<string, unknown>

  if (typeof t.id !== 'string' || t.id === '') return { ok: false, reason: 'missing or invalid id' }
  if (typeof t.date !== 'string' || !isIsoDate(t.date)) {
    return { ok: false, reason: 'date must be a valid YYYY-MM-DD date' }
  }
  if (typeof t.description !== 'string' || t.description.trim() === '') {
    return { ok: false, reason: 'description must be a non-empty string' }
  }
  if (!isNonNegativeFinite(t.amount) || t.amount === 0) {
    return { ok: false, reason: 'amount must be a positive number' }
  }
  if (typeof t.category !== 'string' || t.category.trim() === '') {
    return { ok: false, reason: 'category must be a non-empty string' }
  }
  if (t.importId != null && typeof t.importId !== 'string') {
    return { ok: false, reason: 'importId must be a string' }
  }

  const type = canonicalType(t.type)
  if (type === null) {
    return {
      ok: false,
      reason: `invalid type: "${t.type}" (expected: ${LEGACY_TRANSACTION_TYPES.join(', ')})`,
    }
  }

  let paymentMethod: LegacyPaymentMethod
  if (type === 'Income') {
    const method = canonicalMethod(t.paymentMethod, LEGACY_INCOME_PAYMENT_METHODS)
    if (method === null) {
      return {
        ok: false,
        reason: `invalid payment method: "${t.paymentMethod}" for Income (expected: ${LEGACY_INCOME_PAYMENT_METHODS.join(', ')})`,
      }
    }
    paymentMethod = method
    if (t.installments != null) {
      return { ok: false, reason: 'Income transaction cannot have installments' }
    }
    if (t.debts != null) return { ok: false, reason: 'Income transaction cannot have debts' }
  } else {
    const method = canonicalMethod(t.paymentMethod, LEGACY_EXPENSE_PAYMENT_METHODS)
    if (method === null) {
      return {
        ok: false,
        reason: `invalid payment method: "${t.paymentMethod}" for Expense (expected: ${LEGACY_EXPENSE_PAYMENT_METHODS.join(', ')})`,
      }
    }
    paymentMethod = method
  }

  if (t.debts != null) {
    if (!Array.isArray(t.debts)) return { ok: false, reason: 'debts must be an array' }
    let debtCents = 0
    for (const entry of t.debts) {
      if (!entry || typeof entry !== 'object') return { ok: false, reason: 'invalid debt entry' }
      const debt = entry as Record<string, unknown>
      if (typeof debt.name !== 'string' || debt.name.trim() === '') {
        return { ok: false, reason: 'debt.name must be a non-empty string' }
      }
      if (!isNonNegativeFinite(debt.amount)) {
        return { ok: false, reason: 'debt.amount must be a non-negative number' }
      }
      if (typeof debt.settled !== 'boolean') {
        return { ok: false, reason: 'debt.settled must be a boolean' }
      }
      debtCents += Math.round(debt.amount * 100)
    }
    if (debtCents > Math.round((t.amount as number) * 100)) {
      return { ok: false, reason: 'total debts cannot exceed the transaction amount' }
    }
  }

  if (t.installments != null) {
    if (t.paymentMethod !== 'Credit') {
      return { ok: false, reason: 'installments require the Credit payment method' }
    }
    if (
      typeof t.installments !== 'number' ||
      !Number.isInteger(t.installments) ||
      t.installments < 1
    ) {
      return { ok: false, reason: 'installments must be a positive integer' }
    }
  }

  return {
    ok: true,
    tx: {
      ...(t as Record<string, unknown>),
      type,
      paymentMethod,
      description: (t.description as string).trim(),
      category: (t.category as string).trim(),
    } as LegacyTransaction,
  }
}

export function parseBudget(value: unknown): Budget | null {
  if (!value || typeof value !== 'object') return null
  const b = value as Record<string, unknown>
  if (typeof b.referenceMonth !== 'string' || !isYearMonth(b.referenceMonth)) return null
  if (!isNonNegativeFinite(b.plannedIncome) || !isNonNegativeFinite(b.plannedMealVoucher)) {
    return null
  }
  if (!b.categoryLimits || typeof b.categoryLimits !== 'object' || Array.isArray(b.categoryLimits))
    return null
  const validLimits = Object.entries(b.categoryLimits).every(
    ([category, limit]) => category.trim() !== '' && isNonNegativeFinite(limit),
  )
  if (!validLimits) return null
  const limits = b.categoryLimits as Record<string, number>

  let categoryIcons: Record<string, string> | undefined
  if (b.categoryIcons != null) {
    if (typeof b.categoryIcons !== 'object' || Array.isArray(b.categoryIcons)) return null
    const entries = Object.entries(b.categoryIcons)
    const validIcons = entries.every(
      ([category, icon]) =>
        category.trim() !== '' && typeof icon === 'string' && icon.trim() !== '',
    )
    if (!validIcons) return null
    const filtered = entries.filter(([category]) => category in limits)
    if (filtered.length > 0) categoryIcons = Object.fromEntries(filtered)
  }

  const rate = b.investmentRate
  if (rate != null && (!isNonNegativeFinite(rate) || rate > 1)) return null

  return {
    referenceMonth: b.referenceMonth,
    plannedIncome: b.plannedIncome,
    plannedMealVoucher: b.plannedMealVoucher,
    investmentRate: rate == null ? DEFAULT_INVESTMENT_RATE : rate,
    categoryLimits: limits,
    ...(categoryIcons ? { categoryIcons } : {}),
  }
}

export interface SkippedEntry {
  index: number
  reason: SkipReason
}

export interface ValidationResult {
  data: LegacyFinanceData
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

  const validTransactions: LegacyTransaction[] = []
  const skippedTransactions: SkippedEntry[] = []

  for (let index = 0; index < data.transactions.length; index++) {
    const result = validateTransaction(data.transactions[index])
    if (result.ok) validTransactions.push(result.tx)
    else skippedTransactions.push({ index, reason: result.reason })
  }

  const validBudgets: Budget[] = []
  let skippedBudgets = 0
  for (const entry of data.budgets) {
    const budget = parseBudget(entry)
    if (budget) validBudgets.push(budget)
    else skippedBudgets += 1
  }

  return {
    data: { transactions: validTransactions, budgets: validBudgets },
    skippedTransactions,
    skippedBudgets,
  }
}
