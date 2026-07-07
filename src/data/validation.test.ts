import { describe, expect, test } from 'bun:test'
import { validateFinanceData } from './validation'

describe('validateFinanceData', () => {
  test('returns valid data as-is', () => {
    const input = {
      transactions: [
        {
          id: '1',
          type: 'EXPENSE',
          date: '2026-07-01',
          referenceMonth: '2026-07',
          description: 'Test',
          amount: 100,
          category: 'Food',
          paymentMethod: 'DEBIT',
        },
      ],
      budgets: [],
    }
    const result = validateFinanceData(input)
    expect(result.transactions).toHaveLength(1)
    expect(result.budgets).toHaveLength(0)
  })

  test('strips invalid transactions', () => {
    const input = {
      transactions: [
        {
          id: '1',
          type: 'INVALID',
          date: '2026-07-01',
          referenceMonth: '2026-07',
          description: 'Bad',
          amount: 100,
          category: 'Other',
          paymentMethod: 'DEBIT',
        },
      ],
      budgets: [],
    }
    const result = validateFinanceData(input)
    expect(result.transactions).toHaveLength(0)
  })

  test('throws for non-object input', () => {
    expect(() => validateFinanceData(null)).toThrow('Invalid data: expected an object')
    expect(() => validateFinanceData('string')).toThrow('Invalid data: expected an object')
  })

  test('throws for missing transactions array', () => {
    expect(() => validateFinanceData({ budgets: [] })).toThrow('transactions must be an array')
  })
})
