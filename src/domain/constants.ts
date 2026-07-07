import type { PaymentMethod } from './entities'

export const DAYS_IN_MONTH = 30
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
  'Salary',
  'Other',
] as const

export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'DEBIT', 'CREDIT', 'PIX', 'MEAL_VOUCHER']
export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  DEBIT: 'Debit',
  CREDIT: 'Credit',
  PIX: 'Pix',
  MEAL_VOUCHER: 'Meal Voucher',
}

export const PAYMENT_METHOD_BADGE_COLORS: Record<string, string> = {
  CREDIT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  DEBIT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PIX: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CASH: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  MEAL_VOUCHER: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
}

export const PAYMENT_METHOD_CHART_COLORS: Record<string, string> = {
  CASH: '#3b82f6',
  DEBIT: '#22c55e',
  CREDIT: '#ef4444',
  PIX: '#06b6d4',
  MEAL_VOUCHER: '#a855f7',
}
