import { describe, expect, test } from 'bun:test'
import {
  activeDebts,
  addMonths,
  balance,
  budgetVsActual,
  budgetVsActualYear,
  byCategory,
  byMonth,
  cashExpenses,
  categoryTimeSeries,
  creditInvoice,
  daysSince,
  expensesByMonth,
  futureCommitments,
  generateInstallments,
  groupedByPaymentMethod,
  incomeByMonth,
  mealVoucherBalance,
  mealVoucherExpenses,
  mealVoucherIncome,
  monthDiff,
  outstandingDebt,
  parseDate,
  ses,
  spendingPace,
  totalByMonth,
  yearSummary,
} from './calculations'
import type { Budget, Transaction } from './entities'

function tx(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    type: 'EXPENSE',
    date: '2026-07-01',
    referenceMonth: '2026-07',
    description: '',
    amount: 100,
    category: 'Other',
    paymentMethod: 'DEBIT',
    isDebt: false,
    isSettled: false,
    ...overrides,
  }
}

describe('addMonths', () => {
  test('adds positive months', () => {
    expect(addMonths('2026-01', 1)).toBe('2026-02')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', 12)).toBe('2027-01')
  })
  test('adds negative months', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})

describe('monthDiff', () => {
  test('calculates difference between months', () => {
    expect(monthDiff('2026-07', '2026-06')).toBe(1)
    expect(monthDiff('2026-07', '2026-07')).toBe(0)
    expect(monthDiff('2027-01', '2026-01')).toBe(12)
  })
})

describe('parseDate', () => {
  test('parses date string to timestamp', () => {
    const ts = parseDate('2026-07-15')
    expect(typeof ts).toBe('number')
    expect(ts).toBeGreaterThan(0)
  })
})

describe('generateInstallments', () => {
  const base: Omit<Transaction, 'id'> = {
    type: 'EXPENSE',
    date: '2026-07-15',
    referenceMonth: '2026-07',
    description: 'Test',
    amount: 1200,
    category: 'Shopping',
    paymentMethod: 'CREDIT',
    isDebt: false,
    isSettled: false,
  }

  test('generates correct number of installments', () => {
    const result = generateInstallments(base, 12, 'group-1')
    expect(result).toHaveLength(12)
  })

  test('first installment gets reference month from tx', () => {
    const result = generateInstallments(base, 3, 'group-1')
    expect(result[0].referenceMonth).toBe('2026-07')
  })

  test('subsequent months increment correctly', () => {
    const result = generateInstallments(base, 3, 'group-1')
    expect(result[1].referenceMonth).toBe('2026-08')
    expect(result[2].referenceMonth).toBe('2026-09')
  })

  test('amounts distributed correctly with remainder on last', () => {
    const result = generateInstallments({ ...base, amount: 100 }, 3, 'g')
    expect(result[0].amount).toBeCloseTo(33.33)
    expect(result[1].amount).toBeCloseTo(33.33)
    expect(result[2].amount).toBeCloseTo(33.34)
  })

  test('all installments have groupId and parentId', () => {
    const result = generateInstallments(base, 3, 'group-1')
    for (const inst of result) {
      expect(inst.groupId).toBe('group-1')
      expect(inst.parentId).toBe('group-1')
    }
  })
})

const sampleTransactions: Transaction[] = [
  tx({ id: '1', amount: 100, referenceMonth: '2026-07', category: 'Food', paymentMethod: 'PIX' }),
  tx({ id: '2', amount: 200, referenceMonth: '2026-07', category: 'Rent', paymentMethod: 'DEBIT' }),
  tx({
    id: '3',
    amount: 50,
    referenceMonth: '2026-07',
    category: 'Food',
    paymentMethod: 'MEAL_VOUCHER',
    isSettled: true,
  }),
  tx({
    id: '4',
    amount: 5000,
    referenceMonth: '2026-07',
    type: 'INCOME',
    category: 'Salary',
    paymentMethod: 'DEBIT',
  }),
  tx({ id: '5', amount: 300, referenceMonth: '2026-08', category: 'Food', paymentMethod: 'PIX' }),
  tx({
    id: '6',
    amount: 150,
    referenceMonth: '2026-07',
    category: 'Leisure',
    paymentMethod: 'CREDIT',
  }),
  tx({
    id: '7',
    amount: 80,
    referenceMonth: '2026-07',
    category: 'Food',
    paymentMethod: 'PIX',
    isDebt: true,
  }),
  tx({
    id: '8',
    amount: 800,
    referenceMonth: '2026-07',
    type: 'INCOME',
    category: 'Salary',
    paymentMethod: 'MEAL_VOUCHER',
  }),
]

describe('byMonth', () => {
  test('filters expenses for given month, excluding settled and debts', () => {
    const result = byMonth(sampleTransactions, '2026-07')
    expect(result).toHaveLength(3) // tx 1, 2, 6 (excludes settled-3, income-4, debt-7, other month-5, income-8)
    expect(result.every((t) => t.referenceMonth === '2026-07')).toBe(true)
    expect(result.every((t) => t.type === 'EXPENSE')).toBe(true)
    expect(result.every((t) => !t.isSettled)).toBe(true)
    expect(result.every((t) => !t.isDebt)).toBe(true)
  })
})

describe('incomeByMonth', () => {
  test('filters income for given month, excluding settled', () => {
    const result = incomeByMonth(sampleTransactions, '2026-07')
    expect(result).toHaveLength(2)
    expect(result.every((t) => t.type === 'INCOME')).toBe(true)
  })
})

describe('totalByMonth', () => {
  test('sums income for month', () => {
    expect(totalByMonth(sampleTransactions, '2026-07')).toBe(5800)
  })
})

describe('expensesByMonth', () => {
  test('sums expenses for month', () => {
    expect(expensesByMonth(sampleTransactions, '2026-07')).toBe(450) // 100 + 200 + 150
  })
})

describe('balance', () => {
  test('income minus expenses', () => {
    expect(balance(sampleTransactions, '2026-07')).toBe(5800 - 450)
  })
})

describe('byCategory', () => {
  test('sums expenses by category', () => {
    const result = byCategory(sampleTransactions, '2026-07')
    expect(result).toEqual({ Food: 100, Rent: 200, Leisure: 150 })
  })
})

describe('groupedByPaymentMethod', () => {
  test('sums expenses by payment method', () => {
    const result = groupedByPaymentMethod(sampleTransactions, '2026-07')
    expect(result.PIX).toBe(100)
    expect(result.DEBIT).toBe(200)
    expect(result.CREDIT).toBe(150)
  })
})

describe('cashExpenses', () => {
  test('excludes MEAL_VOUCHER and CREDIT', () => {
    expect(cashExpenses(sampleTransactions, '2026-07')).toBe(300) // 100 PIX + 200 DEBIT
  })
})

describe('mealVoucherIncome', () => {
  test('income with MEAL_VOUCHER payment', () => {
    expect(mealVoucherIncome(sampleTransactions, '2026-07')).toBe(800)
  })
})

describe('mealVoucherExpenses', () => {
  test('expenses with MEAL_VOUCHER payment', () => {
    const withMv = [
      ...sampleTransactions,
      tx({
        id: '9',
        amount: 30,
        referenceMonth: '2026-07',
        category: 'Food',
        paymentMethod: 'MEAL_VOUCHER',
      }),
    ]
    expect(mealVoucherExpenses(withMv, '2026-07')).toBe(30)
  })
})

describe('mealVoucherBalance', () => {
  test('income minus expenses for meal voucher', () => {
    const withMv = [
      ...sampleTransactions,
      tx({
        id: '9',
        amount: 30,
        referenceMonth: '2026-07',
        category: 'Food',
        paymentMethod: 'MEAL_VOUCHER',
      }),
    ]
    expect(mealVoucherBalance(withMv, '2026-07')).toBe(770)
  })
})

describe('creditInvoice', () => {
  test('sums CREDIT expenses', () => {
    expect(creditInvoice(sampleTransactions, '2026-07')).toBe(150)
  })
})

describe('activeDebts', () => {
  test('returns unsettled debt transactions', () => {
    const debts = activeDebts(sampleTransactions)
    expect(debts).toHaveLength(1)
    expect(debts[0].id).toBe('7')
  })
})

describe('outstandingDebt', () => {
  test('sums unsettled debt amounts', () => {
    expect(outstandingDebt(sampleTransactions)).toBe(80)
  })
})

describe('ses', () => {
  test('single value returns same', () => {
    expect(ses([100])).toEqual([100])
  })
  test('empty returns empty', () => {
    expect(ses([])).toEqual([])
  })
  test('computes exponential smoothing', () => {
    const result = ses([100, 200, 150])
    expect(result[0]).toBe(100)
    expect(result[1]).toBeCloseTo(0.3 * 200 + 0.7 * 100)
    expect(result[2]).toBeCloseTo(0.3 * 150 + 0.7 * (0.3 * 200 + 0.7 * 100))
  })
})

describe('spendingPace', () => {
  const budget: Budget = {
    referenceMonth: '2026-07',
    plannedIncome: 5000,
    plannedMealVoucher: 500,
    categoryLimits: {},
  }

  test('returns expected structure', () => {
    const result = spendingPace(sampleTransactions, budget, 15)
    expect(result.daily).toHaveLength(30)
    expect(result.cumulative).toHaveLength(30)
    expect(result.limit).toBe(5500 * 0.8)
    expect(result.totalSalary).toBe(5500)
    expect(result.suggestionPerDay).toBeGreaterThan(0)
  })

  test('no budget returns zeros', () => {
    const result = spendingPace(sampleTransactions, undefined, 15)
    expect(result.limit).toBe(0)
    expect(result.totalSalary).toBe(0)
  })
})

describe('budgetVsActual', () => {
  test('returns budget vs actual comparison', () => {
    const budget: Budget = {
      referenceMonth: '2026-07',
      plannedIncome: 5000,
      plannedMealVoucher: 500,
      categoryLimits: { Food: 200, Rent: 250, Other: 50 },
    }
    const result = budgetVsActual(sampleTransactions, budget)
    const food = result.find((r) => r.category === 'Food')
    expect(food?.budgeted).toBe(200)
    expect(food?.actual).toBe(100)
  })

  test('returns empty array for missing budget', () => {
    expect(budgetVsActual(sampleTransactions, undefined)).toEqual([])
  })
})

describe('futureCommitments', () => {
  test('returns commitments for installment children', () => {
    const installments: Transaction[] = Array.from({ length: 3 }, (_, i) =>
      tx({
        id: `i${i}`,
        amount: 100,
        referenceMonth: `2026-${String(8 + i).padStart(2, '0')}`,
        parentId: 'parent-1',
        paymentMethod: 'CREDIT',
      }),
    )
    const result = futureCommitments([...sampleTransactions, ...installments], 6)
    expect(result.length).toBeGreaterThan(0)
    const aug = result.find((r) => r.referenceMonth === '2026-08')
    expect(aug?.total).toBe(100)
  })

  test('handles empty transactions', () => {
    const result = futureCommitments([], 3)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((r) => r.total === 0)).toBe(true)
  })
})

describe('categoryTimeSeries', () => {
  test('returns monthly category data', () => {
    const result = categoryTimeSeries(sampleTransactions, 3)
    expect(result.length).toBe(3)
    expect(result[0].month).toBeDefined()
  })
})

describe('yearSummary', () => {
  test('returns monthly breakdown for year', () => {
    const result = yearSummary(sampleTransactions, 2026)
    expect(result.months).toHaveLength(12)
    const jul = result.months.find((m) => m.referenceMonth === '2026-07')
    expect(jul?.income).toBe(5800)
    expect(jul?.expenses).toBe(450)
    expect(result.totalIncome).toBe(5800)
    expect(result.totalExpenses).toBe(750)
  })
})

describe('budgetVsActualYear', () => {
  test('aggregates budget vs actual across year', () => {
    const budgets: Budget[] = [
      {
        referenceMonth: '2026-07',
        plannedIncome: 5000,
        plannedMealVoucher: 500,
        categoryLimits: { Food: 1000, Rent: 2000 },
      },
    ]
    const result = budgetVsActualYear(sampleTransactions, budgets, 2026)
    expect(result.length).toBeGreaterThan(0)
  })

  test('returns empty for year with no budgets', () => {
    expect(budgetVsActualYear(sampleTransactions, [], 2025)).toEqual([])
  })
})

describe('daysSince', () => {
  test('returns an integer number of days', () => {
    const days = daysSince(new Date().toISOString().slice(0, 10))
    expect(Number.isInteger(days)).toBe(true)
  })
  test('past dates return positive', () => {
    expect(daysSince('2026-01-01')).toBeGreaterThanOrEqual(0)
  })
})
