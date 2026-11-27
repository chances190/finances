import { describe, expect, test } from 'bun:test'
import { allCategoryNames, budgetForMonth, categoryOptionsForMonth } from './categories'
import type { Budget } from './entities'
import { buildPurchase, type Movement } from './ledger'

function budget(referenceMonth: string, categoryLimits: Record<string, number>): Budget {
  return {
    referenceMonth,
    plannedIncome: 0,
    plannedMealVoucher: 0,
    investmentRate: 0,
    categoryLimits,
  }
}

function movement(category: string): Movement {
  const result = buildPurchase({
    id: `p-${category}`,
    date: '2026-11-01',
    description: 'x',
    amount: 10,
    category,
    account: 'checking',
  })
  if (!result.ok) throw new Error(result.reason)
  return result.value[0]
}

const budgets = [budget('2026-09', { Food: 500, Rent: 1500 }), budget('2026-10', { Food: 600 })]

describe('budgetForMonth', () => {
  test('uses the budget of the requested month', () => {
    expect(budgetForMonth('2026-09', budgets)?.referenceMonth).toBe('2026-09')
  })

  test('falls back to the latest budget when the month has none', () => {
    expect(budgetForMonth('2025-03', budgets)?.referenceMonth).toBe('2026-10')
    expect(budgetForMonth('2026-12', budgets)?.referenceMonth).toBe('2026-10')
  })

  test('returns null without budgets', () => {
    expect(budgetForMonth('2026-10', [])).toBeNull()
  })
})

describe('categoryOptionsForMonth', () => {
  test('offers exactly the categories of the month budget', () => {
    expect(categoryOptionsForMonth('2026-09', budgets)).toEqual(['Food', 'Rent'])
  })

  test('new events in the current month use the current budget', () => {
    expect(categoryOptionsForMonth('2026-10', budgets)).toEqual(['Food'])
  })

  test('with no budgets at all, offers no categories', () => {
    expect(categoryOptionsForMonth('2026-10', [])).toEqual([])
  })

  test('a budget with a zeroed category still exposes it', () => {
    expect(categoryOptionsForMonth('2026-10', [budget('2026-10', { Food: 0 })])).toEqual(['Food'])
  })
})

describe('allCategoryNames', () => {
  test('unions every budget with every posting category, sorted', () => {
    expect(
      allCategoryNames(
        [budget('2025-01', { Rent: 1 }), budget('2026-10', { Food: 1 })],
        [movement('Christmas gift')],
      ),
    ).toEqual(['Christmas gift', 'Food', 'Rent'])
  })

  test('keeps categories that no budget mentions', () => {
    expect(allCategoryNames([], [movement('Family')])).toEqual(['Family'])
  })
})
