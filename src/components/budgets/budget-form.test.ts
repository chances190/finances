import { describe, expect, test } from 'bun:test'
import type { Budget } from '@/domain/entities'
import { emptyBudget, formFromBudget, toBudget } from './budget-form'

const budget: Budget = {
  referenceMonth: '2026-11',
  plannedIncome: 1000,
  plannedMealVoucher: 200,
  investmentRate: 0.1,
  categoryLimits: { Food: 500, Transport: 100 },
  categoryIcons: { Food: 'food' },
}

describe('budget form', () => {
  test('round-trips category icons', () => {
    const result = toBudget(formFromBudget(budget))
    expect(result.categoryIcons).toEqual({ Food: 'food' })
  })

  test('drops icons for categories that no longer exist', () => {
    const form = formFromBudget(budget)
    form.categoryLimits = { Food: form.categoryLimits.Food }
    expect(toBudget(form).categoryIcons).toEqual({ Food: 'food' })
  })

  test('copies icons when seeding a new month', () => {
    const seeded = emptyBudget('2026-12', [budget])
    expect(seeded.categoryIcons).toEqual({ Food: 'food' })
    expect(seeded.categoryLimits).toEqual({ Food: '', Transport: '' })
  })
})
