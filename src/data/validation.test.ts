import { describe, expect, test } from 'bun:test'
import { validateFinanceData } from './validation'

describe('validateFinanceData', () => {
  test('returns valid v2 data as-is', () => {
    const input = {
      _version: 2,
      transactions: [
        {
          id: '1',
          type: 'EXPENSE',
          date: '2026-07-01',
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

  test('rejects old v1 format', () => {
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
    expect(() => validateFinanceData(input)).toThrow('Incompatible data format')
  })

  test('strips invalid transactions', () => {
    const input = {
      _version: 2,
      transactions: [
        {
          id: '1',
          type: 'INVALID',
          date: '2026-07-01',
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

  test('strips expense transactions with income payment methods', () => {
    const input = {
      _version: 2,
      transactions: [
        {
          id: '1',
          type: 'EXPENSE',
          date: '2026-07-01',
          description: 'Bad',
          amount: 100,
          category: 'Other',
          paymentMethod: 'SALARY',
        },
      ],
      budgets: [],
    }
    const result = validateFinanceData(input)
    expect(result.transactions).toHaveLength(0)
  })

  test('accepts income transactions with income payment methods only', () => {
    const input = {
      _version: 2,
      transactions: [
        {
          id: '1',
          type: 'INCOME',
          date: '2026-07-01',
          description: 'Salary',
          amount: 5000,
          category: 'Other',
          paymentMethod: 'SALARY',
        },
        {
          id: '2',
          type: 'INCOME',
          date: '2026-07-01',
          description: 'Bad',
          amount: 100,
          category: 'Other',
          paymentMethod: 'DEBIT',
        },
      ],
      budgets: [],
    }
    const result = validateFinanceData(input)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].paymentMethod).toBe('SALARY')
  })

  test('throws for non-object input', () => {
    expect(() => validateFinanceData(null)).toThrow('Invalid data: expected an object')
    expect(() => validateFinanceData('string')).toThrow('Invalid data: expected an object')
  })

  test('throws for missing transactions array', () => {
    expect(() => validateFinanceData({ budgets: [] })).toThrow('transactions must be an array')
  })
})
