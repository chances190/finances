import type { Transaction } from '../../domain/entities'

export type MatchAction = 'adopt' | 'overwrite' | 'keep both'

export interface ImportPlan {
  transaction: Transaction
  candidates: Transaction[]
  action: MatchAction | null
  targetId: string | null
}

export interface ImportCommit {
  additions: Transaction[]
  updates: Transaction[]
  unresolved: number
}

function matchKey(transaction: Transaction): string {
  return `${transaction.date}|${transaction.amount.toFixed(2)}`
}

function pushCandidate(map: Map<string, Transaction[]>, transaction: Transaction): void {
  const key = matchKey(transaction)
  const list = map.get(key)
  if (list) list.push(transaction)
  else map.set(key, [transaction])
}

export function planImport(incoming: Transaction[], existing: Transaction[]): ImportPlan[] {
  const byKey = new Map<string, Transaction[]>()
  for (const transaction of existing) {
    if (transaction.type === 'Expense') pushCandidate(byKey, transaction)
  }

  const plans: ImportPlan[] = []
  for (const transaction of incoming) {
    if (transaction.type !== 'Expense') {
      plans.push({ transaction, candidates: [], action: 'keep both', targetId: null })
      continue
    }

    const candidates = byKey.get(matchKey(transaction)) ?? []
    if (candidates.length === 0) {
      plans.push({ transaction, candidates, action: 'keep both', targetId: null })
      pushCandidate(byKey, transaction)
      continue
    }
    if (candidates.length === 1) {
      plans.push({ transaction, candidates, action: 'adopt', targetId: candidates[0].id })
      continue
    }
    plans.push({ transaction, candidates, action: null, targetId: null })
  }

  return plans
}

export function buildImportCommit(plans: ImportPlan[], existing: Transaction[]): ImportCommit {
  const byId = new Map(existing.map((transaction) => [transaction.id, transaction]))
  const additions: Transaction[] = []
  const additionById = new Map<string, Transaction>()
  const updates: Transaction[] = []
  let unresolved = 0

  function upsertAddition(transaction: Transaction): void {
    const index = additions.findIndex((addition) => addition.id === transaction.id)
    if (index >= 0) additions[index] = transaction
    else additions.push(transaction)
    additionById.set(transaction.id, transaction)
  }

  for (const plan of plans) {
    const { action, targetId, transaction } = plan
    if (action === null) {
      unresolved += 1
      continue
    }
    if (action === 'keep both') {
      upsertAddition(transaction)
      continue
    }
    if (targetId === null) {
      unresolved += 1
      continue
    }

    const existingTarget = byId.get(targetId)
    const additionTarget = existingTarget ? undefined : additionById.get(targetId)
    if (!existingTarget && !additionTarget) {
      upsertAddition(transaction)
      continue
    }

    if (action === 'overwrite') {
      const next = { ...transaction, id: targetId }
      if (existingTarget) updates.push(next)
      else upsertAddition(next)
      continue
    }

    // Adopt keeps the target record and only refreshes its importId; the
    // previous file's dedupe link is intentionally dropped.
    const target = existingTarget ?? additionTarget
    if (target && transaction.importId && target.importId !== transaction.importId) {
      const next = { ...target, importId: transaction.importId }
      if (existingTarget) updates.push(next)
      else upsertAddition(next)
    }
  }

  return { additions, updates, unresolved }
}
