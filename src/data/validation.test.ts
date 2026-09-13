import { describe, expect, test } from 'bun:test'
import { validateFinanceData, validateTransaction } from './validation'

describe('validateTransaction', () => {
  test('accepts valid expense', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Expense',
      date: '2026-07-01',
      description: 'Test',
      amount: 100,
      category: 'Food',
      paymentMethod: 'Debit',
    })
    expect(result.ok).toBe(true)
  })

  test('accepts valid income', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Income',
      date: '2026-07-01',
      description: 'Salary',
      amount: 5000,
      category: 'Salary',
      paymentMethod: 'Salary',
    })
    expect(result.ok).toBe(true)
  })

  test('rejects invalid type with reason', () => {
    const result = validateTransaction({
      id: '1',
      type: 'INVALID',
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Other',
      paymentMethod: 'Debit',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('invalid type')
      expect(result.reason).toContain('INVALID')
    }
  })

  test('rejects expense with income payment method', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Expense',
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Other',
      paymentMethod: 'Salary',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('invalid payment method')
      expect(result.reason).toContain('Salary')
    }
  })

  test('rejects income with expense payment method', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Income',
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Other',
      paymentMethod: 'Debit',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('invalid payment method')
      expect(result.reason).toContain('Debit')
    }
  })

  test('rejects income with installments', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Income',
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Other',
      paymentMethod: 'Salary',
      installments: 3,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('cannot have installments')
    }
  })

  test('rejects income with debts', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Income',
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Other',
      paymentMethod: 'Salary',
      debts: [{ name: 'Alice', amount: 50, settled: false }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('cannot have debts')
    }
  })

  test('rejects non-object', () => {
    expect(validateTransaction(null).ok).toBe(false)
    expect(validateTransaction('string').ok).toBe(false)
  })

  test('rejects missing fields', () => {
    expect(validateTransaction({ id: '1' }).ok).toBe(false)
    expect(validateTransaction({}).ok).toBe(false)
  })
})

describe('validateFinanceData', () => {
  test('returns valid data as-is', () => {
    const input = {
      transactions: [
        {
          id: '1',
          type: 'Expense',
          date: '2026-07-01',
          description: 'Test',
          amount: 100,
          category: 'Food',
          paymentMethod: 'Debit',
        },
      ],
      budgets: [],
    }
    const result = validateFinanceData(input)
    expect(result.data.transactions).toHaveLength(1)
    expect(result.data.budgets).toHaveLength(0)
    expect(result.skippedTransactions).toHaveLength(0)
    expect(result.skippedBudgets).toBe(0)
  })

  test('strips invalid transactions with reasons', () => {
    const input = {
      transactions: [
        {
          id: '1',
          type: 'INVALID',
          date: '2026-07-01',
          description: 'Bad',
          amount: 100,
          category: 'Other',
          paymentMethod: 'Debit',
        },
      ],
      budgets: [],
    }
    const result = validateFinanceData(input)
    expect(result.data.transactions).toHaveLength(0)
    expect(result.skippedTransactions).toHaveLength(1)
    expect(result.skippedTransactions[0].reason).toContain('invalid type')
  })

  test('throws for non-object input', () => {
    expect(() => validateFinanceData(null)).toThrow('Invalid data: expected an object')
    expect(() => validateFinanceData('string')).toThrow('Invalid data: expected an object')
  })

  test('throws for missing transactions array', () => {
    expect(() => validateFinanceData({ budgets: [] })).toThrow('transactions must be an array')
  })
})
