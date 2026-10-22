import { addCurrency } from '../lib/currency'
import { SAVINGS_RATE, SES_ALPHA } from './constants'
import type { Budget, ExpenseFlow, IncomeFlow, Transaction } from './entities'
import { addMonths, monthlyFlows } from './entities'

export { addMonths }

export type TransactionSortKey = 'paymentMethod' | 'amount' | 'description' | 'category' | 'date'

export function compareTransactions(
  a: Transaction,
  b: Transaction,
  key: TransactionSortKey,
  dir: 'asc' | 'desc',
): number {
  const cmp =
    key === 'amount'
      ? a.amount - b.amount
      : String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
  return dir === 'asc' ? cmp : -cmp
}

export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return ay * 12 + am - (by * 12 + bm)
}

export function daysSince(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const then = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today.getTime() - then.getTime()) / 86400000)
}

export function availableMonths(tx: Transaction[]): string[] {
  return Array.from(new Set(tx.flatMap((t) => monthlyFlows(t)).map((f) => f.referenceMonth)))
    .sort()
    .reverse()
}

export function currentYM(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return 30
  return new Date(y, m, 0).getDate()
}

export function localYMD(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

export function byMonth(tx: Transaction[], refMonth: string): ExpenseFlow[] {
  return tx
    .flatMap((t) => monthlyFlows(t))
    .filter((f): f is ExpenseFlow => f.referenceMonth === refMonth && f.type === 'Expense')
}

export function incomeByMonth(tx: Transaction[], refMonth: string): IncomeFlow[] {
  return tx
    .flatMap((t) => monthlyFlows(t))
    .filter((f): f is IncomeFlow => f.referenceMonth === refMonth && f.type === 'Income')
}

export function totalByMonth(tx: Transaction[], refMonth: string): number {
  return incomeByMonth(tx, refMonth).reduce((s, t) => addCurrency(s, t.amount), 0)
}

export function incomeByPaymentMethod(tx: Transaction[], refMonth: string): Record<string, number> {
  return incomeByMonth(tx, refMonth).reduce<Record<string, number>>((acc, t) => {
    acc[t.paymentMethod] = addCurrency(acc[t.paymentMethod] || 0, t.amount)
    return acc
  }, {})
}

export function expensesByMonth(tx: Transaction[], refMonth: string): number {
  return byMonth(tx, refMonth).reduce((s, t) => addCurrency(s, t.ownAmount), 0)
}

export function splitEvenlyAcrossParticipants(
  totalAmount: number,
  otherParticipantCount: number,
): number[] {
  const totalCents = Math.round(totalAmount * 100)
  const participantCount = otherParticipantCount + 1
  const baseCents = Math.floor(totalCents / participantCount)
  const remainderCents = totalCents % participantCount

  return Array.from(
    { length: otherParticipantCount },
    (_, index) => (baseCents + (index < remainderCents ? 1 : 0)) / 100,
  )
}

export function byCategory(tx: Transaction[], refMonth: string): Record<string, number> {
  return byMonth(tx, refMonth).reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = addCurrency(acc[t.category] || 0, t.ownAmount)
    return acc
  }, {})
}

export function groupedByPaymentMethod(
  tx: Transaction[],
  refMonth: string,
): Record<string, number> {
  return byMonth(tx, refMonth).reduce<Record<string, number>>((acc, t) => {
    acc[t.paymentMethod] = addCurrency(acc[t.paymentMethod] || 0, t.ownAmount)
    return acc
  }, {})
}

export function mealVoucherIncome(tx: Transaction[], refMonth: string): number {
  return incomeByMonth(tx, refMonth)
    .filter((t) => t.paymentMethod === 'Voucher')
    .reduce((s, t) => addCurrency(s, t.amount), 0)
}

export function mealVoucherExpenses(tx: Transaction[], refMonth: string): number {
  return byMonth(tx, refMonth)
    .filter((t) => t.paymentMethod === 'Meal Voucher')
    .reduce((s, t) => addCurrency(s, t.ownAmount), 0)
}

export function mealVoucherBalance(tx: Transaction[], refMonth: string): number {
  return mealVoucherIncome(tx, refMonth) - mealVoucherExpenses(tx, refMonth)
}

export function ses(expenses: number[]): number[] {
  if (expenses.length === 0) return []
  const result: number[] = [expenses[0]]
  for (let i = 1; i < expenses.length; i++) {
    result.push(SES_ALPHA * expenses[i] + (1 - SES_ALPHA) * result[i - 1])
  }
  return result
}

export type PaceStatus = 'on-track' | 'caution' | 'ahead' | 'over'

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
  spentSoFar: number
  remainingBudget: number
  status: PaceStatus
}

export function spendingPace(
  tx: Transaction[],
  budget: Budget | undefined,
  currentDay: number,
): SpendingPaceResult {
  const plannedIncome = budget?.plannedIncome ?? 0
  const plannedMealVoucher = budget?.plannedMealVoucher ?? 0
  const totalSalary = addCurrency(plannedIncome, plannedMealVoucher)
  const limit = addCurrency(plannedIncome * (1 - SAVINGS_RATE), plannedMealVoucher)
  const referenceMonth = budget?.referenceMonth ?? currentYM()
  const monthDays = daysInMonth(referenceMonth)

  const dailyActual = Array.from({ length: monthDays }, () => 0)
  if (budget) {
    for (const flow of byMonth(tx, referenceMonth)) {
      // An installment is a monthly obligation, not a purchase on its original day.
      const purchaseDay = Number(flow.date.slice(8, 10)) || 1
      const day = flow.installmentIndex != null ? 1 : Math.min(Math.max(purchaseDay, 1), monthDays)
      dailyActual[day - 1] = addCurrency(dailyActual[day - 1], flow.ownAmount)
    }
  }

  const spentSoFar = dailyActual.slice(0, currentDay).reduce((s, v) => addCurrency(s, v), 0)
  const committedAhead = dailyActual.slice(currentDay).reduce((s, v) => addCurrency(s, v), 0)
  const remainingDays = currentDay >= monthDays ? 0 : monthDays - currentDay + 1
  // Money already committed later this month is not available to spend.
  const remainingBudget = addCurrency(addCurrency(limit, -spentSoFar), -committedAhead)
  const spendable = Math.max(0, remainingBudget)
  const suggestionPerDay = remainingDays > 0 ? spendable / remainingDays : 0

  const sesResult = ses(dailyActual.slice(0, currentDay))
  const lastSes = sesResult.length > 0 ? sesResult[sesResult.length - 1] : 0

  const proRataBudget = monthDays > 0 ? (limit * currentDay) / monthDays : 0
  const status: PaceStatus =
    spentSoFar > limit
      ? 'over'
      : spentSoFar > proRataBudget * 1.2
        ? 'ahead'
        : spentSoFar > proRataBudget * 1.05
          ? 'caution'
          : 'on-track'

  const daily: SpendingPaceResult['daily'] = []
  const cumulative: SpendingPaceResult['cumulative'] = []
  const referencePerDay = limit / monthDays
  let cumActual = 0
  let cumProjection = spentSoFar
  let cumSuggestion = spentSoFar

  for (let d = 1; d <= monthDays; d++) {
    const idx = d - 1
    cumActual = addCurrency(cumActual, dailyActual[idx])

    let sesProj: number | null = sesResult[idx] ?? null
    let sugProj: number | null = null
    if (d > currentDay) {
      sesProj = lastSes
      cumProjection = addCurrency(cumProjection, lastSes)
    }
    if (d >= currentDay && remainingDays > 0) {
      sugProj = suggestionPerDay
      cumSuggestion = addCurrency(cumSuggestion, suggestionPerDay)
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
      suggestion: d >= currentDay && remainingDays > 0 ? cumSuggestion : null,
    })
  }

  return {
    daily,
    cumulative,
    suggestionPerDay,
    limit,
    totalSalary,
    spentSoFar,
    remainingBudget,
    status,
  }
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
    .filter(({ budgeted, actual }) => budgeted > 0 || actual > 0)
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

  for (const t of tx) {
    if (t.type !== 'Expense' || !t.installments || t.installments <= 1) continue
    const flows = monthlyFlows(t)
    for (const f of flows) {
      const diff = monthDiff(f.referenceMonth, currentYM)
      if (diff >= 0 && diff < months) {
        commitments[f.referenceMonth].total = addCurrency(
          commitments[f.referenceMonth].total,
          f.amount,
        )
        commitments[f.referenceMonth].transactions.push(t)
      }
    }
  }

  return Object.values(commitments).sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
}

export function categoryTimeSeries(
  tx: Transaction[],
  months: string[],
): { month: string; [category: string]: number | string }[] {
  const allCategories = new Set<string>()
  const monthlyData: { month: string; [category: string]: number | string }[] = []

  for (const ym of months) {
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
    totalIncome = addCurrency(totalIncome, inc)
    totalExpenses = addCurrency(totalExpenses, exp)
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
        categoryTotals[cat].budgeted = addCurrency(categoryTotals[cat].budgeted, val)
      }
    }

    for (const [cat, val] of Object.entries(actuals)) {
      if (!categoryTotals[cat]) categoryTotals[cat] = { budgeted: 0, actual: 0 }
      categoryTotals[cat].actual = addCurrency(categoryTotals[cat].actual, val)
    }
  }

  return Object.entries(categoryTotals)
    .map(([category, v]) => ({ category, ...v }))
    .filter(({ budgeted, actual }) => budgeted > 0 || actual > 0)
    .sort((a, b) => b.actual - a.actual)
}

export interface BudgetRange {
  startMonth: string
  endMonth: string
  months: string[]
  budget: Budget
}

function sameBudget(a: Budget, b: Budget): boolean {
  if (a.plannedIncome !== b.plannedIncome || a.plannedMealVoucher !== b.plannedMealVoucher) {
    return false
  }
  const aKeys = Object.keys(a.categoryLimits).sort()
  const bKeys = Object.keys(b.categoryLimits).sort()
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((k, i) => bKeys[i] === k && a.categoryLimits[k] === b.categoryLimits[k])
}

export function groupBudgetsByRange(budgets: Budget[]): BudgetRange[] {
  const sorted = [...budgets].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
  const ranges: BudgetRange[] = []
  for (const b of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && addMonths(last.endMonth, 1) === b.referenceMonth && sameBudget(last.budget, b)) {
      last.endMonth = b.referenceMonth
      last.months.push(b.referenceMonth)
    } else {
      ranges.push({
        startMonth: b.referenceMonth,
        endMonth: b.referenceMonth,
        months: [b.referenceMonth],
        budget: b,
      })
    }
  }
  return ranges
}
