import {
  activeDebts,
  balance,
  budgetVsActual,
  budgetVsActualYear,
  byCategory,
  cashExpenses,
  categoryTimeSeries,
  creditInvoice,
  expensesByMonth,
  futureCommitments,
  mealVoucherBalance,
  outstandingDebt,
  type SpendingPaceResult,
  spendingPace,
  totalByMonth,
  yearSummary,
} from '../domain/calculations'
import type { Budget, Transaction } from '../domain/entities'

export function useMonthSummary(transactions: Transaction[], refMonth: string) {
  return {
    income: totalByMonth(transactions, refMonth),
    expenses: expensesByMonth(transactions, refMonth),
    balance: balance(transactions, refMonth),
    byCategory: byCategory(transactions, refMonth),
    cashExpenses: cashExpenses(transactions, refMonth),
    mealVoucher: mealVoucherBalance(transactions, refMonth),
    creditInvoice: creditInvoice(transactions, refMonth),
  }
}

export function useSpendingPace(
  transactions: Transaction[],
  budget: Budget | undefined,
  currentDay: number,
): SpendingPaceResult {
  return spendingPace(transactions, budget, currentDay)
}

export function useBudgetVsActual(transactions: Transaction[], budget: Budget | undefined) {
  return budgetVsActual(transactions, budget)
}

export function useFutureCommitments(transactions: Transaction[], months = 12) {
  return futureCommitments(transactions, months)
}

export function useActiveDebts(transactions: Transaction[]) {
  return {
    debts: activeDebts(transactions),
    total: outstandingDebt(transactions),
  }
}

export function useCategoryTimeSeries(transactions: Transaction[], months = 6) {
  return categoryTimeSeries(transactions, months)
}

export function useYearSummary(transactions: Transaction[], year: number) {
  return yearSummary(transactions, year)
}

export function useYearBudgetVsActual(
  transactions: Transaction[],
  budgets: Budget[],
  year: number,
) {
  return budgetVsActualYear(transactions, budgets, year)
}
