import { describe, expect, test } from 'bun:test'
import {
  budgetVsActual,
  budgetVsActualYear,
  byCategory,
  compareTransactions,
  currentYM,
  daysInMonth,
  daysSince,
  expensesByMonth,
  futureCommitments,
  groupBudgetsByRange,
  groupedByPaymentMethod,
  localYMD,
  mealVoucherBalance,
  monthDiff,
  ses,
  spendingPace,
  splitEvenlyAcrossParticipants,
  totalByMonth,
  yearSummary,
} from './calculations'
import { DEFAULT_INVESTMENT_RATE } from './constants'
import type { Budget, ExpenseTransaction, IncomeTransaction, Transaction } from './entities'

type ExpenseOverrides = Partial<Omit<ExpenseTransaction, 'id' | 'type'>>
type IncomeOverrides = Partial<Omit<IncomeTransaction, 'id' | 'type'>>

function tx({ id, ...overrides }: ExpenseOverrides & { id: string }): ExpenseTransaction {
  return {
    id,
    type: 'Expense',
    date: '2026-07-01',
    description: '',
    amount: 100,
    category: 'Other',
    paymentMethod: 'Debit/PIX',
    ...overrides,
  }
}

function incomeTx({ id, ...overrides }: IncomeOverrides & { id: string }): IncomeTransaction {
  return {
    id,
    type: 'Income',
    date: '2026-07-01',
    description: '',
    amount: 100,
    category: 'Income',
    paymentMethod: 'Salary',
    ...overrides,
  }
}

const sampleTransactions: Transaction[] = [
  tx({ id: '1', amount: 100, category: 'Food', paymentMethod: 'Debit/PIX' }),
  tx({ id: '2', amount: 200, category: 'Rent', paymentMethod: 'Debit/PIX' }),
  tx({ id: '3', amount: 50, category: 'Food', paymentMethod: 'Voucher Debit' }),
  incomeTx({ id: '4', amount: 5000 }),
  tx({ id: '5', amount: 300, date: '2026-08-01', category: 'Food', paymentMethod: 'Debit/PIX' }),
  tx({ id: '6', amount: 150, category: 'Leisure', paymentMethod: 'Credit' }),
  tx({ id: '7', amount: 80, category: 'Food', paymentMethod: 'Debit/PIX' }),
  incomeTx({ id: '8', amount: 800, paymentMethod: 'Voucher' }),
]

describe('monthDiff', () => {
  test('counts whole months between keys', () => {
    expect(monthDiff('2026-07', '2026-06')).toBe(1)
    expect(monthDiff('2027-01', '2026-01')).toBe(12)
  })
})

describe('expensesByMonth', () => {
  test('sums only expenses in the given month', () => {
    expect(expensesByMonth(sampleTransactions, '2026-07')).toBe(580)
  })

  test('counts only your share of a shared expense', () => {
    const shared = tx({
      id: 'shared',
      amount: 100,
      debts: [
        { name: 'Ana', amount: 30, settled: false },
        { name: 'Bia', amount: 20, settled: true },
      ],
    })

    // Settlement state is irrelevant: your share was always the remainder.
    expect(expensesByMonth([shared], '2026-07')).toBe(50)
  })
})

describe('totalByMonth', () => {
  test('sums only income in the given month', () => {
    expect(totalByMonth(sampleTransactions, '2026-07')).toBe(5800)
  })
})

describe('byCategory', () => {
  test('groups expenses by category', () => {
    expect(byCategory(sampleTransactions, '2026-07')).toEqual({
      Food: 230,
      Rent: 200,
      Leisure: 150,
    })
  })
})

describe('groupedByPaymentMethod', () => {
  test('groups expenses by payment method', () => {
    const result = groupedByPaymentMethod(sampleTransactions, '2026-07')

    expect(result).toEqual({ 'Debit/PIX': 380, 'Voucher Debit': 50, Credit: 150 })
  })
})

describe('mealVoucherBalance', () => {
  test('subtracts voucher spending from voucher income', () => {
    expect(mealVoucherBalance(sampleTransactions, '2026-07')).toBe(750)
  })
})

describe('splitEvenlyAcrossParticipants', () => {
  test('distributes leftover cents instead of assigning them all to you', () => {
    const debtorAmounts = splitEvenlyAcrossParticipants(10, 2)

    expect(debtorAmounts).toEqual([3.34, 3.33])
  })

  test('spreads multiple remainder cents and preserves the total', () => {
    const debtorAmounts = splitEvenlyAcrossParticipants(1, 7)

    expect(debtorAmounts).toEqual([0.13, 0.13, 0.13, 0.13, 0.12, 0.12, 0.12])
  })
})

describe('ses', () => {
  test('empty input yields empty output', () => {
    expect(ses([])).toEqual([])
  })

  test('smooths toward each new value', () => {
    const result = ses([100, 200, 150])

    expect(result[0]).toBe(100)
    expect(result[1]).toBeCloseTo(0.3 * 200 + 0.7 * 100)
    expect(result[2]).toBeCloseTo(0.3 * 150 + 0.7 * (0.3 * 200 + 0.7 * 100))
  })
})

describe('daysInMonth', () => {
  test('uses the real calendar length of the month', () => {
    expect(daysInMonth('2026-07')).toBe(31)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
  })
})

describe('daysSince', () => {
  test('today is zero days ago', () => {
    expect(daysSince(localYMD())).toBe(0)
  })
})

describe('spendingPace', () => {
  const budget: Budget = {
    referenceMonth: '2026-07',
    plannedIncome: 5000,
    plannedMealVoucher: 500,
    investmentRate: DEFAULT_INVESTMENT_RATE,
    categoryLimits: {},
  }

  test('applies the savings cut to income only', () => {
    const result = spendingPace([], budget, 1)

    expect(result.limit).toBe(5000 * (1 - DEFAULT_INVESTMENT_RATE) + 500)
    expect(result.totalSalary).toBe(5500)
  })

  test('counts only your share of a shared expense', () => {
    const shared = tx({
      id: 's',
      amount: 100,
      date: '2026-07-05',
      debts: [{ name: 'Ana', amount: 50, settled: false }],
    })

    expect(spendingPace([shared], budget, 10).spentSoFar).toBe(50)
  })

  test('projects the average spent per day after today', () => {
    const spent = [
      tx({ id: 'a', amount: 100, date: '2026-07-01' }),
      tx({ id: 'b', amount: 100, date: '2026-07-02' }),
    ]
    const result = spendingPace(spent, budget, 2)

    expect(result.daily.find((day) => day.day === 5)?.trend).toBe(100)
    expect(result.cumulative.find((day) => day.day === 5)?.trend).toBe(500)
  })

  test('places an installment in its reference month, not on the purchase day', () => {
    const purchase = tx({ id: 'p', amount: 200, date: '2026-06-28', installments: 2 })

    // The July installment exists by the 5th even though the purchase was on the 28th.
    expect(spendingPace([purchase], budget, 5).spentSoFar).toBe(100)
  })

  test('reserves charges already committed later in the month', () => {
    const later = tx({ id: 'l', amount: 300, date: '2026-07-20' })
    const result = spendingPace([later], budget, 10)

    expect(result.spentSoFar).toBe(0)
    expect(result.remainingBudget).toBe(result.limit - 300)
  })

  test('suggestions start today, not tomorrow', () => {
    const result = spendingPace([], budget, 21)

    expect(result.daily[19].suggestion).toBeNull()
    expect(result.daily[20].suggestion).toBeGreaterThan(0)
  })

  test('separates ahead-of-pace from over-budget', () => {
    const rent = tx({ id: 'r', amount: 1500, date: '2026-07-01' })
    expect(spendingPace([rent], budget, 1).status).toBe('ahead')

    const excessive = tx({ id: 'e', amount: 5000, date: '2026-07-02' })
    expect(spendingPace([excessive], budget, 2).status).toBe('over')
  })

  test('no budget yields no limit', () => {
    const result = spendingPace([], undefined, 15)

    expect(result.limit).toBe(0)
    expect(result.totalSalary).toBe(0)
  })
})

describe('budgetVsActual', () => {
  test('pairs each category limit with its actual spend', () => {
    const budget: Budget = {
      referenceMonth: '2026-07',
      plannedIncome: 5000,
      plannedMealVoucher: 500,
      investmentRate: 0,
      categoryLimits: { Food: 200, Rent: 250 },
    }

    const result = budgetVsActual(sampleTransactions, budget)

    expect(result.find((r) => r.category === 'Food')).toEqual({
      category: 'Food',
      budgeted: 200,
      actual: 230,
    })
  })
})

describe('futureCommitments', () => {
  const RealDate = Date

  function mockDate(ymd: string) {
    const fake = new RealDate(`${ymd}T12:00:00Z`)
    globalThis.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(fake)
        else super(...(args as ConstructorParameters<typeof RealDate>))
      }
      static now = () => fake.getTime()
    } as typeof Date
  }

  test('aggregates the installments falling inside the window', () => {
    mockDate('2026-09-01')
    try {
      const purchase = tx({
        id: 'i1',
        amount: 300,
        date: '2026-09-15',
        installments: 3,
      })

      const result = futureCommitments([purchase], 6)
      const sep = result.find((r) => r.referenceMonth === '2026-09')

      expect(sep?.total).toBe(100)
    } finally {
      globalThis.Date = RealDate
    }
  })
})

describe('yearSummary', () => {
  test('sums each month and the year total', () => {
    const result = yearSummary(sampleTransactions, 2026)
    const jul = result.months.find((m) => m.referenceMonth === '2026-07')

    expect(jul).toMatchObject({ income: 5800, expenses: 580 })
    expect(result.totalExpenses).toBe(880)
  })
})

describe('budgetVsActualYear', () => {
  test('aggregates category limits and actuals across the year', () => {
    const budgets: Budget[] = [
      {
        referenceMonth: '2026-07',
        plannedIncome: 5000,
        plannedMealVoucher: 500,
        investmentRate: 0,
        categoryLimits: { Food: 1000 },
      },
    ]

    const result = budgetVsActualYear(sampleTransactions, budgets, 2026)

    expect(result.find((r) => r.category === 'Food')).toEqual({
      category: 'Food',
      budgeted: 1000,
      actual: 530,
    })
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
    investmentRate: 0,
    categoryLimits: limits,
  }
}

describe('groupBudgetsByRange', () => {
  test('a single budget is a one-month range', () => {
    expect(groupBudgetsByRange([budget('2026-03')])).toMatchObject([
      { startMonth: '2026-03', endMonth: '2026-03', months: ['2026-03'] },
    ])
  })

  test('consecutive equal budgets collapse into one range', () => {
    const result = groupBudgetsByRange([budget('2026-03'), budget('2026-04'), budget('2026-05')])

    expect(result).toMatchObject([
      { startMonth: '2026-03', endMonth: '2026-05', months: ['2026-03', '2026-04', '2026-05'] },
    ])
  })

  test('equal budgets with a gap form separate ranges', () => {
    const result = groupBudgetsByRange([budget('2026-03'), budget('2026-04'), budget('2026-06')])

    expect(result.map((r) => [r.startMonth, r.endMonth])).toEqual([
      ['2026-03', '2026-04'],
      ['2026-06', '2026-06'],
    ])
  })

  test('consecutive months with different values stay separate', () => {
    const result = groupBudgetsByRange([budget('2026-03', 5000), budget('2026-04', 6000)])

    expect(result).toHaveLength(2)
  })

  test('equality ignores category-limit key order', () => {
    const a = budget('2026-03', 5000, { Food: 1000, Rent: 2000 })
    const b = budget('2026-04', 5000, { Rent: 2000, Food: 1000 })

    expect(groupBudgetsByRange([a, b])).toHaveLength(1)
  })

  test('sorts unordered input before grouping', () => {
    const result = groupBudgetsByRange([budget('2026-05'), budget('2026-03'), budget('2026-04')])

    expect(result[0].months).toEqual(['2026-03', '2026-04', '2026-05'])
  })
})

describe('local date helpers', () => {
  test('currentYM zero-pads the local month', () => {
    expect(currentYM(new Date(2026, 0, 15))).toBe('2026-01')
    expect(currentYM(new Date(2026, 11, 31))).toBe('2026-12')
  })

  test('localYMD zero-pads the local day', () => {
    expect(localYMD(new Date(2026, 0, 3))).toBe('2026-01-03')
    expect(localYMD(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('compareTransactions', () => {
  test('compares amounts numerically, not lexicographically', () => {
    const nine = tx({ id: '1', amount: 9 })
    const thousand = tx({ id: '2', amount: 1000 })

    expect(compareTransactions(nine, thousand, 'amount', 'asc')).toBeLessThan(0)
    expect(compareTransactions(nine, thousand, 'amount', 'desc')).toBeGreaterThan(0)
  })

  test('compares text fields, including dates, lexicographically', () => {
    const apple = tx({ id: '1', description: 'Apple', date: '2026-01-01' })
    const banana = tx({ id: '2', description: 'Banana', date: '2026-12-31' })

    expect(compareTransactions(apple, banana, 'description', 'asc')).toBeLessThan(0)
    expect(compareTransactions(apple, banana, 'date', 'asc')).toBeLessThan(0)
  })
})
