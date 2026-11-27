import type { Budget } from './entities'
import type { Movement } from './ledger'

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

export function categoryOptionsForMonth(month: string, budgets: Budget[]): string[] {
  const budget = budgetForMonth(month, budgets)
  return budget ? budgetCategoryNames(budget) : []
}

export function allCategoryNames(budgets: Budget[], movements: Movement[]): string[] {
  const names = new Set<string>()
  for (const budget of budgets) {
    for (const name of budgetCategoryNames(budget)) names.add(name)
  }
  for (const movement of movements) {
    for (const posting of movement.postings) {
      if (posting.category) names.add(posting.category)
    }
  }
  return [...names].sort()
}
