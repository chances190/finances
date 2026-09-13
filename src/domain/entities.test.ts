import { describe, expect, test } from 'bun:test'
import type { Transaction } from './entities'
import { addMonths, monthlyFlows } from './entities'

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    type: 'Expense',
    date: '2026-03-15',
    description: 'Test',
    amount: 100,
    category: 'Shopping',
    paymentMethod: 'Credit',
    ...overrides,
  }
}

describe('addMonths', () => {
  test('wraps year boundary', () => {
    expect(addMonths('2026-01', 1)).toBe('2026-02')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', 12)).toBe('2027-01')
  })
  test('goes backwards', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2027-01', -12)).toBe('2026-01')
  })
  test('zero', () => {
    expect(addMonths('2026-06', 0)).toBe('2026-06')
  })
})

describe('monthlyFlows', () => {
  test('single flow for non-installment expense', () => {
    const f = monthlyFlows(tx({ installments: undefined }))
    expect(f).toHaveLength(1)
    expect(f[0].amount).toBe(100)
    expect(f[0].referenceMonth).toBe('2026-03')
    expect(f[0].installmentIndex).toBeUndefined()
  })

  test('single flow for installment=1', () => {
    const f = monthlyFlows(tx({ installments: 1 }))
    expect(f).toHaveLength(1)
    expect(f[0].amount).toBe(100)
  })

  test('income never splits', () => {
    const f = monthlyFlows(tx({ type: 'Income', installments: 3 }))
    expect(f).toHaveLength(1)
    expect(f[0].amount).toBe(100)
    expect(f[0].type).toBe('Income')
  })

  test('even split across 3 months', () => {
    const f = monthlyFlows(tx({ amount: 300, installments: 3 }))
    expect(f).toHaveLength(3)
    expect(f[0].amount).toBe(100)
    expect(f[1].amount).toBe(100)
    expect(f[2].amount).toBe(100)
    expect(f[0].referenceMonth).toBe('2026-03')
    expect(f[1].referenceMonth).toBe('2026-04')
    expect(f[2].referenceMonth).toBe('2026-05')
  })

  test('remainder absorbed by first flow', () => {
    const f = monthlyFlows(tx({ amount: 1000, installments: 3 }))
    expect(f).toHaveLength(3)
    expect(f[0].amount).toBe(334) // 333 + 1 remainder
    expect(f[1].amount).toBe(333)
    expect(f[2].amount).toBe(333)
    expect(f[0].amount + f[1].amount + f[2].amount).toBe(1000)
  })

  test('installment metadata carried on each flow', () => {
    const f = monthlyFlows(tx({ installments: 2 }))
    expect(f[0].installmentIndex).toBe(0)
    expect(f[0].installmentTotal).toBe(2)
    expect(f[1].installmentIndex).toBe(1)
    expect(f[1].installmentTotal).toBe(2)
  })

  test('small amount with many installments', () => {
    const f = monthlyFlows(tx({ amount: 5, installments: 3 }))
    expect(f).toHaveLength(3)
    expect(f[0].amount).toBe(3) // 1 + 2 remainder
    expect(f[1].amount).toBe(1)
    expect(f[2].amount).toBe(1)
    expect(f[0].amount + f[1].amount + f[2].amount).toBe(5)
  })

  test('passthrough for debit with no installments', () => {
    const f = monthlyFlows(tx({ paymentMethod: 'Debit', installments: undefined }))
    expect(f).toHaveLength(1)
    expect(f[0].paymentMethod).toBe('Debit')
  })

  test('all flow fields match source transaction', () => {
    const f = monthlyFlows(tx({ description: 'Groceries', category: 'Food' }))
    expect(f[0].description).toBe('Groceries')
    expect(f[0].category).toBe('Food')
    expect(f[0].id).toBe('1')
    expect(f[0].date).toBe('2026-03-15')
  })
})
