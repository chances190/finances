import { describe, expect, test } from 'bun:test'
import { buildPurchase, expenseAmount } from '../domain/ledger'
import { validateLedgerData, validateMovement } from './ledgerValidation'

function purchase(overrides: Partial<Parameters<typeof buildPurchase>[0]> = {}) {
  const result = buildPurchase({
    id: 'p1',
    date: '2026-11-01',
    description: 'Dinner',
    amount: 100,
    category: 'Food',
    account: 'card',
    ...overrides,
  })
  if (!result.ok) throw new Error(result.reason)
  return result.value[0]
}

describe('validateMovement', () => {
  test('accepts a balanced purchase', () => {
    expect(validateMovement(purchase()).ok).toBe(true)
  })

  test('rejects unbalanced postings', () => {
    const result = validateMovement({
      id: 'p1',
      date: '2026-11-01',
      kind: 'purchase',
      description: 'Bad',
      postings: [
        { account: 'expense', amount: 100 },
        { account: 'card', amount: -50 },
      ],
    })

    expect(result.ok).toBe(false)
  })

  test('rejects unknown accounts and zero postings', () => {
    expect(
      validateMovement({
        id: 'p1',
        date: '2026-11-01',
        kind: 'purchase',
        description: 'Bad',
        postings: [
          { account: 'salary', amount: 100 },
          { account: 'adjustment', amount: -100 },
        ],
      }).ok,
    ).toBe(false)

    expect(
      validateMovement({
        id: 'p1',
        date: '2026-11-01',
        kind: 'purchase',
        description: 'Bad',
        postings: [{ account: 'expense', amount: 0 }],
      }).ok,
    ).toBe(false)
  })
})

describe('validateLedgerData', () => {
  test('skips duplicate importIds', () => {
    const first = purchase({ id: 'p1', importId: 'csv:1' })
    const second = purchase({ id: 'p2', importId: 'csv:1' })

    const result = validateLedgerData({ movements: [first, second], budgets: [] })

    expect(result.data.movements).toHaveLength(1)
    expect(result.skippedMovements).toHaveLength(1)
    expect(result.skippedMovements[0].index).toBe(1)
  })

  test('accepts an unlinked card credit as a refund', () => {
    const result = validateLedgerData({
      movements: [
        {
          id: 'r1',
          date: '2026-11-02',
          kind: 'refund',
          description: 'Card credit',
          postings: [
            { account: 'expense', amount: -25, category: 'Other' },
            { account: 'card', amount: 25 },
          ],
        },
      ],
      budgets: [],
    })

    expect(result.data.movements).toHaveLength(1)
    expect(result.skippedMovements).toEqual([])
    expect(expenseAmount(result.data.movements[0])).toBe(-25)
  })

  test('skips a refund above the linked purchase', () => {
    const dinner = purchase({ amount: 100 })
    const refund = {
      id: 'r1',
      date: '2026-11-02',
      kind: 'refund',
      description: 'Too much',
      postings: [
        { account: 'expense', amount: -150, category: 'Food' },
        { account: 'card', amount: 150 },
      ],
      links: ['p1'],
    }

    const result = validateLedgerData({ movements: [dinner, refund], budgets: [] })

    expect(result.data.movements).toEqual([dinner])
  })

  test('skips a settlement above the outstanding relation', () => {
    const dinner = purchase({ shares: [{ counterparty: 'Ana', amount: 50 }] })
    const settlement = {
      id: 's1',
      date: '2026-11-02',
      kind: 'settlement',
      description: 'Too much',
      postings: [
        { account: 'receivable', amount: -60, counterparty: 'Ana' },
        { account: 'checking', amount: 60 },
      ],
    }

    const result = validateLedgerData({ movements: [dinner, settlement], budgets: [] })

    expect(result.data.movements).toEqual([dinner])
  })

  test('skips malformed budgets while keeping valid ones', () => {
    const result = validateLedgerData({
      movements: [purchase()],
      budgets: [
        {
          referenceMonth: '2026-11',
          plannedIncome: 1000,
          plannedMealVoucher: 0,
          investmentRate: 0,
          categoryLimits: { Food: 100 },
        },
        { referenceMonth: 'bad' },
      ],
    })

    expect(result.data.budgets).toHaveLength(1)
    expect(result.skippedBudgets).toBe(1)
  })
})
