import { describe, expect, test } from 'bun:test'
import type { ExpenseTransaction, IncomeTransaction } from '../../domain/entities'
import { buildImportCommit, planImport } from './reconcile'

function expense(overrides: Partial<ExpenseTransaction> & Pick<ExpenseTransaction, 'id'>) {
  return {
    type: 'Expense',
    date: '2026-11-01',
    description: 'Market',
    amount: 100,
    category: 'Food',
    paymentMethod: 'Credit',
    ...overrides,
  } satisfies ExpenseTransaction
}

function income(overrides: Partial<IncomeTransaction> & Pick<IncomeTransaction, 'id'>) {
  return {
    type: 'Income',
    date: '2026-11-01',
    description: 'Salary',
    amount: 100,
    category: 'Income',
    paymentMethod: 'Salary',
    ...overrides,
  } satisfies IncomeTransaction
}

describe('planImport', () => {
  test('defaults a single date and amount match to adopt', () => {
    const existing = expense({ id: 'e1', importId: 'old' })
    const incoming = expense({ id: 'i1', description: 'Market statement', importId: 'new' })

    const [plan] = planImport([incoming], [existing])

    expect(plan).toMatchObject({
      transaction: incoming,
      candidates: [existing],
      action: 'adopt',
      targetId: 'e1',
    })
  })

  test('keeps new rows as additions', () => {
    const incoming = expense({ id: 'i1' })

    const [plan] = planImport([incoming], [])

    expect(plan).toMatchObject({ candidates: [], action: 'keep both', targetId: null })
  })

  test('blocks on more than one candidate until the user chooses', () => {
    const incoming = expense({ id: 'i1' })
    const existing = [
      expense({ id: 'e1', description: 'Market A' }),
      expense({ id: 'e2', description: 'Market B' }),
    ]

    const [plan] = planImport([incoming], existing)

    expect(plan).toMatchObject({ candidates: existing, action: null, targetId: null })
  })

  test('does not match income transactions', () => {
    const existing = income({ id: 'e1' })
    const incoming = income({ id: 'i1' })

    const [plan] = planImport([incoming], [existing])

    expect(plan).toMatchObject({ candidates: [], action: 'keep both', targetId: null })
  })

  test('matches duplicate rows within the same batch', () => {
    const first = expense({ id: 'i1', importId: 'a' })
    const second = expense({ id: 'i2', importId: 'b' })

    const plans = planImport([first, second], [])

    expect(plans[1]).toMatchObject({
      candidates: [first],
      action: 'adopt',
      targetId: 'i1',
    })
  })
})

describe('buildImportCommit', () => {
  test('adopt keeps existing fields and replaces the importId', () => {
    const existing = expense({ id: 'e1', importId: 'old', description: 'Manual name' })
    const incoming = expense({ id: 'i1', importId: 'new', description: 'Statement name' })

    const commit = buildImportCommit(
      [{ transaction: incoming, candidates: [existing], action: 'adopt', targetId: 'e1' }],
      [existing],
    )

    expect(commit).toEqual({
      additions: [],
      updates: [{ ...existing, importId: 'new' }],
      unresolved: 0,
    })
  })

  test('adopt without an incoming importId leaves the existing row untouched', () => {
    const existing = expense({ id: 'e1', importId: 'old' })
    const incoming = expense({ id: 'i1' })

    const commit = buildImportCommit(
      [{ transaction: incoming, candidates: [existing], action: 'adopt', targetId: 'e1' }],
      [existing],
    )

    expect(commit.additions).toHaveLength(0)
    expect(commit.updates).toHaveLength(0)
  })

  test('overwrite replaces every field and wipes debts and installments', () => {
    const existing = expense({
      id: 'e1',
      description: 'Old',
      installments: 3,
      debts: [{ name: 'Ana', amount: 20, settled: false }],
    })
    const incoming = expense({ id: 'i1', description: 'New' })

    const commit = buildImportCommit(
      [{ transaction: incoming, candidates: [existing], action: 'overwrite', targetId: 'e1' }],
      [existing],
    )

    expect(commit.updates).toEqual([{ ...incoming, id: 'e1' }])
    expect(commit.updates[0]).not.toHaveProperty('debts')
    expect(commit.updates[0]).not.toHaveProperty('installments')
  })

  test('keep both adds a new row even when a match exists', () => {
    const existing = expense({ id: 'e1' })
    const incoming = expense({ id: 'i1' })

    const commit = buildImportCommit(
      [{ transaction: incoming, candidates: [existing], action: 'keep both', targetId: null }],
      [existing],
    )

    expect(commit.additions).toEqual([incoming])
    expect(commit.updates).toHaveLength(0)
  })

  test('counts unresolved plans and emits nothing for them', () => {
    const incoming = expense({ id: 'i1' })
    const existing = [expense({ id: 'e1' }), expense({ id: 'e2' })]

    const commit = buildImportCommit(planImport([incoming], existing), existing)

    expect(commit).toEqual({ additions: [], updates: [], unresolved: 1 })
  })

  test('reserved conflicts stay blocked when an action has no target', () => {
    const incoming = expense({ id: 'i1' })
    const existing = [expense({ id: 'e1' }), expense({ id: 'e2' })]

    const commit = buildImportCommit(
      [{ transaction: incoming, candidates: existing, action: 'overwrite', targetId: null }],
      existing,
    )

    expect(commit).toEqual({ additions: [], updates: [], unresolved: 1 })
  })

  test('collapses duplicate batch rows into a single addition', () => {
    const first = expense({ id: 'i1', importId: 'a' })
    const second = expense({ id: 'i2', importId: 'b' })
    const plans = planImport([first, second], [])

    const commit = buildImportCommit(plans, [])

    expect(commit.additions).toEqual([{ ...first, importId: 'b' }])
    expect(commit.updates).toHaveLength(0)
    expect(commit.unresolved).toBe(0)
  })

  test('overwriting an earlier batch addition keeps its id', () => {
    const first = expense({ id: 'i1', description: 'First' })
    const second = expense({ id: 'i2', description: 'Second' })
    const planned = planImport([first, second], [])
    planned[1] = { ...planned[1], action: 'overwrite', targetId: 'i1' }

    const commit = buildImportCommit(planned, [])

    expect(commit.additions).toEqual([{ ...second, id: 'i1' }])
    expect(commit.unresolved).toBe(0)
  })
})
