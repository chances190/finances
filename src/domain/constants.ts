import type { ExpensePaymentMethod, IncomePaymentMethod, PaymentMethod } from './entities'

export const SES_ALPHA = 0.3

export const SAVINGS_RATE = 0.2

export const EXPENSE_PAYMENT_METHODS: readonly ExpensePaymentMethod[] = [
  'Debit',
  'Credit',
  'Meal Voucher',
]
export const INCOME_PAYMENT_METHODS: readonly IncomePaymentMethod[] = [
  'Salary',
  'Transfer',
  'Voucher',
]

export function isExpensePaymentMethod(method: PaymentMethod): method is ExpensePaymentMethod {
  return (EXPENSE_PAYMENT_METHODS as readonly PaymentMethod[]).includes(method)
}

export function isIncomePaymentMethod(method: PaymentMethod): method is IncomePaymentMethod {
  return (INCOME_PAYMENT_METHODS as readonly PaymentMethod[]).includes(method)
}
export const TRANSACTION_TYPES = ['Income', 'Expense'] as const

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Debit: 'Debit/PIX',
  Credit: 'Credit',
  'Meal Voucher': 'Voucher',
  Salary: 'Salary',
  Transfer: 'Transfer',
  Voucher: 'Voucher income',
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method
}

export const PAYMENT_METHOD_BADGE_COLORS: Record<PaymentMethod, string> = {
  Credit: 'bg-purple-100 text-purple-800',
  Debit: 'bg-teal-100 text-teal-800',
  'Meal Voucher': 'bg-pink-100 text-pink-800',
  Salary: 'bg-yellow-100 text-yellow-800',
  Transfer: 'bg-sky-100 text-sky-800',
  Voucher: 'bg-orange-100 text-orange-800',
}

export const PAYMENT_METHOD_CHART_COLORS: Record<PaymentMethod, string> = {
  Debit: '#32BCAD',
  Credit: '#820AD1',
  'Meal Voucher': '#FF2D6F',
  Salary: '#eab308',
  Transfer: '#0ea5e9',
  Voucher: '#f97316',
}

export const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  primary: '#3b82f6',
  warning: '#f59e0b',
  projection: '#f97316',
  suggestion: '#8b5cf6',
  balance: '#3b82f6',
  budgeted: '#3b82f6',
  actual: '#f59e0b',
}

export const CATEGORY_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#d946ef',
]
