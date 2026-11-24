import { grossPurchaseAmount, type Movement } from '../../domain/ledger'

export type MatchAction = 'link' | 'overwrite' | 'keep'

export interface ImportPlan {
  movement: Movement
  candidates: Movement[]
  action: MatchAction | null
  targetId: string | null
}

export interface ImportCommit {
  additions: Movement[]
  updates: Movement[]
  unresolved: number
}

function matchKey(movement: Movement): string {
  return `${movement.date}|${grossPurchaseAmount(movement).toFixed(2)}`
}

export function planImport(incoming: Movement[], existing: Movement[]): ImportPlan[] {
  const byKey = new Map<string, Movement[]>()
  for (const movement of existing) {
    if (movement.kind !== 'purchase') continue
    const key = matchKey(movement)
    const list = byKey.get(key)
    if (list) list.push(movement)
    else byKey.set(key, [movement])
  }

  const plans: ImportPlan[] = []
  for (const movement of incoming) {
    if (movement.kind !== 'purchase') {
      plans.push({ movement, candidates: [], action: 'keep', targetId: null })
      continue
    }

    const candidates = byKey.get(matchKey(movement)) ?? []
    if (candidates.length === 0) {
      plans.push({ movement, candidates, action: 'keep', targetId: null })
      const key = matchKey(movement)
      const list = byKey.get(key)
      if (list) list.push(movement)
      else byKey.set(key, [movement])
      continue
    }
    if (candidates.length === 1) {
      plans.push({ movement, candidates, action: 'link', targetId: candidates[0].id })
      continue
    }
    plans.push({ movement, candidates, action: null, targetId: null })
  }

  return plans
}

export function isBlocked(plan: ImportPlan): boolean {
  return plan.action === null || (plan.action === 'link' && plan.targetId === null)
}

export function buildImportCommit(plans: ImportPlan[], existing: Movement[]): ImportCommit {
  const byId = new Map(existing.map((movement) => [movement.id, movement]))
  const additions: Movement[] = []
  const additionById = new Map<string, Movement>()
  const updates: Movement[] = []
  let unresolved = 0

  function upsertAddition(movement: Movement): void {
    const index = additions.findIndex((addition) => addition.id === movement.id)
    if (index >= 0) additions[index] = movement
    else additions.push(movement)
    additionById.set(movement.id, movement)
  }

  for (const plan of plans) {
    if (plan.action === null) {
      unresolved += 1
      continue
    }
    if (plan.action === 'keep') {
      upsertAddition(plan.movement)
      continue
    }
    if (plan.targetId === null) {
      unresolved += 1
      continue
    }

    const existingTarget = byId.get(plan.targetId)
    const additionTarget = existingTarget ? undefined : additionById.get(plan.targetId)
    if (!existingTarget && !additionTarget) {
      upsertAddition(plan.movement)
      continue
    }

    const target = existingTarget ?? additionTarget
    if (plan.action === 'overwrite') {
      // Links are preserved so an installment plan keeps its root/sibling wiring.
      const next = { ...plan.movement, id: plan.targetId, links: target?.links }
      if (existingTarget) updates.push(next)
      else upsertAddition(next)
      continue
    }

    if (target && plan.movement.importId && target.importId !== plan.movement.importId) {
      const next = { ...target, importId: plan.movement.importId }
      if (existingTarget) updates.push(next)
      else upsertAddition(next)
    }
  }

  return { additions, updates, unresolved }
}
