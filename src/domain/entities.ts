import type { Movement } from './ledger'

export interface Budget {
  referenceMonth: string
  plannedIncome: number
  plannedMealVoucher: number
  investmentRate: number
  categoryLimits: Record<string, number>
}

export interface FinanceData {
  movements: Movement[]
  budgets: Budget[]
}

export interface AuditEntry {
  id: string
  timestamp: number
  description: string
  snapshot: Pick<FinanceData, 'movements' | 'budgets'>
  forwardSnapshot?: Pick<FinanceData, 'movements' | 'budgets'>
  actionType: string
}
