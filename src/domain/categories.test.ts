import { describe, expect, test } from 'bun:test'
import { allCategoryNames, budgetForMonth, categoryOptionsForMonth, monthOf } from './categories'
import type { Budget, ExpenseTransaction } from './entities'

function budget(referenceMonth: string, categoryLimits: Record<string, number>): Budget {
  return { referenceMonth, plannedIncome: 0, plannedMealVoucher: 0, categoryLimits }
}

function tx(overrides: Partial<Omit<ExpenseTransaction, 'type'>> = {}): ExpenseTransaction {
  return {
    id: '1',
    type: 'Expense',
    date: '2025-07-04',
    description: 'x',
    amount: 10,
    category: 'Family',
    paymentMethod: 'Debit',
    ...overrides,
  }
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
    expect(categoryOptionsForMonth('2026-09', budgets, [])).toEqual(['Food', 'Rent'])
  })

  test('falls back to every known category when the month has none', () => {
    expect(categoryOptionsForMonth('2025-03', budgets, [])).toEqual(['Food', 'Rent'])
  })

  test('new events in the current month use the current budget', () => {
    expect(categoryOptionsForMonth('2026-10', budgets, [tx()])).toEqual(['Food'])
  })

  test('with no budgets at all, offers categories already present in the data', () => {
    expect(
      categoryOptionsForMonth('2026-10', [], [tx(), tx({ id: '2', category: 'Pets' })]),
    ).toEqual(['Family', 'Pets'])
  })

  test('a budget with a zeroed category still exposes it', () => {
    expect(categoryOptionsForMonth('2026-10', [budget('2026-10', { Food: 0 })], [])).toEqual([
      'Food',
    ])
  })
})

describe('allCategoryNames', () => {
  test('unions every budget with every expense category, sorted', () => {
    expect(
      allCategoryNames(
        [budget('2025-01', { Rent: 1 }), budget('2026-10', { Food: 1 })],
        [tx({ category: 'Christmas gift' })],
      ),
    ).toEqual(['Christmas gift', 'Food', 'Rent'])
  })

  test('keeps categories that no budget mentions', () => {
    expect(allCategoryNames([], [tx({ category: 'Family' })])).toEqual(['Family'])
  })
})

describe('monthOf', () => {
  test('extracts the reference month', () => {
    expect(monthOf('2026-10-21')).toBe('2026-10')
  })
})
