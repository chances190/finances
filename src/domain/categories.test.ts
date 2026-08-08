import { describe, expect, test } from 'bun:test'
import { getAllCategories } from './categories'
import { DEFAULT_CATEGORIES } from './constants'
import type { Budget, Transaction } from './entities'

const baseTx: Transaction = {
  id: '1',
  type: 'EXPENSE',
  date: '2026-08-01',
  referenceMonth: '2026-08',
  description: 'x',
  amount: 10,
  category: 'Food',
  paymentMethod: 'DEBIT',
  isDebt: false,
  isSettled: false,
}

const budget = (categoryLimits: Record<string, number>): Budget => ({
  referenceMonth: '2026-08',
  plannedIncome: 0,
  plannedMealVoucher: 0,
  categoryLimits,
})

describe('getAllCategories', () => {
  test('returns defaults when no budgets or transactions', () => {
    expect(getAllCategories([], [])).toEqual([...DEFAULT_CATEGORIES])
  })
  test('includes custom budget categories', () => {
    const cats = getAllCategories([budget({ Pets: 100 })], [])
    expect(cats).toContain('Pets')
  })
  test('includes transaction categories not in defaults', () => {
    const cats = getAllCategories([], [{ ...baseTx, id: '2', category: 'Pets' }])
    expect(cats).toContain('Pets')
  })
  test('defaults come first, customs sorted alphabetically', () => {
    const cats = getAllCategories([budget({ Zebra: 1, Alpha: 2 })], [])
    expect(cats[0]).toBe('Food')
    expect(cats.indexOf('Alpha')).toBeLessThan(cats.indexOf('Zebra'))
  })
  test('does not duplicate default categories', () => {
    const cats = getAllCategories([budget({ Food: 10 })], [])
    expect(cats.filter((c) => c === 'Food')).toHaveLength(1)
  })
})
