import { budgetCategoryNames, budgetForMonth } from '@/domain/categories'
import { DEFAULT_INVESTMENT_RATE } from '@/domain/constants'
import type { Budget } from '@/domain/entities'
import { addMonths } from '@/domain/ledger'
import { formatPlainCurrency, parseCurrency } from '@/lib/currency'

export interface BudgetFormData {
  referenceMonth: string
  plannedIncome: string
  plannedMealVoucher: string
  investmentRate: string
  categoryLimits: Record<string, string>
  categoryIcons: Record<string, string>
}

export function formatPercent(rate: number): string {
  return String(Math.round(rate * 1000) / 10)
}

export function parsePercent(value: string): number {
  return Math.min(100, Math.max(0, parseCurrency(value))) / 100
}

export function emptyBudget(refMonth: string, budgets: Budget[]): BudgetFormData {
  const source = budgetForMonth(refMonth, budgets)
  const categoryLimits: Record<string, string> = {}
  const categoryIcons: Record<string, string> = {}
  if (source) {
    for (const name of budgetCategoryNames(source)) {
      categoryLimits[name] = ''
      const icon = source.categoryIcons?.[name]
      if (icon) categoryIcons[name] = icon
    }
  }
  return {
    referenceMonth: refMonth,
    plannedIncome: '',
    plannedMealVoucher: '',
    investmentRate: formatPercent(DEFAULT_INVESTMENT_RATE),
    categoryLimits,
    categoryIcons,
  }
}

export function toBudget(data: BudgetFormData): Budget {
  const limits: Record<string, number> = {}
  for (const [category, value] of Object.entries(data.categoryLimits)) {
    limits[category] = parseCurrency(value)
  }
  const icons: Record<string, string> = {}
  for (const [category, icon] of Object.entries(data.categoryIcons)) {
    if (category in limits && icon) icons[category] = icon
  }
  return {
    referenceMonth: data.referenceMonth,
    plannedIncome: parseCurrency(data.plannedIncome),
    plannedMealVoucher: parseCurrency(data.plannedMealVoucher),
    investmentRate: parsePercent(data.investmentRate),
    categoryLimits: limits,
    ...(Object.keys(icons).length > 0 ? { categoryIcons: icons } : {}),
  }
}

export function formFromBudget(budget: Budget): BudgetFormData {
  const limits: Record<string, string> = {}
  const categoryIcons: Record<string, string> = {}
  for (const [category, value] of Object.entries(budget.categoryLimits)) {
    limits[category] = value === 0 ? '' : formatPlainCurrency(value)
    const icon = budget.categoryIcons?.[category]
    if (icon) categoryIcons[category] = icon
  }
  return {
    referenceMonth: budget.referenceMonth,
    plannedIncome: formatPlainCurrency(budget.plannedIncome),
    plannedMealVoucher: formatPlainCurrency(budget.plannedMealVoucher),
    investmentRate: formatPercent(budget.investmentRate),
    categoryLimits: limits,
    categoryIcons,
  }
}

export function monthsBetween(start: string, end: string): string[] {
  const result: string[] = []
  let current = start
  while (current <= end) {
    result.push(current)
    current = addMonths(current, 1)
  }
  return result
}
