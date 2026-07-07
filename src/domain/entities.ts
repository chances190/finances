export type TransactionType = 'INCOME' | 'EXPENSE'
export type PaymentMethod = 'CASH' | 'DEBIT' | 'CREDIT' | 'PIX' | 'MEAL_VOUCHER'

export interface InstallmentConfig {
  current: number
  total: number
}

export interface DebtSplit {
  debtorName: string
  amount: number
  settled?: boolean
}

export interface DebtSplitUI {
  id: string
  name: string
  amount: number
}

export interface DebtConfig {
  userShare: number
  splits: DebtSplitUI[]
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
  debtSplits?: DebtSplit[]
  debtUserShare?: number
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

export interface AuditEntry {
  id: string
  timestamp: number
  description: string
  snapshot: { transactions: Transaction[]; budgets: Budget[] }
  forwardSnapshot?: { transactions: Transaction[]; budgets: Budget[] }
  actionType: string
}
