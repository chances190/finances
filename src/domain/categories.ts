import type { Budget, Transaction } from './entities'

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function budgetCategoryNames(budget: Budget): string[] {
  return Object.keys(budget.categoryLimits)
}

function latestBudget(budgets: Budget[]): Budget | null {
  let latest: Budget | null = null
  for (const budget of budgets) {
    if (latest === null || budget.referenceMonth > latest.referenceMonth) latest = budget
  }
  return latest
}

export function budgetForMonth(month: string, budgets: Budget[]): Budget | null {
  return budgets.find((budget) => budget.referenceMonth === month) ?? latestBudget(budgets)
}

export function categoryOptionsForMonth(
  month: string,
  budgets: Budget[],
  transactions: Transaction[],
): string[] {
  const budget = budgets.find((candidate) => candidate.referenceMonth === month)
  if (budget) return budgetCategoryNames(budget)
  return allCategoryNames(budgets, transactions)
}

export function allCategoryNames(budgets: Budget[], transactions: Transaction[]): string[] {
  const names = new Set<string>()
  for (const budget of budgets) {
    for (const name of budgetCategoryNames(budget)) names.add(name)
  }
  for (const t of transactions) {
    if (t.type === 'Expense') names.add(t.category)
  }
  return [...names].sort()
}
