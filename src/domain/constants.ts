import type { PaymentMethod } from './entities'

export const SES_ALPHA = 0.3

export const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Rent',
  'Leisure',
  'Utilities',
  'Health',
  'Education',
  'Shopping',
  'Other',
] as const

export const PAYMENT_METHODS: PaymentMethod[] = ['Debit', 'Credit', 'Meal Voucher']
export const INCOME_PAYMENT_METHODS: PaymentMethod[] = ['Salary', 'Transfer', 'Voucher']
export const TRANSACTION_TYPES = ['Income', 'Expense'] as const

export const PAYMENT_METHOD_BADGE_COLORS: Record<string, string> = {
  Credit: 'bg-amber-100 text-amber-800  ',
  Debit: 'bg-blue-100 text-blue-800  ',
  'Meal Voucher': 'bg-teal-100 text-teal-800  ',
  Salary: 'bg-emerald-100 text-emerald-800  ',
  Transfer: 'bg-sky-100 text-sky-800  ',
  Voucher: 'bg-orange-100 text-orange-800  ',
}

export const PAYMENT_METHOD_CHART_COLORS: Record<string, string> = {
  Debit: '#22c55e',
  Credit: '#ef4444',
  'Meal Voucher': '#a855f7',
  Salary: '#10b981',
  Transfer: '#0ea5e9',
  Voucher: '#f97316',
}

export const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  primary: '#3b82f6',
  warning: '#f59e0b',
  projection: '#f97316',
  suggestion: '#22c55e',
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
