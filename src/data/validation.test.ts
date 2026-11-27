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
      paymentMethod: 'Debit/PIX',
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

  test('canonicalizes type and payment method casing at the boundary', () => {
    const result = validateTransaction({
      id: '1',
      type: 'EXPENSE',
      date: '2026-07-01',
      description: '  Test  ',
      amount: 100,
      category: '  Food  ',
      paymentMethod: 'debit/pix',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.tx).toMatchObject({
        type: 'Expense',
        paymentMethod: 'Debit/PIX',
        description: 'Test',
        category: 'Food',
      })
    }
  })

  test('accepts the canonical voucher debit method', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Expense',
      date: '2026-07-01',
      description: 'Lunch',
      amount: 20,
      category: 'Food',
      paymentMethod: 'Voucher Debit',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.tx.paymentMethod).toBe('Voucher Debit')
  })

  test('rejects invalid type with reason', () => {
    const result = validateTransaction({
      id: '1',
      type: 'INVALID',
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Other',
      paymentMethod: 'Debit/PIX',
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
      paymentMethod: 'Debit/PIX',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('invalid payment method')
      expect(result.reason).toContain('Debit/PIX')
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

  test('rejects negative amount', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Expense',
      date: '2026-07-01',
      description: 'Bad',
      amount: -100,
      category: 'Food',
      paymentMethod: 'Debit/PIX',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('positive')
    }
  })

  test('rejects NaN amount', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Expense',
      date: '2026-07-01',
      description: 'Bad',
      amount: Number.NaN,
      category: 'Food',
      paymentMethod: 'Debit/PIX',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('positive')
    }
  })

  test('rejects malformed debts', () => {
    const base = {
      id: '1',
      type: 'Expense' as const,
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Food',
      paymentMethod: 'Debit/PIX' as const,
    }

    const notAnArray = validateTransaction({ ...base, debts: 'string' })
    const nullEntry = validateTransaction({ ...base, debts: [null] })
    const missingName = validateTransaction({ ...base, debts: [{ amount: 50, settled: false }] })

    expect(notAnArray.ok).toBe(false)
    expect(nullEntry.ok).toBe(false)
    expect(missingName.ok).toBe(false)
  })

  test('rejects invalid installments', () => {
    const base = {
      id: '1',
      type: 'Expense' as const,
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Food',
      paymentMethod: 'Credit' as const,
    }

    const fractional = validateTransaction({ ...base, installments: 2.5 })
    const notANumber = validateTransaction({ ...base, installments: 'abc' })

    expect(fractional.ok).toBe(false)
    expect(notANumber.ok).toBe(false)
  })

  test('rejects installments on a non-credit expense', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Expense',
      date: '2026-07-01',
      description: 'TV',
      amount: 1200,
      category: 'Shopping',
      paymentMethod: 'Debit/PIX',
      installments: 3,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Credit')
  })

  test('rejects a non-positive amount', () => {
    const base = {
      id: '1',
      type: 'Expense' as const,
      date: '2026-07-01',
      description: 'Bad',
      amount: 0,
      category: 'Food',
      paymentMethod: 'Debit/PIX' as const,
    }

    expect(validateTransaction(base).ok).toBe(false)
    expect(validateTransaction({ ...base, amount: -1 }).ok).toBe(false)
  })

  test('rejects malformed and impossible dates', () => {
    const base = {
      id: '1',
      type: 'Expense' as const,
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Food',
      paymentMethod: 'Debit/PIX' as const,
    }

    expect(validateTransaction({ ...base, date: '01/07/2026' }).ok).toBe(false)
    expect(validateTransaction({ ...base, date: '2026-02-30' }).ok).toBe(false)
  })

  test('rejects empty description and category', () => {
    const base = {
      id: '1',
      type: 'Expense' as const,
      date: '2026-07-01',
      description: 'Bad',
      amount: 100,
      category: 'Food',
      paymentMethod: 'Debit/PIX' as const,
    }

    expect(validateTransaction({ ...base, description: '  ' }).ok).toBe(false)
    expect(validateTransaction({ ...base, category: '' }).ok).toBe(false)
  })

  test('rejects debts that exceed the transaction amount', () => {
    const result = validateTransaction({
      id: '1',
      type: 'Expense',
      date: '2026-07-01',
      description: 'Dinner',
      amount: 100,
      category: 'Food',
      paymentMethod: 'Debit/PIX',
      debts: [{ name: 'Ana', amount: 160, settled: false }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('cannot exceed')
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
          paymentMethod: 'Debit/PIX',
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
          paymentMethod: 'Debit/PIX',
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

  test('skips budgets with an invalid month or values', () => {
    const result = validateFinanceData({
      transactions: [],
      budgets: [
        {
          referenceMonth: '2026-13',
          plannedIncome: 1000,
          plannedMealVoucher: 0,
          categoryLimits: {},
        },
        {
          referenceMonth: '2026-07',
          plannedIncome: 1000,
          plannedMealVoucher: 0,
          categoryLimits: { Food: -1 },
        },
        {
          referenceMonth: '2026-07',
          plannedIncome: 1000,
          plannedMealVoucher: 0,
          categoryLimits: { Food: 500 },
        },
      ],
    })

    expect(result.data.budgets).toHaveLength(1)
    expect(result.skippedBudgets).toBe(2)
  })

  test('keeps category icons that match category limits', () => {
    const result = validateFinanceData({
      transactions: [],
      budgets: [
        {
          referenceMonth: '2026-07',
          plannedIncome: 1000,
          plannedMealVoucher: 0,
          categoryLimits: { Food: 500 },
          categoryIcons: { Food: 'food', Ghost: 'tag' },
        },
      ],
    })

    expect(result.data.budgets[0].categoryIcons).toEqual({ Food: 'food' })
  })

  test('skips budgets with malformed category icons', () => {
    const result = validateFinanceData({
      transactions: [],
      budgets: [
        {
          referenceMonth: '2026-07',
          plannedIncome: 1000,
          plannedMealVoucher: 0,
          categoryLimits: { Food: 500 },
          categoryIcons: { Food: 42 },
        },
      ],
    })

    expect(result.data.budgets).toHaveLength(0)
    expect(result.skippedBudgets).toBe(1)
  })
})
