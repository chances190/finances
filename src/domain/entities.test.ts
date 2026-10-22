import { describe, expect, test } from 'bun:test'
import type { ExpenseTransaction, IncomeTransaction } from './entities'
import { addMonths, monthlyFlows } from './entities'

function tx(overrides: Partial<Omit<ExpenseTransaction, 'type'>> = {}): ExpenseTransaction {
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

function incomeTx(overrides: Partial<Omit<IncomeTransaction, 'type'>> = {}): IncomeTransaction {
  return {
    id: '1',
    type: 'Income',
    date: '2026-03-15',
    description: 'Test',
    amount: 100,
    category: 'Income',
    paymentMethod: 'Salary',
    ...overrides,
  }
}

describe('addMonths', () => {
  test('wraps forward across the year boundary', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', 12)).toBe('2027-01')
  })

  test('wraps backward across the year boundary', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2027-01', -12)).toBe('2026-01')
  })
})

describe('monthlyFlows', () => {
  test('a non-installment expense is one flow carrying the source fields', () => {
    const flows = monthlyFlows(tx({ installments: undefined }))

    expect(flows).toHaveLength(1)
    expect(flows[0]).toMatchObject({
      id: '1',
      amount: 100,
      date: '2026-03-15',
      description: 'Test',
      category: 'Shopping',
      paymentMethod: 'Credit',
      referenceMonth: '2026-03',
    })
    expect(flows[0].installmentIndex).toBeUndefined()
  })

  test('income never splits into installments', () => {
    const flows = monthlyFlows(incomeTx())

    expect(flows).toHaveLength(1)
    expect(flows[0].amount).toBe(100)
  })

  test('splits across consecutive months with the remainder on the first', () => {
    const flows = monthlyFlows(tx({ amount: 1000, installments: 3 }))

    expect(flows.map((f) => f.amount)).toEqual([334, 333, 333])
    expect(flows.map((f) => f.referenceMonth)).toEqual(['2026-03', '2026-04', '2026-05'])
    expect(flows.map((f) => f.installmentIndex)).toEqual([0, 1, 2])
    expect(flows[0].installmentTotal).toBe(3)
  })

  test('own amount equals the installment when nobody owes you', () => {
    const flows = monthlyFlows(tx({ amount: 300, installments: 3 }))

    expect(flows.map((f) => f.ownAmount)).toEqual([100, 100, 100])
  })

  test('own amount excludes what others owe, spread across installments', () => {
    const flows = monthlyFlows(
      tx({
        amount: 200,
        installments: 2,
        debts: [
          { name: 'Ana', amount: 50, settled: false },
          { name: 'Bia', amount: 50, settled: false },
        ],
      }),
    )

    expect(flows.map((f) => f.amount)).toEqual([100, 100])
    expect(flows.map((f) => f.ownAmount)).toEqual([50, 50])
  })

  test('own amounts total the purchase minus debts and never go negative', () => {
    const flows = monthlyFlows(
      tx({ amount: 100, installments: 3, debts: [{ name: 'Ana', amount: 50, settled: false }] }),
    )

    const ownTotal = flows.reduce((sum, f) => sum + f.ownAmount, 0)
    expect(Math.round(ownTotal * 100) / 100).toBe(50)
    expect(flows.every((f) => f.ownAmount >= 0)).toBe(true)
  })
})
