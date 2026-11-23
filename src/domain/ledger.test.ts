import { describe, expect, test } from 'bun:test'
import type { Budget } from './entities'
import {
  accountBalance,
  availableMonths,
  type BuildResult,
  budgetVsActual,
  buildAdjustment,
  buildIncome,
  buildPurchase,
  buildRefund,
  buildSettlement,
  buildTransfer,
  categoryTotals,
  currentYM,
  expensesByAccount,
  futureCommitments,
  incomeByMonth,
  isBalanced,
  type Movement,
  movementTotal,
  outstanding,
  outstandingMovements,
  paceByMonth,
  spendingPace,
  voucherBalance,
  yearSummary,
} from './ledger'

function must<T>(result: BuildResult<T>): T {
  if (!result.ok) throw new Error(result.reason)
  return result.value
}

function purchase(overrides: Partial<Parameters<typeof buildPurchase>[0]> = {}): Movement {
  return must(
    buildPurchase({
      id: 'p1',
      date: '2026-11-01',
      description: 'Dinner',
      amount: 100,
      category: 'Food',
      account: 'card',
      ...overrides,
    }),
  )[0]
}

describe('buildPurchase', () => {
  test('balances the purchase and counts the expense once', () => {
    const movement = purchase()

    expect(movement.kind).toBe('purchase')
    expect(isBalanced(movement)).toBe(true)
    expect(movement.postings).toEqual([
      { account: 'expense', amount: 100, category: 'Food' },
      { account: 'card', amount: -100 },
    ])
    expect(paceByMonth([movement], '2026-11')).toBe(100)
  })

  test('excludes a shared share from pace and records a receivable', () => {
    const movement = purchase({ shares: [{ counterparty: 'Ana', amount: 50 }] })

    expect(isBalanced(movement)).toBe(true)
    expect(paceByMonth([movement], '2026-11')).toBe(50)
    expect(outstanding([movement], 'receivable')).toEqual([{ counterparty: 'Ana', amount: 50 }])
  })

  test('records a payable purchase and counts the full consumption', () => {
    const movement = purchase({ account: 'payable', counterparty: 'Bruno' })

    expect(isBalanced(movement)).toBe(true)
    expect(paceByMonth([movement], '2026-11')).toBe(100)
    expect(outstanding([movement], 'payable')).toEqual([{ counterparty: 'Bruno', amount: 100 }])
  })

  test('materializes installments with the remainder first', () => {
    const movements = must(
      buildPurchase({
        id: 'p1',
        date: '2026-01-31',
        description: 'TV',
        amount: 100,
        category: 'Electronics',
        account: 'card',
        installments: 3,
      }),
    )

    expect(movements).toHaveLength(3)
    expect(movements.map((movement) => movement.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
    expect(movements.map((movement) => movementTotal(movement))).toEqual([33.34, 33.33, 33.33])
    expect(movements[1].links).toEqual(['p1'])
    expect(movements.every(isBalanced)).toBe(true)
    expect(paceByMonth(movements, '2026-02')).toBe(33.33)
  })

  test('rejects invalid purchase states', () => {
    expect(
      buildPurchase({
        id: 'p1',
        date: '2026-11-01',
        description: 'Bad',
        amount: 100,
        account: 'card',
        shares: [{ counterparty: 'Ana', amount: 150 }],
      }).ok,
    ).toBe(false)
    expect(
      buildPurchase({
        id: 'p1',
        date: '2026-11-01',
        description: 'Bad',
        amount: 100,
        account: 'payable',
      }).ok,
    ).toBe(false)
    expect(
      buildPurchase({
        id: 'p1',
        date: '2026-11-01',
        description: 'Bad',
        amount: 0,
        account: 'card',
      }).ok,
    ).toBe(false)
  })
})

describe('buildSettlement', () => {
  test('reduces a receivable and records partial payment plus forgiveness', () => {
    const dinner = purchase({ shares: [{ counterparty: 'Ana', amount: 50 }] })
    const settlement = must(
      buildSettlement(
        {
          id: 's1',
          date: '2026-11-10',
          description: 'Ana paid',
          direction: 'receivable',
          counterparty: 'Ana',
          received: 40,
          forgiven: 10,
          account: 'checking',
        },
        [dinner],
      ),
    )

    expect(isBalanced(settlement)).toBe(true)
    expect(outstanding([dinner, settlement], 'receivable')).toEqual([])
    expect(paceByMonth([dinner, settlement], '2026-11')).toBe(50)
    expect(accountBalance([dinner, settlement], 'checking')).toBe(40)
  })

  test('reduces a payable and records payment plus forgiveness', () => {
    const dinner = purchase({ account: 'payable', counterparty: 'Bruno' })
    const settlement = must(
      buildSettlement(
        {
          id: 's1',
          date: '2026-11-10',
          description: 'Paid Bruno',
          direction: 'payable',
          counterparty: 'Bruno',
          paid: 80,
          forgiven: 20,
          account: 'checking',
        },
        [dinner],
      ),
    )

    expect(isBalanced(settlement)).toBe(true)
    expect(outstanding([dinner, settlement], 'payable')).toEqual([])
    expect(paceByMonth([dinner, settlement], '2026-11')).toBe(100)
    expect(accountBalance([dinner, settlement], 'checking')).toBe(-80)
  })

  test('rejects settling more than is outstanding', () => {
    const dinner = purchase({ shares: [{ counterparty: 'Ana', amount: 50 }] })
    const result = buildSettlement(
      {
        id: 's1',
        date: '2026-11-10',
        description: 'Too much',
        direction: 'receivable',
        counterparty: 'Ana',
        received: 60,
        forgiven: 0,
        account: 'checking',
      },
      [dinner],
    )

    expect(result.ok).toBe(false)
  })
})

describe('buildRefund', () => {
  test('nets a refund against the linked purchase', () => {
    const dinner = purchase()
    const refund = must(
      buildRefund({
        id: 'r1',
        date: '2026-11-05',
        description: 'Received back',
        amount: 30,
        account: 'card',
        purchase: dinner,
      }),
    )

    expect(isBalanced(refund)).toBe(true)
    expect(paceByMonth([dinner, refund], '2026-11')).toBe(70)
    expect(refund.links).toEqual(['p1'])
  })

  test('rejects a refund above the remaining linked expense', () => {
    const dinner = purchase()
    const first = must(
      buildRefund({
        id: 'r1',
        date: '2026-11-05',
        description: 'First',
        amount: 80,
        account: 'card',
        purchase: dinner,
      }),
    )
    const second = buildRefund({
      id: 'r2',
      date: '2026-11-06',
      description: 'Second',
      amount: 30,
      account: 'card',
      purchase: dinner,
      existing: [dinner, first],
    })

    expect(second.ok).toBe(false)
  })
})

describe('buildTransfer', () => {
  test('moves value without touching pace', () => {
    const transfer = must(
      buildTransfer({
        id: 't1',
        date: '2026-11-15',
        description: 'Card bill',
        amount: 50,
        from: 'checking',
        to: 'card',
      }),
    )

    expect(isBalanced(transfer)).toBe(true)
    expect(paceByMonth([transfer], '2026-11')).toBe(0)
    expect(accountBalance([transfer], 'checking')).toBe(-50)
    expect(accountBalance([transfer], 'card')).toBe(50)
  })
})

describe('buildIncome', () => {
  test('counts income once and tracks voucher balances', () => {
    const salary = must(
      buildIncome({
        id: 'i1',
        date: '2026-11-01',
        description: 'Salary',
        amount: 5000,
        account: 'checking',
        category: 'Salary',
      }),
    )
    const voucher = must(
      buildIncome({
        id: 'i2',
        date: '2026-11-02',
        description: 'Meal voucher',
        amount: 800,
        account: 'voucher',
        category: 'Voucher',
      }),
    )

    expect(isBalanced(salary)).toBe(true)
    expect(incomeByMonth([salary, voucher], '2026-11')).toBe(5800)
    expect(voucherBalance([salary, voucher])).toBe(800)
    expect(paceByMonth([salary, voucher], '2026-11')).toBe(0)
  })
})

describe('buildAdjustment', () => {
  test('sets an opening balance without adding pace', () => {
    const adjustment = must(
      buildAdjustment({
        id: 'a1',
        date: '2026-11-01',
        description: 'Opening balance',
        account: 'checking',
        amount: 1000,
      }),
    )

    expect(isBalanced(adjustment)).toBe(true)
    expect(accountBalance([adjustment], 'checking')).toBe(1000)
    expect(paceByMonth([adjustment], '2026-11')).toBe(0)
  })
})

describe('selectors', () => {
  const dinner = purchase({
    date: '2026-11-01',
    amount: 100,
    category: 'Food',
    shares: [{ counterparty: 'Ana', amount: 50 }],
  })
  const other = purchase({
    id: 'p2',
    date: '2026-11-02',
    amount: 40,
    category: 'Transport',
    account: 'voucher',
  })
  const salary = must(
    buildIncome({
      id: 'i1',
      date: '2026-11-01',
      description: 'Salary',
      amount: 1000,
      account: 'checking',
      category: 'Salary',
    }),
  )
  const refund = must(
    buildRefund({
      id: 'r1',
      date: '2026-11-03',
      description: 'Received back',
      amount: 20,
      account: 'card',
      purchase: dinner,
    }),
  )
  const movements = [dinner, other, salary, refund]

  test('aggregates category, account, month, and year values', () => {
    expect(categoryTotals(movements, '2026-11')).toEqual({ Food: 30, Transport: 40 })
    expect(expensesByAccount(movements, '2026-11')).toEqual({ card: 30, voucher: 40 })
    expect(availableMonths(movements)).toEqual(['2026-11'])
    expect(yearSummary(movements, 2026).totalExpenses).toBe(70)
    expect(yearSummary(movements, 2026).totalIncome).toBe(1000)
  })

  test('projects future expense movements', () => {
    const future = must(
      buildPurchase({
        id: 'p3',
        date: '2026-11-20',
        description: 'Laptop',
        amount: 300,
        category: 'Electronics',
        account: 'card',
        installments: 2,
      }),
    )

    const commitments = futureCommitments(future, 2)
    expect(commitments[0].referenceMonth).toBe(currentYM())
    expect(commitments[0].total).toBe(150)
    expect(commitments[1].total).toBe(150)
  })

  test('compares budget with pace by category', () => {
    const budget: Budget = {
      referenceMonth: '2026-11',
      plannedIncome: 1000,
      plannedMealVoucher: 0,
      investmentRate: 0,
      categoryLimits: { Food: 80, Transport: 50 },
    }

    expect(budgetVsActual(movements, budget)).toEqual([
      { category: 'Food', budgeted: 80, actual: 30 },
      { category: 'Transport', budgeted: 50, actual: 40 },
    ])
  })

  test('computes pace from expense postings and refunds on their dates', () => {
    const budget: Budget = {
      referenceMonth: '2026-11',
      plannedIncome: 1000,
      plannedMealVoucher: 0,
      investmentRate: 0,
      categoryLimits: {},
    }

    const pace = spendingPace(movements, budget, 10)
    expect(pace.spentSoFar).toBe(70)
    expect(pace.remainingBudget).toBe(930)
    expect(pace.limit).toBe(1000)
  })

  test('keeps debt provenance per source movement', () => {
    const dinner = purchase({
      id: 'p1',
      date: '2026-11-01',
      amount: 100,
      shares: [
        { counterparty: 'Ana', amount: 50 },
        { counterparty: 'Bob', amount: 30 },
      ],
    })
    const settlement = must(
      buildSettlement(
        {
          id: 's1',
          date: '2026-11-10',
          description: 'Ana paid',
          direction: 'receivable',
          counterparty: 'Ana',
          received: 40,
          forgiven: 0,
          account: 'checking',
        },
        [dinner],
      ),
    )

    const rows = outstandingMovements([dinner, settlement], 'receivable')
    expect(rows).toEqual([
      {
        movementId: 'p1',
        counterparty: 'Ana',
        direction: 'receivable',
        description: 'Dinner',
        date: '2026-11-01',
        total: 50,
        settled: 40,
        outstanding: 10,
      },
      {
        movementId: 'p1',
        counterparty: 'Bob',
        direction: 'receivable',
        description: 'Dinner',
        date: '2026-11-01',
        total: 30,
        settled: 0,
        outstanding: 30,
      },
    ])
  })

  test('allocates a linked settlement to the chosen purchase first', () => {
    const first = purchase({
      id: 'p1',
      date: '2026-11-01',
      description: 'First',
      shares: [{ counterparty: 'Ana', amount: 50 }],
    })
    const second = purchase({
      id: 'p2',
      date: '2026-11-02',
      description: 'Second',
      shares: [{ counterparty: 'Ana', amount: 50 }],
    })
    const settlement = must(
      buildSettlement(
        {
          id: 's1',
          date: '2026-11-03',
          description: 'Ana paid second',
          direction: 'receivable',
          counterparty: 'Ana',
          received: 50,
          forgiven: 0,
          account: 'checking',
          links: ['p2'],
        },
        [first, second],
      ),
    )

    const rows = outstandingMovements([first, second, settlement], 'receivable')
    expect(rows.find((row) => row.movementId === 'p1')?.outstanding).toBe(50)
    expect(rows.find((row) => row.movementId === 'p2')?.outstanding).toBe(0)
  })

  test('keeps payable provenance through partial payment and forgiveness', () => {
    const dinner = purchase({
      id: 'p1',
      account: 'payable',
      counterparty: 'Bruno',
    })
    const settlement = must(
      buildSettlement(
        {
          id: 's1',
          date: '2026-11-10',
          description: 'Paid Bruno',
          direction: 'payable',
          counterparty: 'Bruno',
          paid: 80,
          forgiven: 20,
          account: 'checking',
        },
        [dinner],
      ),
    )

    expect(outstandingMovements([dinner, settlement], 'payable')).toEqual([
      {
        movementId: 'p1',
        counterparty: 'Bruno',
        direction: 'payable',
        description: 'Dinner',
        date: '2026-11-01',
        total: 100,
        settled: 100,
        outstanding: 0,
      },
    ])
  })
})
