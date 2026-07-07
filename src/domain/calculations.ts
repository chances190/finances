import c from 'currency.js'
import { DAYS_IN_MONTH, SES_ALPHA } from './constants'
import type { Budget, Transaction } from './entities'

export function generateInstallments(
  tx: Omit<Transaction, 'id'>,
  total: number,
  groupId: string,
): Array<Omit<Transaction, 'id'>> {
  const perInstallment = c(tx.amount || 0).divide(total).value
  const result: Array<Omit<Transaction, 'id'>> = []

  for (let i = 1; i <= total; i++) {
    result.push({
      ...tx,
      referenceMonth: i === 1 ? tx.referenceMonth : addMonths(tx.referenceMonth, i - 1),
      description: `${tx.description} - ${i}/${total}`,
      amount: i === total ? (tx.amount || 0) - perInstallment * (total - 1) : perInstallment,
      type: 'EXPENSE',
      installment: { current: i, total },
      groupId,
      parentId: groupId,
      isDebt: false,
      isSettled: false,
    })
  }

  return result
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const total = y * 12 + m - 1 + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return ay * 12 + am - (by * 12 + bm)
}

export function parseDate(d: string): number {
  return new Date(`${d}T12:00:00Z`).getTime()
}

export function daysSince(date: string): number {
  return Math.floor((Date.now() - parseDate(date)) / 86400000)
}

export function availableMonths(tx: Transaction[]): string[] {
  return Array.from(new Set(tx.map((t) => t.referenceMonth)))
    .sort()
    .reverse()
}

function currentYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthRelation(ym: string): 'past' | 'current' | 'future' {
  const diff = monthDiff(currentYM(), ym)
  if (diff > 0) return 'past'
  if (diff < 0) return 'future'
  return 'current'
}

export function yearRelation(y: string): 'past' | 'current' | 'future' {
  const cy = String(new Date().getFullYear())
  if (y < cy) return 'past'
  if (y > cy) return 'future'
  return 'current'
}

export function byMonth(tx: Transaction[], refMonth: string): Transaction[] {
  return tx.filter(
    (t) => t.referenceMonth === refMonth && !t.isSettled && t.type === 'EXPENSE' && !t.isDebt,
  )
}

export function incomeByMonth(tx: Transaction[], refMonth: string): Transaction[] {
  return tx.filter((t) => t.referenceMonth === refMonth && !t.isSettled && t.type === 'INCOME')
}

export function totalByMonth(tx: Transaction[], refMonth: string): number {
  return incomeByMonth(tx, refMonth).reduce((s, t) => s + t.amount, 0)
}

export function incomeByPaymentMethod(tx: Transaction[], refMonth: string): Record<string, number> {
  return incomeByMonth(tx, refMonth).reduce<Record<string, number>>((acc, t) => {
    acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + t.amount
    return acc
  }, {})
}

export function expensesByMonth(tx: Transaction[], refMonth: string): number {
  return byMonth(tx, refMonth).reduce((s, t) => s + t.amount, 0)
}

export function balance(tx: Transaction[], refMonth: string): number {
  return totalByMonth(tx, refMonth) - expensesByMonth(tx, refMonth)
}

export function byCategory(tx: Transaction[], refMonth: string): Record<string, number> {
  return byMonth(tx, refMonth).reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount
    return acc
  }, {})
}

export function groupedByPaymentMethod(
  tx: Transaction[],
  refMonth: string,
): Record<string, number> {
  return byMonth(tx, refMonth).reduce<Record<string, number>>((acc, t) => {
    acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + t.amount
    return acc
  }, {})
}

export function cashExpenses(tx: Transaction[], refMonth: string): number {
  return byMonth(tx, refMonth)
    .filter((t) => t.paymentMethod !== 'MEAL_VOUCHER' && t.paymentMethod !== 'CREDIT')
    .reduce((s, t) => s + t.amount, 0)
}

export function mealVoucherIncome(tx: Transaction[], refMonth: string): number {
  return incomeByMonth(tx, refMonth)
    .filter((t) => t.paymentMethod === 'MEAL_VOUCHER')
    .reduce((s, t) => s + t.amount, 0)
}

export function mealVoucherExpenses(tx: Transaction[], refMonth: string): number {
  return byMonth(tx, refMonth)
    .filter((t) => t.paymentMethod === 'MEAL_VOUCHER')
    .reduce((s, t) => s + t.amount, 0)
}

export function mealVoucherBalance(tx: Transaction[], refMonth: string): number {
  return mealVoucherIncome(tx, refMonth) - mealVoucherExpenses(tx, refMonth)
}

export function creditInvoice(tx: Transaction[], refMonth: string): number {
  return byMonth(tx, refMonth)
    .filter((t) => t.paymentMethod === 'CREDIT')
    .reduce((s, t) => s + t.amount, 0)
}

export function activeDebts(tx: Transaction[]): Transaction[] {
  return tx.filter((t) => t.isDebt && !t.isSettled)
}

export function outstandingDebt(tx: Transaction[]): number {
  return activeDebts(tx).reduce((s, t) => s + t.amount, 0)
}

export function ses(expenses: number[]): number[] {
  if (expenses.length === 0) return []
  const result: number[] = [expenses[0]]
  for (let i = 1; i < expenses.length; i++) {
    result.push(SES_ALPHA * expenses[i] + (1 - SES_ALPHA) * result[i - 1])
  }
  return result
}

export interface SpendingPaceResult {
  daily: {
    day: number
    reference: number
    actual: number
    sesProjection: number | null
    suggestion: number | null
  }[]
  cumulative: {
    day: number
    reference: number
    actual: number
    sesProjection: number | null
    suggestion: number | null
  }[]
  suggestionPerDay: number
  limit: number
  totalSalary: number
}

export function spendingPace(
  tx: Transaction[],
  budget: Budget | undefined,
  currentDay: number,
): SpendingPaceResult {
  const totalSalary = (budget?.plannedIncome ?? 0) + (budget?.plannedMealVoucher ?? 0)
  const limit = totalSalary * 0.8
  const referencePerDay = totalSalary / DAYS_IN_MONTH

  const dailyActual: number[] = []
  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    dailyActual.push(
      byMonth(tx, budget?.referenceMonth ?? '')
        .filter((t) => {
          const day = parseInt(t.date.split('-')[2], 10)
          return day === d
        })
        .reduce((s, t) => s + t.amount, 0),
    )
  }

  const sesResult = ses(dailyActual.slice(0, currentDay))
  const lastSes = sesResult.length > 0 ? sesResult[sesResult.length - 1] : 0

  const accumulatedSpent = dailyActual.slice(0, currentDay).reduce((s, v) => s + v, 0)
  const remainingDays = DAYS_IN_MONTH - currentDay
  const suggestionPerDay =
    remainingDays > 0 ? Math.max(0, (limit - accumulatedSpent) / remainingDays) : 0

  const daily: SpendingPaceResult['daily'] = []
  const cumulative: SpendingPaceResult['cumulative'] = []
  let cumActual = 0
  let cumProjection = accumulatedSpent
  let cumSuggestion = accumulatedSpent

  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    const idx = d - 1
    cumActual += dailyActual[idx]

    let sesProj: number | null = null
    let sugProj: number | null = null
    if (d <= currentDay) {
      sesProj = sesResult[idx] ?? null
      sugProj = null
    } else {
      sesProj = lastSes
      sugProj = suggestionPerDay
      cumProjection += lastSes
      cumSuggestion += suggestionPerDay
    }

    daily.push({
      day: d,
      reference: referencePerDay,
      actual: dailyActual[idx],
      sesProjection: sesProj,
      suggestion: sugProj,
    })

    cumulative.push({
      day: d,
      reference: referencePerDay * d,
      actual: cumActual,
      sesProjection: d > currentDay ? cumProjection : null,
      suggestion: d > currentDay ? cumSuggestion : null,
    })
  }

  return { daily, cumulative, suggestionPerDay, limit, totalSalary }
}

export function budgetVsActual(
  tx: Transaction[],
  budget: Budget | undefined,
): { category: string; budgeted: number; actual: number }[] {
  const refMonth = budget?.referenceMonth
  if (!refMonth || !budget) return []
  const actuals = byCategory(tx, refMonth)
  const categories = new Set([...Object.keys(budget.categoryLimits), ...Object.keys(actuals)])
  return Array.from(categories)
    .sort()
    .map((category) => ({
      category,
      budgeted: budget.categoryLimits[category] ?? 0,
      actual: actuals[category] ?? 0,
    }))
}

export interface FutureCommitment {
  referenceMonth: string
  total: number
  transactions: Transaction[]
}

export function futureCommitments(tx: Transaction[], months: number = 12): FutureCommitment[] {
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const commitments: Record<string, FutureCommitment> = {}
  for (let i = 0; i < months; i++) {
    const ym = addMonths(currentYM, i)
    commitments[ym] = { referenceMonth: ym, total: 0, transactions: [] }
  }

  const installmentChildren = tx.filter(
    (t) => t.parentId && !t.isSettled && t.paymentMethod === 'CREDIT',
  )

  for (const t of installmentChildren) {
    const diff = monthDiff(t.referenceMonth, currentYM)
    if (diff >= 0 && diff < months) {
      commitments[t.referenceMonth].total += t.amount
      commitments[t.referenceMonth].transactions.push(t)
    }
  }

  return Object.values(commitments).sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
}

export function categoryTimeSeries(
  tx: Transaction[],
  months: number = 6,
): { month: string; [category: string]: number | string }[] {
  const now = new Date()
  const allCategories = new Set<string>()
  const monthlyData: { month: string; [category: string]: number | string }[] = []

  for (let i = months - 1; i >= 0; i--) {
    const ym = addMonths(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, -i)
    const cats = byCategory(tx, ym)
    for (const cat of Object.keys(cats)) {
      allCategories.add(cat)
    }
    monthlyData.push({ month: ym, ...cats })
  }

  const result = monthlyData.map((entry) => {
    const filled: { month: string; [category: string]: number | string } = { month: entry.month }
    for (const cat of allCategories) {
      filled[cat] = (entry[cat] as number) || 0
    }
    return filled
  })

  return result
}

export function yearSummary(
  tx: Transaction[],
  year: number,
): {
  months: { referenceMonth: string; income: number; expenses: number; balance: number }[]
  totalIncome: number
  totalExpenses: number
  totalBalance: number
} {
  const months: { referenceMonth: string; income: number; expenses: number; balance: number }[] = []
  let totalIncome = 0,
    totalExpenses = 0

  for (let m = 1; m <= 12; m++) {
    const refMonth = `${year}-${String(m).padStart(2, '0')}`
    const inc = totalByMonth(tx, refMonth)
    const exp = expensesByMonth(tx, refMonth)
    totalIncome += inc
    totalExpenses += exp
    months.push({ referenceMonth: refMonth, income: inc, expenses: exp, balance: inc - exp })
  }

  return { months, totalIncome, totalExpenses, totalBalance: totalIncome - totalExpenses }
}

export function budgetVsActualYear(
  tx: Transaction[],
  budgets: Budget[],
  year: number,
): { category: string; budgeted: number; actual: number }[] {
  const yearBudgets = budgets.filter((b) => b.referenceMonth.startsWith(`${year}-`))

  const categoryTotals: Record<string, { budgeted: number; actual: number }> = {}
  for (let m = 1; m <= 12; m++) {
    const refMonth = `${year}-${String(m).padStart(2, '0')}`
    const budget = yearBudgets.find((b) => b.referenceMonth === refMonth)
    const actuals = byCategory(tx, refMonth)

    if (budget) {
      for (const [cat, val] of Object.entries(budget.categoryLimits)) {
        if (!categoryTotals[cat]) categoryTotals[cat] = { budgeted: 0, actual: 0 }
        categoryTotals[cat].budgeted += val
      }
    }

    for (const [cat, val] of Object.entries(actuals)) {
      if (!categoryTotals[cat]) categoryTotals[cat] = { budgeted: 0, actual: 0 }
      categoryTotals[cat].actual += val
    }
  }

  return Object.entries(categoryTotals)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.actual - a.actual)
}
