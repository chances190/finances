export type TransactionType = 'Income' | 'Expense'

export type ExpensePaymentMethod = 'Debit' | 'Credit' | 'Meal Voucher'
export type IncomePaymentMethod = 'Salary' | 'Transfer' | 'Voucher'
export type PaymentMethod = ExpensePaymentMethod | IncomePaymentMethod

export interface Debt {
  name: string
  amount: number
  settled: boolean
}

interface TransactionBase {
  id: string
  date: string
  description: string
  amount: number
  category: string
  importId?: string
}

export interface IncomeTransaction extends TransactionBase {
  type: 'Income'
  paymentMethod: IncomePaymentMethod
}

export interface ExpenseTransaction extends TransactionBase {
  type: 'Expense'
  paymentMethod: ExpensePaymentMethod
  installments?: number
  debts?: Debt[]
}

export type Transaction = IncomeTransaction | ExpenseTransaction

interface FlowBase {
  id: string
  date: string
  description: string
  amount: number
  ownAmount: number
  category: string
  referenceMonth: string
  installmentIndex?: number
  installmentTotal?: number
}

export interface IncomeFlow extends FlowBase {
  type: 'Income'
  paymentMethod: IncomePaymentMethod
}

export interface ExpenseFlow extends FlowBase {
  type: 'Expense'
  paymentMethod: ExpensePaymentMethod
}

export type MonthlyFlow = IncomeFlow | ExpenseFlow

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
  snapshot: Pick<FinanceData, 'transactions' | 'budgets'>
  forwardSnapshot?: Pick<FinanceData, 'transactions' | 'budgets'>
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

function toCents(value: number): number {
  return Math.round(value * 100)
}

function owedCents(tx: ExpenseTransaction): number {
  const owed = (tx.debts ?? []).reduce((sum, debt) => sum + toCents(debt.amount), 0)
  return Math.min(owed, toCents(tx.amount))
}

export function monthlyFlows(tx: Transaction): MonthlyFlow[] {
  const ym = dateToYM(tx.date)

  if (tx.type === 'Income') {
    return [
      {
        id: tx.id,
        type: 'Income',
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        ownAmount: tx.amount,
        category: tx.category,
        paymentMethod: tx.paymentMethod,
        referenceMonth: ym,
      },
    ]
  }

  const owed = owedCents(tx)

  if (!tx.installments || tx.installments <= 1) {
    return [
      {
        id: tx.id,
        type: 'Expense',
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        ownAmount: (toCents(tx.amount) - owed) / 100,
        category: tx.category,
        paymentMethod: tx.paymentMethod,
        referenceMonth: ym,
      },
    ]
  }

  const n = tx.installments
  const base = Math.floor(tx.amount / n)
  const remainder = tx.amount - base * n
  const baseOwed = Math.floor(owed / n)
  const owedRemainder = owed - baseOwed * n

  return Array.from({ length: n }, (_, i) => {
    const amount = i === 0 ? base + remainder : base
    return {
      id: tx.id,
      type: 'Expense',
      date: tx.date,
      description: tx.description,
      amount,
      ownAmount: (toCents(amount) - (baseOwed + (i === 0 ? owedRemainder : 0))) / 100,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      referenceMonth: addMonths(ym, i),
      installmentIndex: i,
      installmentTotal: n,
    }
  })
}
