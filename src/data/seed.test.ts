import { describe, expect, test } from 'bun:test'
import { generateSeed } from './seed'

describe('generateSeed', () => {
  test('returns data for given date', () => {
    const data = generateSeed(new Date('2026-07-01'))
    expect(data.transactions.length).toBeGreaterThan(0)
    expect(data.budgets.length).toBeGreaterThan(0)
  })

  test('transactions all have ids', () => {
    const data = generateSeed(new Date('2026-07-01'))
    for (const tx of data.transactions) {
      expect(tx.id).toBeTruthy()
    }
  })

  test('budget reference months match', () => {
    const data = generateSeed(new Date('2026-07-01'))
    expect(data.budgets[0].referenceMonth).toBe('2026-07')
  })

  test('defaults to 2026-07-01', () => {
    const data = generateSeed()
    expect(data.budgets[0].referenceMonth).toBe('2026-07')
  })
})
