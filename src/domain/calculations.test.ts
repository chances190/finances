import { describe, expect, test } from 'bun:test'
import {
  addMonths,
  balance,
  budgetVsActual,
  budgetVsActualYear,
  byCategory,
  byMonth,
  cashExpenses,
  categoryTimeSeries,
  compareTransactions,
  creditInvoice,
  currentYM,
  daysSince,
  expensesByMonth,
  futureCommitments,
  groupBudgetsByRange,
  groupedByPaymentMethod,
  incomeByMonth,
  localYMD,
  mealVoucherBalance,
  mealVoucherExpenses,
  mealVoucherIncome,
  monthDiff,
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
    description: '',
    amount: 100,
    category: 'Other',
    paymentMethod: 'DEBIT',
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

const sampleTransactions: Transaction[] = [
  tx({ id: '1', amount: 100, category: 'Food', paymentMethod: 'PIX' }),
  tx({ id: '2', amount: 200, category: 'Rent', paymentMethod: 'DEBIT' }),
  tx({
    id: '3',
    amount: 50,
    category: 'Food',
    paymentMethod: 'MEAL_VOUCHER',
  }),
  tx({
    id: '4',
    amount: 5000,
    type: 'INCOME',
    category: 'Salary',
    paymentMethod: 'DEBIT',
  }),
  tx({ id: '5', amount: 300, date: '2026-08-01', category: 'Food', paymentMethod: 'PIX' }),
  tx({
    id: '6',
    amount: 150,
    category: 'Leisure',
    paymentMethod: 'CREDIT',
  }),
  tx({
    id: '7',
    amount: 80,
    category: 'Food',
    paymentMethod: 'PIX',
  }),
  tx({
    id: '8',
    amount: 800,
    type: 'INCOME',
    category: 'Salary',
    paymentMethod: 'MEAL_VOUCHER',
  }),
]

describe('byMonth', () => {
  test('filters expenses for given month', () => {
    const result = byMonth(sampleTransactions, '2026-07')
    expect(result).toHaveLength(5) // tx 1,2,3,6,7
    expect(result.every((t) => t.referenceMonth === '2026-07')).toBe(true)
    expect(result.every((t) => t.type === 'EXPENSE')).toBe(true)
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
    expect(expensesByMonth(sampleTransactions, '2026-07')).toBe(580) // 100+200+50+150+80
  })
})

describe('balance', () => {
  test('income minus expenses', () => {
    expect(balance(sampleTransactions, '2026-07')).toBe(5800 - 580)
  })
})

describe('byCategory', () => {
  test('sums expenses by category', () => {
    const result = byCategory(sampleTransactions, '2026-07')
    expect(result).toEqual({ Food: 230, Rent: 200, Leisure: 150 }) // Food: 100+50+80
  })
})

describe('groupedByPaymentMethod', () => {
  test('sums expenses by payment method', () => {
    const result = groupedByPaymentMethod(sampleTransactions, '2026-07')
    expect(result.PIX).toBe(180) // 100+80
    expect(result.DEBIT).toBe(200)
    expect(result.MEAL_VOUCHER).toBe(50)
    expect(result.CREDIT).toBe(150)
  })
})

describe('cashExpenses', () => {
  test('excludes MEAL_VOUCHER and CREDIT', () => {
    expect(cashExpenses(sampleTransactions, '2026-07')).toBe(380) // 100 PIX + 200 DEBIT + 80 PIX
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
        category: 'Food',
        paymentMethod: 'MEAL_VOUCHER',
      }),
    ]
    expect(mealVoucherExpenses(withMv, '2026-07')).toBe(80) // 50 (tx3) + 30 (tx9)
  })
})

describe('mealVoucherBalance', () => {
  test('income minus expenses for meal voucher', () => {
    const withMv = [
      ...sampleTransactions,
      tx({
        id: '9',
        amount: 30,
        category: 'Food',
        paymentMethod: 'MEAL_VOUCHER',
      }),
    ]
    expect(mealVoucherBalance(withMv, '2026-07')).toBe(720) // 800 income - 80 expenses
  })
})

describe('creditInvoice', () => {
  test('sums CREDIT expenses', () => {
    expect(creditInvoice(sampleTransactions, '2026-07')).toBe(150)
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
    expect(food?.actual).toBe(230) // 100+50+80
  })

  test('returns empty array for missing budget', () => {
    expect(budgetVsActual(sampleTransactions, undefined)).toEqual([])
  })
})

describe('futureCommitments', () => {
  const RealDate = Date

  function mockDate(ymd: string) {
    const fake = new RealDate(`${ymd}T12:00:00Z`)
    // @ts-expect-error mocking Date for deterministic test
    globalThis.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(fake)
        else super(...(args as ConstructorParameters<typeof RealDate>))
      }
      static now = () => fake.getTime()
    } as typeof Date
  }

  test('returns commitments for installment purchase', () => {
    mockDate('2026-09-01')
    try {
      const installmentTx: Transaction = tx({
        id: 'i1',
        amount: 300,
        date: '2026-09-15',
        paymentMethod: 'CREDIT',
        installments: 3,
      })
      const result = futureCommitments([...sampleTransactions, installmentTx], 6)
      expect(result.length).toBeGreaterThan(0)
      const sep = result.find((r) => r.referenceMonth === '2026-09')
      expect(sep?.total).toBe(100)
    } finally {
      globalThis.Date = RealDate
    }
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
    expect(jul?.expenses).toBe(580)
    expect(result.totalIncome).toBe(5800)
    expect(result.totalExpenses).toBe(880) // 580 (Jul) + 300 (Aug)
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

function budget(
  month: string,
  income = 5000,
  limits: Record<string, number> = { Food: 1000 },
): Budget {
  return {
    referenceMonth: month,
    plannedIncome: income,
    plannedMealVoucher: 0,
    categoryLimits: limits,
  }
}

describe('groupBudgetsByRange', () => {
  test('returns empty for no budgets', () => {
    expect(groupBudgetsByRange([])).toEqual([])
  })

  test('single budget is a one-month range', () => {
    const result = groupBudgetsByRange([budget('2026-03')])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      startMonth: '2026-03',
      endMonth: '2026-03',
      months: ['2026-03'],
    })
  })

  test('consecutive equal budgets collapse into one range', () => {
    const result = groupBudgetsByRange([budget('2026-03'), budget('2026-04'), budget('2026-05')])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      startMonth: '2026-03',
      endMonth: '2026-05',
      months: ['2026-03', '2026-04', '2026-05'],
    })
  })

  test('equal budgets with a gap form separate ranges', () => {
    const result = groupBudgetsByRange([budget('2026-03'), budget('2026-04'), budget('2026-06')])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ startMonth: '2026-03', endMonth: '2026-04' })
    expect(result[1]).toMatchObject({ startMonth: '2026-06', endMonth: '2026-06' })
  })

  test('consecutive months with different values form separate ranges', () => {
    const result = groupBudgetsByRange([budget('2026-03', 5000), budget('2026-04', 6000)])
    expect(result).toHaveLength(2)
  })

  test('equality ignores categoryLimits key insertion order', () => {
    const a = budget('2026-03', 5000, { Food: 1000, Rent: 2000 })
    const b = budget('2026-04', 5000, { Rent: 2000, Food: 1000 })
    expect(groupBudgetsByRange([a, b])).toHaveLength(1)
  })

  test('sorts unordered input before grouping', () => {
    const result = groupBudgetsByRange([budget('2026-05'), budget('2026-03'), budget('2026-04')])
    expect(result).toHaveLength(1)
    expect(result[0].months).toEqual(['2026-03', '2026-04', '2026-05'])
  })
})

describe('local date helpers', () => {
  test('currentYM returns zero-padded local YYYY-MM', () => {
    expect(currentYM(new Date(2026, 0, 15))).toBe('2026-01')
    expect(currentYM(new Date(2026, 8, 5))).toBe('2026-09')
    expect(currentYM(new Date(2026, 11, 31))).toBe('2026-12')
  })

  test('localYMD returns zero-padded local YYYY-MM-DD', () => {
    expect(localYMD(new Date(2026, 0, 3))).toBe('2026-01-03')
    expect(localYMD(new Date(2026, 9, 10))).toBe('2026-10-10')
    expect(localYMD(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('compareTransactions', () => {
  test('sorts amounts numerically ascending', () => {
    expect(
      compareTransactions(
        tx({ id: '1', amount: 9 }),
        tx({ id: '2', amount: 1000 }),
        'amount',
        'asc',
      ),
    ).toBeLessThan(0)
    expect(
      compareTransactions(
        tx({ id: '1', amount: 1000 }),
        tx({ id: '2', amount: 9 }),
        'amount',
        'asc',
      ),
    ).toBeGreaterThan(0)
    expect(
      compareTransactions(
        tx({ id: '1', amount: 500 }),
        tx({ id: '2', amount: 500 }),
        'amount',
        'asc',
      ),
    ).toBe(0)
  })

  test('reverses numeric order for desc', () => {
    expect(
      compareTransactions(
        tx({ id: '1', amount: 9 }),
        tx({ id: '2', amount: 1000 }),
        'amount',
        'desc',
      ),
    ).toBeGreaterThan(0)
  })

  test('compares string fields lexicographically', () => {
    const a = tx({ id: '1', description: 'Apple' })
    const b = tx({ id: '2', description: 'Banana' })
    expect(compareTransactions(a, b, 'description', 'asc')).toBeLessThan(0)
    expect(compareTransactions(a, b, 'description', 'desc')).toBeGreaterThan(0)
  })

  test('sorts dates chronologically by string comparison', () => {
    expect(
      compareTransactions(
        tx({ id: '1', date: '2026-01-01' }),
        tx({ id: '2', date: '2026-12-31' }),
        'date',
        'asc',
      ),
    ).toBeLessThan(0)
  })
})
