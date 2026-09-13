import { DEFAULT_CATEGORIES } from './constants'
import type { Budget, Transaction } from './entities'

export function getAllCategories(budgets: Budget[], transactions: Transaction[]): string[] {
  const defaults = DEFAULT_CATEGORIES as readonly string[]
  const custom = new Set<string>()
  for (const b of budgets) {
    for (const key of Object.keys(b.categoryLimits)) {
      if (!defaults.includes(key)) custom.add(key)
    }
  }
  for (const t of transactions) {
    if (t.type === 'Income') continue
    if (!defaults.includes(t.category)) custom.add(t.category)
  }
  return [...defaults, ...[...custom].sort()]
}
