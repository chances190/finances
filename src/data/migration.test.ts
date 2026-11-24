import { describe, expect, test } from 'bun:test'
import type { Budget } from '../domain/entities'
import { buildPurchase, outstanding, paceByMonth, voucherBalance } from '../domain/ledger'
import { normalizeFinanceData } from './migration'
import type {
  LegacyExpenseTransaction,
  LegacyFinanceData,
  LegacyIncomeTransaction,
} from './validation'

const budget: Budget = {
  referenceMonth: '2026-11',
  plannedIncome: 5000,
  plannedMealVoucher: 800,
  investmentRate: 0.2,
  categoryLimits: { Food: 500 },
}

const salary: LegacyIncomeTransaction = {
  id: 'i1',
  type: 'Income',
  date: '2026-11-01',
  description: 'Salary',
  amount: 5000,
  category: 'Income',
  paymentMethod: 'Salary',
}

const dinner: LegacyExpenseTransaction = {
  id: 'e1',
  type: 'Expense',
  date: '2026-11-02',
  description: 'Dinner',
  amount: 100,
  category: 'Food',
  paymentMethod: 'Credit',
  debts: [{ name: 'Ana', amount: 50, settled: true }],
}

const legacy: LegacyFinanceData = {
  transactions: [salary, dinner],
  budgets: [budget],
}

describe('normalizeFinanceData', () => {
  test('migrates income, shared purchase, and settled debt', () => {
    const result = normalizeFinanceData(legacy)

    expect(result.skippedMovements).toEqual([])
    expect(result.data.movements).toHaveLength(3)
    expect(result.data.budgets).toEqual([budget])
    expect(paceByMonth(result.data.movements, '2026-11')).toBe(50)
    expect(outstanding(result.data.movements, 'receivable')).toEqual([])
  })

  test('materializes installments and settles the debt after the last installment', () => {
    const installmentExpense: LegacyExpenseTransaction = {
      id: 'e2',
      type: 'Expense',
      date: '2026-01-31',
      description: 'Laptop',
      amount: 300,
      category: 'Electronics',
      paymentMethod: 'Credit',
      installments: 3,
      debts: [{ name: 'Ana', amount: 90, settled: true }],
    }

    const result = normalizeFinanceData({ transactions: [installmentExpense], budgets: [] })

    expect(result.skippedMovements).toEqual([])
    expect(result.data.movements).toHaveLength(4)
    expect(paceByMonth(result.data.movements, '2026-01')).toBe(70)
    expect(paceByMonth(result.data.movements, '2026-02')).toBe(70)
    expect(paceByMonth(result.data.movements, '2026-03')).toBe(70)
    expect(outstanding(result.data.movements, 'receivable')).toEqual([])
  })

  test('migrates voucher income into the voucher account', () => {
    const voucherIncome: LegacyIncomeTransaction = {
      ...salary,
      id: 'i2',
      paymentMethod: 'Voucher',
      amount: 800,
      category: 'Voucher',
    }

    const result = normalizeFinanceData({ transactions: [voucherIncome], budgets: [] })

    expect(voucherBalance(result.data.movements)).toBe(800)
    expect(result.data.movements[0].method).toBe('Voucher Income')
  })

  test('skips invalid legacy transactions and keeps valid ones', () => {
    const invalid = { ...salary, id: 'bad', amount: -100 }
    const result = normalizeFinanceData({
      transactions: [salary, invalid],
      budgets: [],
    })

    expect(result.data.movements).toHaveLength(1)
    expect(result.skippedMovements.length).toBeGreaterThan(0)
  })

  test('passes an already-migrated ledger through validation', () => {
    const purchase = buildPurchase({
      id: 'p1',
      date: '2026-11-01',
      description: 'Dinner',
      amount: 100,
      category: 'Food',
      account: 'card',
    })
    if (!purchase.ok) throw new Error(purchase.reason)

    const result = normalizeFinanceData({ movements: purchase.value, budgets: [budget] })

    expect(result.data.movements).toEqual(purchase.value)
    expect(result.data.budgets).toEqual([budget])
    expect(result.skippedMovements).toEqual([])
  })

  test('rejects data that is neither shape', () => {
    expect(() => normalizeFinanceData({})).toThrow()
    expect(() => normalizeFinanceData(null)).toThrow()
  })
})
