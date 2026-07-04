export type TransactionType = 'INCOME' | 'EXPENSE'
export type PaymentMethod = 'CASH' | 'DEBIT' | 'CREDIT' | 'PIX' | 'MEAL_VOUCHER'

export interface InstallmentConfig {
  current: number
  total: number
}

export interface Transaction {
  id: string
  type: TransactionType
  date: string
  referenceMonth: string
  description: string
  amount: number
  category: string
  paymentMethod: PaymentMethod
  installment?: InstallmentConfig
  parentId?: string
  groupId?: string
  isDebt: boolean
  debtorName?: string
  isSettled: boolean
}

export interface Budget {
  referenceMonth: string
  plannedIncome: number
  plannedMealVoucher: number
  categoryLimits: Record<string, number>
}

export interface FinanceData {
  transactions: Transaction[]
  budgets: Budget[]
}