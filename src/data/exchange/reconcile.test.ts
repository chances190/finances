import { describe, expect, test } from 'bun:test'
import { buildIncome, buildPurchase, type Movement } from '../../domain/ledger'
import { buildImportCommit, planImport } from './reconcile'

function purchase(overrides: Partial<Parameters<typeof buildPurchase>[0]> = {}): Movement {
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

function income(id: string): Movement {
  const result = buildIncome({
    id,
    date: '2026-11-01',
    description: 'Salary',
    amount: 100,
    account: 'checking',
    category: 'Income',
  })
  if (!result.ok) throw new Error(result.reason)
  return result.value
}

describe('planImport', () => {
  test('defaults a single date and amount match to link', () => {
    const existing = purchase({ id: 'e1', importId: 'old' })
    const incoming = purchase({ id: 'i1', description: 'Statement', importId: 'new' })

    const [plan] = planImport([incoming], [existing])

    expect(plan).toMatchObject({
      movement: incoming,
      candidates: [existing],
      action: 'link',
      targetId: 'e1',
    })
  })

  test('keeps new purchases and non-purchases', () => {
    const incoming = purchase({ id: 'i1' })
    const salary = income('i2')

    const [newPurchase, incomePlan] = planImport([incoming, salary], [])

    expect(newPurchase).toMatchObject({ candidates: [], action: 'keep', targetId: null })
    expect(incomePlan).toMatchObject({ candidates: [], action: 'keep', targetId: null })
  })

  test('blocks on more than one candidate until the user chooses', () => {
    const incoming = purchase({ id: 'i1' })
    const existing = [
      purchase({ id: 'e1', description: 'Dinner A' }),
      purchase({ id: 'e2', description: 'Dinner B' }),
    ]

    const [plan] = planImport([incoming], existing)

    expect(plan).toMatchObject({ candidates: existing, action: null, targetId: null })
  })

  test('matches duplicate rows within the same batch', () => {
    const first = purchase({ id: 'i1', importId: 'a' })
    const second = purchase({ id: 'i2', importId: 'b' })

    const plans = planImport([first, second], [])

    expect(plans[1]).toMatchObject({ candidates: [first], action: 'link', targetId: 'i1' })
  })
})

describe('buildImportCommit', () => {
  test('link attaches the new importId to the existing movement', () => {
    const existing = purchase({ id: 'e1', importId: 'old' })
    const incoming = purchase({ id: 'i1', importId: 'new' })

    const commit = buildImportCommit(planImport([incoming], [existing]), [existing])

    expect(commit).toEqual({
      additions: [],
      updates: [{ ...existing, importId: 'new' }],
      unresolved: 0,
    })
  })

  test('link without an incoming importId leaves the existing movement alone', () => {
    const existing = purchase({ id: 'e1', importId: 'old' })
    const incoming = purchase({ id: 'i1' })

    const commit = buildImportCommit(planImport([incoming], [existing]), [existing])

    expect(commit.additions).toHaveLength(0)
    expect(commit.updates).toHaveLength(0)
  })

  test('overwrite replaces the existing movement and keeps its links', () => {
    const existing = { ...purchase({ id: 'e1', importId: 'old' }), links: ['root'] }
    const incoming = purchase({ id: 'i1', description: 'Statement', importId: 'new' })

    const plans = planImport([incoming], [existing])
    plans[0].action = 'overwrite'
    const commit = buildImportCommit(plans, [existing])

    expect(commit.additions).toHaveLength(0)
    expect(commit.updates).toEqual([{ ...incoming, id: 'e1', links: ['root'] }])
  })

  test('keep adds the imported movement', () => {
    const incoming = purchase({ id: 'i1' })

    const commit = buildImportCommit(planImport([incoming], []), [])

    expect(commit.additions).toEqual([incoming])
    expect(commit.updates).toHaveLength(0)
  })

  test('counts unresolved matches and emits nothing for them', () => {
    const incoming = purchase({ id: 'i1' })
    const existing = [purchase({ id: 'e1' }), purchase({ id: 'e2' })]

    const commit = buildImportCommit(planImport([incoming], existing), existing)

    expect(commit).toEqual({ additions: [], updates: [], unresolved: 1 })
  })

  test('collapses duplicate batch rows into the first addition', () => {
    const first = purchase({ id: 'i1', importId: 'a' })
    const second = purchase({ id: 'i2', importId: 'b' })

    const commit = buildImportCommit(planImport([first, second], []), [])

    expect(commit.additions).toEqual([{ ...first, importId: 'b' }])
    expect(commit.updates).toHaveLength(0)
    expect(commit.unresolved).toBe(0)
  })
})
