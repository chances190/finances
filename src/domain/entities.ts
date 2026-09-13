export type TransactionType = 'Income' | 'Expense'
export type PaymentMethod = 'Debit' | 'Credit' | 'Meal Voucher' | 'Salary' | 'Transfer' | 'Voucher'

export interface Debt {
  name: string
  amount: number
  settled: boolean
}

export interface Transaction {
  id: string
  type: TransactionType
  date: string
  description: string
  amount: number
  category: string
  paymentMethod: PaymentMethod
  installments?: number
  debts?: Debt[]
}

export interface MonthlyFlow {
  id: string
  type: TransactionType
  date: string
  description: string
  amount: number
  category: string
  paymentMethod: PaymentMethod
  referenceMonth: string
  installmentIndex?: number
  installmentTotal?: number
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

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const total = y * 12 + m - 1 + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

function dateToYM(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function monthlyFlows(tx: Transaction): MonthlyFlow[] {
  const ym = dateToYM(tx.date)

  if (tx.type === 'Income' || !tx.installments || tx.installments <= 1) {
    return [
      {
        id: tx.id,
        type: tx.type,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category,
        paymentMethod: tx.paymentMethod,
        referenceMonth: ym,
      },
    ]
  }

  const n = tx.installments
  const base = Math.floor(tx.amount / n)
  const remainder = tx.amount - base * n

  return Array.from({ length: n }, (_, i) => ({
    id: tx.id,
    type: tx.type,
    date: tx.date,
    description: tx.description,
    amount: i === 0 ? base + remainder : base,
    category: tx.category,
    paymentMethod: tx.paymentMethod,
    referenceMonth: addMonths(ym, i),
    installmentIndex: i,
    installmentTotal: n,
  }))
}
