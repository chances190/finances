import type { Budget } from '../domain/entities'
import {
  ACCOUNTS,
  type Account,
  CASH_ACCOUNTS,
  type CashAccount,
  expenseAmount,
  INCOME_PAYMENT_METHODS,
  type IncomePaymentMethod,
  isBalanced,
  isIsoDate,
  type LedgerData,
  MOVEMENT_KINDS,
  type Movement,
  type MovementKind,
  refundAmount,
} from '../domain/ledger'
import { parseBudget } from './validation'

const TRANSFER_ACCOUNTS: Account[] = ['checking', 'card', 'voucher', 'cash']
const EPSILON = 0.004

export interface LedgerValidationResult {
  data: LedgerData
  skippedMovements: { index: number; reason: string }[]
  skippedBudgets: number
}

export type LoadedMovement = { ok: true; movement: Movement } | { ok: false; reason: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonZeroFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0
}

function validateKind(movement: Movement): string | null {
  switch (movement.kind) {
    case 'purchase':
      if (
        !movement.postings.some(
          (posting) => posting.account === 'expense' || posting.account === 'receivable',
        )
      ) {
        return 'purchase needs an expense or receivable posting'
      }
      if (
        !movement.postings.some(
          (posting) =>
            (posting.account === 'checking' ||
              posting.account === 'card' ||
              posting.account === 'voucher' ||
              posting.account === 'cash' ||
              posting.account === 'payable') &&
            posting.amount < 0,
        )
      ) {
        return 'purchase needs a funding posting'
      }
      return null
    case 'income':
      if (
        !movement.postings.some((posting) => posting.account === 'income' && posting.amount < 0)
      ) {
        return 'income needs a negative income posting'
      }
      if (
        !movement.postings.some(
          (posting) => CASH_ACCOUNTS.includes(posting.account as CashAccount) && posting.amount > 0,
        )
      ) {
        return 'income needs a cash posting'
      }
      return null
    case 'transfer': {
      if (movement.postings.length !== 2) return 'transfer needs exactly two postings'
      const [a, b] = movement.postings
      if (!TRANSFER_ACCOUNTS.includes(a.account) || !TRANSFER_ACCOUNTS.includes(b.account)) {
        return 'transfer accounts are invalid'
      }
      if (a.account === b.account) return 'transfer accounts must differ'
      if (a.amount * b.amount >= 0) return 'transfer postings must have opposite signs'
      return null
    }
    case 'refund':
      if (
        !movement.postings.some((posting) => posting.account === 'expense' && posting.amount < 0)
      ) {
        return 'refund needs a negative expense posting'
      }
      if (
        !movement.postings.some(
          (posting) =>
            posting.account === 'checking' ||
            posting.account === 'card' ||
            posting.account === 'voucher' ||
            posting.account === 'cash' ||
            (posting.account === 'payable' && posting.amount > 0),
        )
      ) {
        return 'refund needs a receiving posting'
      }
      return null
    case 'settlement':
      if (
        !movement.postings.some(
          (posting) => posting.account === 'receivable' || posting.account === 'payable',
        )
      ) {
        return 'settlement needs a receivable or payable posting'
      }
      if (
        !movement.postings.some(
          (posting) =>
            posting.account === 'forgiveness' ||
            CASH_ACCOUNTS.includes(posting.account as CashAccount),
        )
      ) {
        return 'settlement needs a cash or forgiveness posting'
      }
      return null
    case 'adjustment':
      if (!movement.postings.some((posting) => posting.account === 'adjustment')) {
        return 'adjustment needs an adjustment posting'
      }
      if (!movement.postings.some((posting) => posting.account !== 'adjustment')) {
        return 'adjustment needs an account posting'
      }
      return null
  }
}

export function validateMovement(value: unknown): LoadedMovement {
  if (!isObject(value)) return { ok: false, reason: 'movement is not an object' }
  if (typeof value.id !== 'string' || value.id.trim() === '') {
    return { ok: false, reason: 'missing or invalid id' }
  }
  if (typeof value.date !== 'string' || !isIsoDate(value.date)) {
    return { ok: false, reason: 'date must be a valid YYYY-MM-DD date' }
  }
  if (typeof value.kind !== 'string' || !MOVEMENT_KINDS.includes(value.kind as MovementKind)) {
    return { ok: false, reason: `invalid movement kind: "${String(value.kind)}"` }
  }
  if (typeof value.description !== 'string' || value.description.trim() === '') {
    return { ok: false, reason: 'description must be a non-empty string' }
  }
  if (value.importId != null && typeof value.importId !== 'string') {
    return { ok: false, reason: 'importId must be a string' }
  }
  if (
    value.kind === 'income' &&
    value.method != null &&
    (typeof value.method !== 'string' ||
      !INCOME_PAYMENT_METHODS.includes(value.method as IncomePaymentMethod))
  ) {
    return { ok: false, reason: `invalid payment method: "${String(value.method)}"` }
  }
  if (value.links != null) {
    if (!Array.isArray(value.links) || value.links.some((link) => typeof link !== 'string')) {
      return { ok: false, reason: 'links must be an array of movement ids' }
    }
  }
  if (!Array.isArray(value.postings) || value.postings.length === 0) {
    return { ok: false, reason: 'postings must be a non-empty array' }
  }

  const postings: Movement['postings'] = []
  for (const entry of value.postings) {
    if (!isObject(entry)) return { ok: false, reason: 'posting is not an object' }
    if (typeof entry.account !== 'string' || !ACCOUNTS.includes(entry.account as Account)) {
      return { ok: false, reason: `invalid account: "${String(entry.account)}"` }
    }
    if (!isNonZeroFinite(entry.amount)) {
      return { ok: false, reason: 'posting amount must be a non-zero number' }
    }
    if (entry.category != null && (typeof entry.category !== 'string' || !entry.category.trim())) {
      return { ok: false, reason: 'posting category must be a non-empty string' }
    }
    if (
      entry.counterparty != null &&
      (typeof entry.counterparty !== 'string' || !entry.counterparty.trim())
    ) {
      return { ok: false, reason: 'posting counterparty must be a non-empty string' }
    }
    postings.push({
      account: entry.account as Account,
      amount: entry.amount,
      ...(entry.category ? { category: entry.category } : {}),
      ...(entry.counterparty ? { counterparty: entry.counterparty } : {}),
    })
  }

  const movement: Movement = {
    id: value.id,
    date: value.date,
    kind: value.kind as MovementKind,
    description: value.description.trim(),
    postings,
    ...(value.kind === 'income' && value.method
      ? { method: value.method as IncomePaymentMethod }
      : {}),
    ...(value.importId ? { importId: value.importId } : {}),
    ...(Array.isArray(value.links) && value.links.length > 0 ? { links: value.links } : {}),
  }

  if (!isBalanced(movement)) return { ok: false, reason: 'postings do not balance' }
  const kindError = validateKind(movement)
  if (kindError) return { ok: false, reason: kindError }

  return { ok: true, movement }
}

function validateRelations(movements: Movement[]): Set<string> {
  const skipped = new Set<string>()
  const byId = new Map(movements.map((movement) => [movement.id, movement]))
  const refunded = new Map<string, number>()

  for (const movement of movements) {
    if (movement.kind !== 'refund') continue
    const links = movement.links ?? []
    // OFX card credits cannot identify the original purchase; standalone refunds are valid.
    if (links.length === 0) continue
    const link = links.map((id) => byId.get(id)).find((linked) => linked?.kind === 'purchase')
    if (!link) {
      skipped.add(movement.id)
      continue
    }
    const amount = refundAmount(movement)
    const used = refunded.get(link.id) ?? 0
    if (used + amount - expenseAmount(link) > EPSILON) {
      skipped.add(movement.id)
      continue
    }
    refunded.set(link.id, used + amount)
  }

  const balances = new Map<string, number>()
  const ordered = movements
    .filter((movement) => !skipped.has(movement.id))
    .map((movement, index) => ({ movement, index }))
    .sort((a, b) => a.movement.date.localeCompare(b.movement.date) || a.index - b.index)

  for (const { movement } of ordered) {
    for (const posting of movement.postings) {
      if (posting.account !== 'receivable' && posting.account !== 'payable') continue
      const key = `${posting.account}:${posting.counterparty ?? ''}`
      const next = (balances.get(key) ?? 0) + Math.round(posting.amount * 100)
      if (posting.account === 'receivable' && next < -1) {
        skipped.add(movement.id)
        continue
      }
      if (posting.account === 'payable' && next > 1) {
        skipped.add(movement.id)
        continue
      }
      balances.set(key, next)
    }
  }

  return skipped
}

export function validateLedgerData(value: unknown): LedgerValidationResult {
  if (!isObject(value)) throw new Error('Invalid ledger data: expected an object')
  if (!Array.isArray(value.movements)) {
    throw new Error('Invalid ledger data: movements must be an array')
  }
  if (!Array.isArray(value.budgets)) {
    throw new Error('Invalid ledger data: budgets must be an array')
  }

  const movements: Movement[] = []
  const skippedMovements: { index: number; reason: string }[] = []
  const seenIds = new Set<string>()
  const seenImportIds = new Set<string>()

  for (let index = 0; index < value.movements.length; index++) {
    const result = validateMovement(value.movements[index])
    if (!result.ok) {
      skippedMovements.push({ index, reason: result.reason })
      continue
    }
    if (seenIds.has(result.movement.id)) {
      skippedMovements.push({ index, reason: 'duplicate movement id' })
      continue
    }
    if (result.movement.importId && seenImportIds.has(result.movement.importId)) {
      skippedMovements.push({ index, reason: 'already imported' })
      continue
    }
    seenIds.add(result.movement.id)
    if (result.movement.importId) seenImportIds.add(result.movement.importId)
    movements.push(result.movement)
  }

  const relationSkips = validateRelations(movements)
  const valid = movements.filter((movement) => !relationSkips.has(movement.id))

  for (const id of relationSkips) {
    const index = movements.findIndex((movement) => movement.id === id)
    skippedMovements.push({ index, reason: 'invalid relation' })
  }
  skippedMovements.sort((a, b) => a.index - b.index)

  const budgets: Budget[] = []
  let skippedBudgets = 0
  for (const entry of value.budgets) {
    const budget = parseBudget(entry)
    if (budget) budgets.push(budget)
    else skippedBudgets += 1
  }

  return {
    data: { movements: valid, budgets },
    skippedMovements,
    skippedBudgets,
  }
}
