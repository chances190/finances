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

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  DEBIT: 'Debit',
  CREDIT: 'Credit',
  PIX: 'Pix',
  MEAL_VOUCHER: 'Meal Voucher',
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
}
