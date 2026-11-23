import { addCurrency } from '../lib/currency'
import { SES_ALPHA } from './constants'
import type { Budget } from './entities'

export const ACCOUNTS = [
  'checking',
  'card',
  'voucher',
  'cash',
  'receivable',
  'payable',
  'income',
  'expense',
  'forgiveness',
  'adjustment',
] as const
export type Account = (typeof ACCOUNTS)[number]

export const FUNDING_ACCOUNTS = ['checking', 'card', 'voucher', 'cash', 'payable'] as const
export type FundingAccount = (typeof FUNDING_ACCOUNTS)[number]

export const CASH_ACCOUNTS = ['checking', 'voucher', 'cash'] as const
export type CashAccount = (typeof CASH_ACCOUNTS)[number]

export const ACCOUNT_LABELS: Record<Account, string> = {
  checking: 'Bank account',
  card: 'Credit card',
  voucher: 'Voucher',
  cash: 'Cash',
  receivable: 'Owed to you',
  payable: 'You owe',
  income: 'Income',
  expense: 'Expense',
  forgiveness: 'Forgiven',
  adjustment: 'Adjustment',
}

export const ACCOUNT_COLORS: Record<Account, string> = {
  checking: '#32BCAD',
  card: '#820AD1',
  voucher: '#FF2D6F',
  cash: '#0ea5e9',
  receivable: '#22c55e',
  payable: '#f59e0b',
  income: '#22c55e',
  expense: '#ef4444',
  forgiveness: '#8b5cf6',
  adjustment: '#64748b',
}

export const MOVEMENT_KINDS = [
  'purchase',
  'income',
  'transfer',
  'refund',
  'settlement',
  'adjustment',
] as const
export type MovementKind = (typeof MOVEMENT_KINDS)[number]

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  purchase: 'Purchase',
  income: 'Income',
  transfer: 'Transfer',
  refund: 'Received back',
  settlement: 'Settlement',
  adjustment: 'Adjustment',
}

export interface Posting {
  account: Account
  /** Signed, debit-positive. Every movement's postings sum to zero. */
  amount: number
  category?: string
  counterparty?: string
}

export interface Movement {
  id: string
  date: string
  kind: MovementKind
  description: string
  postings: Posting[]
  importId?: string
  links?: string[]
}

export interface LedgerData {
  movements: Movement[]
  budgets: Budget[]
}

export type BuildResult<T> = { ok: true; value: T } | { ok: false; reason: string }

function fail(reason: string): { ok: false; reason: string } {
  return { ok: false, reason }
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

function fromCents(value: number): number {
  return value / 100
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function addMonthsToDate(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const total = year * 12 + (month - 1) + months
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  const lastDay = new Date(nextYear, nextMonth, 0).getDate()
  return `${nextYear}-${pad2(nextMonth)}-${pad2(Math.min(day, lastDay))}`
}

export function movementMonth(movement: Movement): string {
  return movement.date.slice(0, 7)
}

export function isBalanced(movement: Pick<Movement, 'postings'>): boolean {
  return movement.postings.reduce((sum, posting) => sum + toCents(posting.amount), 0) === 0
}

function splitCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0))
}

function validateHeader(input: { id: string; date: string; description: string }): string | null {
  if (!input.id.trim()) return 'id is required'
  if (!isIsoDate(input.date)) return 'date must be a valid YYYY-MM-DD date'
  if (!input.description.trim()) return 'description is required'
  return null
}

export interface PurchaseShare {
  counterparty: string
  amount: number
}

export interface PurchaseInput {
  id: string
  date: string
  description: string
  amount: number
  category?: string
  account: FundingAccount
  counterparty?: string
  shares?: PurchaseShare[]
  installments?: number
  importId?: string
}

export function buildPurchase(input: PurchaseInput): BuildResult<Movement[]> {
  const header = validateHeader(input)
  if (header) return fail(header)
  if (!(input.amount > 0)) return fail('amount must be positive')
  if (!FUNDING_ACCOUNTS.includes(input.account)) return fail('invalid funding account')

  const installments = input.installments ?? 1
  if (!Number.isInteger(installments) || installments < 1 || installments > 48) {
    return fail('installments must be an integer between 1 and 48')
  }

  const amountCents = toCents(input.amount)
  if (amountCents < installments) return fail('each installment must be at least one cent')

  const shares = input.shares ?? []
  let shareCents = 0
  for (const share of shares) {
    if (!share.counterparty.trim()) return fail('share counterparty is required')
    if (!(share.amount > 0)) return fail('share amount must be positive')
    shareCents += toCents(share.amount)
  }
  if (shareCents > amountCents) return fail('shares cannot exceed the purchase amount')

  if (input.account === 'payable' && !input.counterparty?.trim()) {
    return fail('a payable purchase needs a counterparty')
  }
  if (input.account !== 'payable' && input.counterparty) {
    return fail('counterparty only applies to payable purchases')
  }

  const amounts = splitCents(amountCents, installments)
  const shareAmounts = shares.map((share) => splitCents(toCents(share.amount), installments))
  const movements: Movement[] = []

  for (let index = 0; index < installments; index++) {
    const postings: Posting[] = []
    let installmentShare = 0
    shares.forEach((share, shareIndex) => {
      const value = shareAmounts[shareIndex][index]
      installmentShare += value
      if (value > 0) {
        postings.push({
          account: 'receivable',
          amount: fromCents(value),
          counterparty: share.counterparty.trim(),
        })
      }
    })

    const own = amounts[index] - installmentShare
    if (own > 0) {
      postings.push({
        account: 'expense',
        amount: fromCents(own),
        ...(input.category ? { category: input.category } : {}),
      })
    }
    postings.push({
      account: input.account,
      amount: -fromCents(amounts[index]),
      ...(input.account === 'payable' ? { counterparty: input.counterparty?.trim() } : {}),
    })

    movements.push({
      id: index === 0 ? input.id : `${input.id}-${index + 1}`,
      date: addMonthsToDate(input.date, index),
      kind: 'purchase',
      description:
        installments > 1
          ? `${input.description} (${index + 1}/${installments})`
          : input.description,
      postings,
      ...(input.importId
        ? { importId: index === 0 ? input.importId : `${input.importId}:${index + 1}` }
        : {}),
      ...(index > 0 ? { links: [input.id] } : {}),
    })
  }

  return { ok: true, value: movements }
}

export interface IncomeInput {
  id: string
  date: string
  description: string
  amount: number
  account: CashAccount
  category?: string
  importId?: string
}

export function buildIncome(input: IncomeInput): BuildResult<Movement> {
  const header = validateHeader(input)
  if (header) return fail(header)
  if (!(input.amount > 0)) return fail('amount must be positive')
  if (!CASH_ACCOUNTS.includes(input.account)) return fail('invalid income account')

  return {
    ok: true,
    value: {
      id: input.id,
      date: input.date,
      kind: 'income',
      description: input.description.trim(),
      postings: [
        { account: input.account, amount: input.amount },
        {
          account: 'income',
          amount: -input.amount,
          ...(input.category ? { category: input.category } : {}),
        },
      ],
      ...(input.importId ? { importId: input.importId } : {}),
    },
  }
}

export interface TransferInput {
  id: string
  date: string
  description: string
  amount: number
  from: 'checking' | 'card' | 'voucher' | 'cash'
  to: 'checking' | 'card' | 'voucher' | 'cash'
}

export function buildTransfer(input: TransferInput): BuildResult<Movement> {
  const header = validateHeader(input)
  if (header) return fail(header)
  if (!(input.amount > 0)) return fail('amount must be positive')
  if (input.from === input.to) return fail('transfer accounts must differ')

  return {
    ok: true,
    value: {
      id: input.id,
      date: input.date,
      kind: 'transfer',
      description: input.description.trim(),
      postings: [
        { account: input.from, amount: -input.amount },
        { account: input.to, amount: input.amount },
      ],
    },
  }
}

export function expenseAmount(movement: Movement): number {
  return fromCents(
    movement.postings
      .filter((posting) => posting.account === 'expense')
      .reduce((sum, posting) => sum + toCents(posting.amount), 0),
  )
}

export function incomeAmount(movement: Movement): number {
  return fromCents(
    -movement.postings
      .filter((posting) => posting.account === 'income')
      .reduce((sum, posting) => sum + toCents(posting.amount), 0),
  )
}

export function receivableTotal(movement: Movement): number {
  return fromCents(
    movement.postings
      .filter((posting) => posting.account === 'receivable')
      .reduce((sum, posting) => sum + toCents(posting.amount), 0),
  )
}

export function payableTotal(movement: Movement): number {
  return fromCents(
    -movement.postings
      .filter((posting) => posting.account === 'payable')
      .reduce((sum, posting) => sum + toCents(posting.amount), 0),
  )
}

export function grossPurchaseAmount(movement: Movement): number {
  if (movement.kind !== 'purchase') return 0
  return fromCents(
    movement.postings
      .filter((posting) => posting.account === 'expense' || posting.account === 'receivable')
      .reduce((sum, posting) => sum + Math.max(0, toCents(posting.amount)), 0),
  )
}

export function refundAmount(movement: Movement): number {
  if (movement.kind !== 'refund') return 0
  return fromCents(
    movement.postings
      .filter((posting) => FUNDING_ACCOUNTS.includes(posting.account as FundingAccount))
      .reduce((sum, posting) => sum + Math.max(0, toCents(posting.amount)), 0),
  )
}

export function settlementTotal(movement: Movement): number {
  if (movement.kind !== 'settlement') return 0
  const total = movement.postings
    .filter((posting) => posting.account === 'receivable' || posting.account === 'payable')
    .reduce((sum, posting) => sum + toCents(posting.amount), 0)
  return Math.abs(fromCents(total))
}

export function movementTotal(movement: Movement): number {
  switch (movement.kind) {
    case 'purchase':
      return grossPurchaseAmount(movement)
    case 'income':
      return incomeAmount(movement)
    case 'refund':
      return refundAmount(movement)
    case 'settlement':
      return settlementTotal(movement)
    case 'transfer':
      return fromCents(
        movement.postings.reduce((sum, posting) => sum + Math.max(0, toCents(posting.amount)), 0),
      )
    case 'adjustment':
      return fromCents(
        Math.max(...movement.postings.map((posting) => Math.abs(toCents(posting.amount))), 0),
      )
  }
}

export function fundingAccountOf(movement: Movement): FundingAccount | null {
  if (movement.kind === 'purchase') {
    const posting = movement.postings.find(
      (candidate) =>
        FUNDING_ACCOUNTS.includes(candidate.account as FundingAccount) && candidate.amount < 0,
    )
    return posting ? (posting.account as FundingAccount) : null
  }
  if (movement.kind === 'income' || movement.kind === 'refund') {
    const posting = movement.postings.find(
      (candidate) =>
        candidate.account !== 'income' &&
        candidate.account !== 'expense' &&
        candidate.amount > 0 &&
        (CASH_ACCOUNTS.includes(candidate.account as CashAccount) || candidate.account === 'card'),
    )
    return posting ? (posting.account as FundingAccount) : null
  }
  return null
}

export function transferAccounts(movement: Movement): [Account, Account] | null {
  if (movement.kind !== 'transfer') return null
  const outgoing = movement.postings.find((posting) => posting.amount < 0)
  const incoming = movement.postings.find((posting) => posting.amount > 0)
  return outgoing && incoming ? [outgoing.account, incoming.account] : null
}

export function categoryOf(movement: Movement): string | undefined {
  return movement.postings.find((posting) => posting.category)?.category
}

export function counterpartyOf(movement: Movement): string | undefined {
  return movement.postings.find((posting) => posting.counterparty)?.counterparty
}

export function refundableAmount(purchase: Movement, movements: Movement[]): number {
  const already = movements
    .filter(
      (movement) =>
        movement.kind === 'refund' &&
        (movement.links ?? []).includes(purchase.id) &&
        movement.id !== purchase.id,
    )
    .reduce((sum, movement) => addCurrency(sum, refundAmount(movement)), 0)
  return Math.max(0, addCurrency(expenseAmount(purchase), -already))
}

export interface RefundInput {
  id: string
  date: string
  description: string
  amount: number
  account: FundingAccount
  purchase: Movement
  category?: string
  importId?: string
  existing?: Movement[]
}

export function buildRefund(input: RefundInput): BuildResult<Movement> {
  const header = validateHeader(input)
  if (header) return fail(header)
  if (!(input.amount > 0)) return fail('amount must be positive')
  if (!FUNDING_ACCOUNTS.includes(input.account)) return fail('invalid refund account')
  if (input.purchase.kind !== 'purchase') return fail('refunds must link to a purchase')

  const available = refundableAmount(input.purchase, input.existing ?? [input.purchase])
  if (addCurrency(input.amount, -available) > 0.004) {
    return fail(`refund cannot exceed ${available.toFixed(2)} on the linked purchase`)
  }

  return {
    ok: true,
    value: {
      id: input.id,
      date: input.date,
      kind: 'refund',
      description: input.description.trim(),
      postings: [
        { account: input.account, amount: input.amount },
        {
          account: 'expense',
          amount: -input.amount,
          category: input.category ?? categoryOf(input.purchase) ?? 'Other',
        },
      ],
      links: [input.purchase.id],
      ...(input.importId ? { importId: input.importId } : {}),
    },
  }
}

export interface Outstanding {
  counterparty: string
  amount: number
}

export interface OutstandingMovement {
  movementId: string
  counterparty: string
  direction: 'receivable' | 'payable'
  description: string
  date: string
  total: number
  settled: number
  outstanding: number
}

export function outstandingMovements(
  movements: Movement[],
  direction: 'receivable' | 'payable',
): OutstandingMovement[] {
  const sources: (OutstandingMovement & { order: number })[] = []

  movements.forEach((movement, order) => {
    for (const posting of movement.postings) {
      if (posting.account !== direction) continue
      const counterparty = posting.counterparty?.trim()
      if (!counterparty) continue
      const amount = direction === 'receivable' ? posting.amount : -posting.amount
      if (amount <= 0.004) continue
      sources.push({
        movementId: movement.id,
        counterparty,
        direction,
        description: movement.description,
        date: movement.date,
        total: fromCents(toCents(amount)),
        settled: 0,
        outstanding: fromCents(toCents(amount)),
        order,
      })
    }
  })

  sources.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)

  const settlements = movements
    .map((movement, order) => {
      if (movement.kind !== 'settlement') return null
      const posting = movement.postings.find((candidate) => candidate.account === direction)
      if (!posting) return null
      const counterparty = posting.counterparty?.trim()
      if (!counterparty) return null
      const amount = direction === 'receivable' ? -posting.amount : posting.amount
      if (amount <= 0.004) return null
      return {
        counterparty,
        amount: fromCents(toCents(amount)),
        date: movement.date,
        links: new Set(movement.links ?? []),
        order,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)

  for (const settlement of settlements) {
    let remaining = settlement.amount
    const candidates = sources.filter(
      (source) => source.counterparty === settlement.counterparty && source.outstanding > 0.004,
    )
    const ordered = [
      ...candidates.filter((source) => settlement.links.has(source.movementId)),
      ...candidates.filter((source) => !settlement.links.has(source.movementId)),
    ]
    for (const source of ordered) {
      if (remaining <= 0.004) break
      const applied = Math.min(source.outstanding, remaining)
      source.settled = addCurrency(source.settled, applied)
      source.outstanding = addCurrency(source.outstanding, -applied)
      remaining = addCurrency(remaining, -applied)
    }
  }

  return sources.map(({ order: _order, ...row }) => row)
}

export function outstanding(
  movements: Movement[],
  account: 'receivable' | 'payable',
): Outstanding[] {
  const totals = new Map<string, number>()
  for (const row of outstandingMovements(movements, account)) {
    if (row.outstanding <= 0.004) continue
    totals.set(row.counterparty, addCurrency(totals.get(row.counterparty) ?? 0, row.outstanding))
  }

  return [...totals]
    .map(([counterparty, amount]) => ({ counterparty, amount }))
    .sort((a, b) => a.counterparty.localeCompare(b.counterparty))
}

export type SettlementInput =
  | {
      id: string
      date: string
      description: string
      direction: 'receivable'
      counterparty: string
      received: number
      forgiven: number
      account: CashAccount
      links?: string[]
    }
  | {
      id: string
      date: string
      description: string
      direction: 'payable'
      counterparty: string
      paid: number
      forgiven: number
      account: CashAccount
      links?: string[]
    }

export function buildSettlement(
  input: SettlementInput,
  movements: Movement[],
): BuildResult<Movement> {
  const header = validateHeader(input)
  if (header) return fail(header)
  if (!input.counterparty.trim()) return fail('counterparty is required')

  const cash = input.direction === 'receivable' ? input.received : input.paid
  if (!(cash >= 0) || !(input.forgiven >= 0)) return fail('amounts cannot be negative')
  const total = addCurrency(cash, input.forgiven)
  if (!(total > 0)) return fail('settlement must move or forgive something')

  const owed = outstanding(movements, input.direction).find(
    (row) => row.counterparty === input.counterparty.trim(),
  )?.amount
  if ((owed ?? 0) + 0.004 < total) {
    return fail(`settlement cannot exceed the outstanding ${input.direction} amount`)
  }

  const postings: Posting[] = []
  if (input.direction === 'receivable') {
    postings.push({
      account: 'receivable',
      amount: -total,
      counterparty: input.counterparty.trim(),
    })
    if (cash > 0) postings.push({ account: input.account, amount: cash })
    if (input.forgiven > 0) postings.push({ account: 'forgiveness', amount: input.forgiven })
  } else {
    postings.push({
      account: 'payable',
      amount: total,
      counterparty: input.counterparty.trim(),
    })
    if (cash > 0) postings.push({ account: input.account, amount: -cash })
    if (input.forgiven > 0) postings.push({ account: 'forgiveness', amount: -input.forgiven })
  }

  return {
    ok: true,
    value: {
      id: input.id,
      date: input.date,
      kind: 'settlement',
      description: input.description.trim(),
      postings,
      ...(input.links?.length ? { links: input.links } : {}),
    },
  }
}

export interface AdjustmentInput {
  id: string
  date: string
  description: string
  account: Exclude<Account, 'adjustment'>
  amount: number
}

export function buildAdjustment(input: AdjustmentInput): BuildResult<Movement> {
  const header = validateHeader(input)
  if (header) return fail(header)
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    return fail('adjustment amount must be non-zero')
  }

  return {
    ok: true,
    value: {
      id: input.id,
      date: input.date,
      kind: 'adjustment',
      description: input.description.trim(),
      postings: [
        { account: input.account, amount: input.amount },
        { account: 'adjustment', amount: -input.amount },
      ],
    },
  }
}

export function accountBalance(movements: Movement[], account: Account): number {
  return fromCents(
    movements.reduce(
      (sum, movement) =>
        sum +
        movement.postings
          .filter((posting) => posting.account === account)
          .reduce((postingSum, posting) => postingSum + toCents(posting.amount), 0),
      0,
    ),
  )
}

export function voucherBalance(movements: Movement[]): number {
  return accountBalance(movements, 'voucher')
}

export function paceByMonth(movements: Movement[], referenceMonth: string): number {
  return fromCents(
    movements
      .filter((movement) => movementMonth(movement) === referenceMonth)
      .reduce((sum, movement) => sum + toCents(expenseAmount(movement)), 0),
  )
}

export function incomeByMonth(movements: Movement[], referenceMonth: string): number {
  return fromCents(
    movements
      .filter((movement) => movementMonth(movement) === referenceMonth)
      .reduce((sum, movement) => sum + toCents(incomeAmount(movement)), 0),
  )
}

export function categoryTotals(
  movements: Movement[],
  referenceMonth: string,
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const movement of movements) {
    if (movementMonth(movement) !== referenceMonth) continue
    for (const posting of movement.postings) {
      if (posting.account !== 'expense' || !posting.category) continue
      totals[posting.category] = addCurrency(
        totals[posting.category] ?? 0,
        fromCents(toCents(posting.amount)),
      )
    }
  }
  return totals
}

export function expensesByAccount(
  movements: Movement[],
  referenceMonth: string,
): Partial<Record<FundingAccount, number>> {
  const totals: Partial<Record<FundingAccount, number>> = {}
  for (const movement of movements) {
    if (movementMonth(movement) !== referenceMonth) continue
    const amount = expenseAmount(movement)
    if (amount === 0) continue
    const account = fundingAccountOf(movement)
    if (!account) continue
    totals[account] = addCurrency(totals[account] ?? 0, amount)
  }
  return totals
}

export function incomeByAccount(
  movements: Movement[],
  referenceMonth: string,
): Partial<Record<CashAccount, number>> {
  const totals: Partial<Record<CashAccount, number>> = {}
  for (const movement of movements) {
    if (movementMonth(movement) !== referenceMonth || movement.kind !== 'income') continue
    const account = fundingAccountOf(movement)
    if (!account || !CASH_ACCOUNTS.includes(account as CashAccount)) continue
    totals[account as CashAccount] = addCurrency(
      totals[account as CashAccount] ?? 0,
      incomeAmount(movement),
    )
  }
  return totals
}

export function availableMonths(movements: Movement[]): string[] {
  return Array.from(new Set(movements.map((movement) => movementMonth(movement))))
    .sort()
    .reverse()
}

export function currentYM(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function localYMD(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function daysInMonth(referenceMonth: string): number {
  const [year, month] = referenceMonth.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) return 30
  return new Date(year, month, 0).getDate()
}

export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return ay * 12 + am - (by * 12 + bm)
}

export function monthRelation(referenceMonth: string): 'past' | 'current' | 'future' {
  const diff = monthDiff(currentYM(), referenceMonth)
  if (diff > 0) return 'past'
  if (diff < 0) return 'future'
  return 'current'
}

export function daysSince(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const then = new Date(year, month - 1, day)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today.getTime() - then.getTime()) / 86400000)
}

export type PaceStatus = 'on-track' | 'caution' | 'ahead' | 'over'

export interface SpendingPaceResult {
  daily: {
    day: number
    reference: number
    actual: number
    trend: number | null
    suggestion: number | null
  }[]
  cumulative: {
    day: number
    reference: number
    actual: number
    trend: number | null
    suggestion: number | null
  }[]
  suggestionPerDay: number
  limit: number
  totalSalary: number
  spentSoFar: number
  remainingBudget: number
  status: PaceStatus
}

export function ses(expenses: number[]): number[] {
  if (expenses.length === 0) return []
  const result: number[] = [expenses[0]]
  for (let index = 1; index < expenses.length; index++) {
    result.push(SES_ALPHA * expenses[index] + (1 - SES_ALPHA) * result[index - 1])
  }
  return result
}

export function spendingPace(
  movements: Movement[],
  budget: Budget | undefined,
  currentDay: number,
): SpendingPaceResult {
  const plannedIncome = budget?.plannedIncome ?? 0
  const plannedMealVoucher = budget?.plannedMealVoucher ?? 0
  const investmentRate = budget?.investmentRate ?? 0
  const totalSalary = addCurrency(plannedIncome, plannedMealVoucher)
  const limit = addCurrency(plannedIncome * (1 - investmentRate), plannedMealVoucher)
  const referenceMonth = budget?.referenceMonth ?? currentYM()
  const monthDays = daysInMonth(referenceMonth)

  const dailyActual = Array.from({ length: monthDays }, () => 0)
  if (budget) {
    for (const movement of movements) {
      if (movementMonth(movement) !== referenceMonth) continue
      const amount = expenseAmount(movement)
      if (amount === 0) continue
      const purchaseDay = Number(movement.date.slice(8, 10)) || 1
      const day = Math.min(Math.max(purchaseDay, 1), monthDays)
      dailyActual[day - 1] = addCurrency(dailyActual[day - 1], amount)
    }
  }

  const spentSoFar = dailyActual
    .slice(0, currentDay)
    .reduce((sum, value) => addCurrency(sum, value), 0)
  const committedAhead = dailyActual
    .slice(currentDay)
    .reduce((sum, value) => addCurrency(sum, value), 0)
  const remainingDays = currentDay >= monthDays ? 0 : monthDays - currentDay + 1
  const remainingBudget = addCurrency(addCurrency(limit, -spentSoFar), -committedAhead)
  const spendable = Math.max(0, remainingBudget)
  const suggestionPerDay = remainingDays > 0 ? spendable / remainingDays : 0

  const sesResult = ses(dailyActual.slice(0, currentDay))
  const averagePerDay = currentDay > 0 ? spentSoFar / currentDay : 0
  const proRataBudget = monthDays > 0 ? (limit * currentDay) / monthDays : 0
  const status: PaceStatus =
    spentSoFar > limit
      ? 'over'
      : spentSoFar > proRataBudget * 1.2
        ? 'ahead'
        : spentSoFar > proRataBudget * 1.05
          ? 'caution'
          : 'on-track'

  const daily: SpendingPaceResult['daily'] = []
  const cumulative: SpendingPaceResult['cumulative'] = []
  const referencePerDay = limit / monthDays
  let cumulativeActual = 0
  let cumulativeProjection = spentSoFar
  let cumulativeSuggestion = spentSoFar

  for (let day = 1; day <= monthDays; day++) {
    const index = day - 1
    cumulativeActual = addCurrency(cumulativeActual, dailyActual[index])

    let trendValue: number | null = sesResult[index] ?? null
    let suggestedProjection: number | null = null
    if (day > currentDay) {
      trendValue = averagePerDay
      cumulativeProjection = addCurrency(cumulativeProjection, averagePerDay)
    }
    if (day >= currentDay && remainingDays > 0) {
      suggestedProjection = suggestionPerDay
      cumulativeSuggestion = addCurrency(cumulativeSuggestion, suggestionPerDay)
    }

    daily.push({
      day,
      reference: referencePerDay,
      actual: dailyActual[index],
      trend: trendValue,
      suggestion: suggestedProjection,
    })
    cumulative.push({
      day,
      reference: referencePerDay * day,
      actual: cumulativeActual,
      trend: day >= currentDay ? cumulativeProjection : null,
      suggestion: day >= currentDay && remainingDays > 0 ? cumulativeSuggestion : null,
    })
  }

  return {
    daily,
    cumulative,
    suggestionPerDay,
    limit,
    totalSalary,
    spentSoFar,
    remainingBudget,
    status,
  }
}

export function budgetVsActual(
  movements: Movement[],
  budget: Budget | undefined,
): { category: string; budgeted: number; actual: number }[] {
  const referenceMonth = budget?.referenceMonth
  if (!referenceMonth || !budget) return []
  const actuals = categoryTotals(movements, referenceMonth)
  const categories = new Set([...Object.keys(budget.categoryLimits), ...Object.keys(actuals)])
  return Array.from(categories)
    .sort()
    .map((category) => ({
      category,
      budgeted: budget.categoryLimits[category] ?? 0,
      actual: actuals[category] ?? 0,
    }))
    .filter(({ budgeted, actual }) => budgeted !== 0 || actual !== 0)
}

export interface FutureCommitment {
  referenceMonth: string
  total: number
  movements: Movement[]
}

export function futureCommitments(movements: Movement[], months = 12): FutureCommitment[] {
  const start = currentYM()
  const commitments: Record<string, FutureCommitment> = {}
  for (let index = 0; index < months; index++) {
    const referenceMonth = addMonths(start, index)
    commitments[referenceMonth] = { referenceMonth, total: 0, movements: [] }
  }

  for (const movement of movements) {
    const referenceMonth = movementMonth(movement)
    if (!(referenceMonth in commitments)) continue
    const amount = expenseAmount(movement)
    if (amount === 0) continue
    commitments[referenceMonth].total = addCurrency(commitments[referenceMonth].total, amount)
    commitments[referenceMonth].movements.push(movement)
  }

  return Object.values(commitments).sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
}

export function yearSummary(
  movements: Movement[],
  year: number,
): {
  months: { referenceMonth: string; income: number; expenses: number; balance: number }[]
  totalIncome: number
  totalExpenses: number
  totalBalance: number
} {
  const months: { referenceMonth: string; income: number; expenses: number; balance: number }[] = []
  let totalIncome = 0
  let totalExpenses = 0

  for (let month = 1; month <= 12; month++) {
    const referenceMonth = `${year}-${pad2(month)}`
    const income = incomeByMonth(movements, referenceMonth)
    const expenses = paceByMonth(movements, referenceMonth)
    totalIncome = addCurrency(totalIncome, income)
    totalExpenses = addCurrency(totalExpenses, expenses)
    months.push({ referenceMonth, income, expenses, balance: income - expenses })
  }

  return {
    months,
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
  }
}

export function categoryTimeSeries(
  movements: Movement[],
  months: string[],
): { month: string; [category: string]: number | string }[] {
  const allCategories = new Set<string>()
  const monthlyData: { month: string; [category: string]: number | string }[] = []

  for (const referenceMonth of months) {
    const categories = categoryTotals(movements, referenceMonth)
    for (const category of Object.keys(categories)) allCategories.add(category)
    monthlyData.push({ month: referenceMonth, ...categories })
  }

  return monthlyData.map((entry) => {
    const filled: { month: string; [category: string]: number | string } = { month: entry.month }
    for (const category of allCategories) {
      filled[category] = (entry[category] as number) || 0
    }
    return filled
  })
}

export function budgetVsActualYear(
  movements: Movement[],
  budgets: Budget[],
  year: number,
): { category: string; budgeted: number; actual: number }[] {
  const yearBudgets = budgets.filter((budget) => budget.referenceMonth.startsWith(`${year}-`))
  const totals: Record<string, { budgeted: number; actual: number }> = {}

  for (let month = 1; month <= 12; month++) {
    const referenceMonth = `${year}-${pad2(month)}`
    const budget = yearBudgets.find((candidate) => candidate.referenceMonth === referenceMonth)
    const actuals = categoryTotals(movements, referenceMonth)

    if (budget) {
      for (const [category, value] of Object.entries(budget.categoryLimits)) {
        if (!totals[category]) totals[category] = { budgeted: 0, actual: 0 }
        totals[category].budgeted = addCurrency(totals[category].budgeted, value)
      }
    }
    for (const [category, value] of Object.entries(actuals)) {
      if (!totals[category]) totals[category] = { budgeted: 0, actual: 0 }
      totals[category].actual = addCurrency(totals[category].actual, value)
    }
  }

  return Object.entries(totals)
    .map(([category, value]) => ({ category, ...value }))
    .filter(({ budgeted, actual }) => budgeted !== 0 || actual !== 0)
    .sort((a, b) => b.actual - a.actual)
}

export interface BudgetRange {
  startMonth: string
  endMonth: string
  months: string[]
  budget: Budget
}

function sameBudget(a: Budget, b: Budget): boolean {
  if (a.plannedIncome !== b.plannedIncome || a.plannedMealVoucher !== b.plannedMealVoucher) {
    return false
  }
  const aKeys = Object.keys(a.categoryLimits).sort()
  const bKeys = Object.keys(b.categoryLimits).sort()
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(
    (key, index) => bKeys[index] === key && a.categoryLimits[key] === b.categoryLimits[key],
  )
}

export function groupBudgetsByRange(budgets: Budget[]): BudgetRange[] {
  const sorted = [...budgets].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
  const ranges: BudgetRange[] = []
  for (const budget of sorted) {
    const last = ranges[ranges.length - 1]
    if (
      last &&
      addMonths(last.endMonth, 1) === budget.referenceMonth &&
      sameBudget(last.budget, budget)
    ) {
      last.endMonth = budget.referenceMonth
      last.months.push(budget.referenceMonth)
    } else {
      ranges.push({
        startMonth: budget.referenceMonth,
        endMonth: budget.referenceMonth,
        months: [budget.referenceMonth],
        budget,
      })
    }
  }
  return ranges
}

export type MovementSortKey = 'date' | 'description' | 'amount' | 'category' | 'account'

export function compareMovements(
  a: Movement,
  b: Movement,
  key: MovementSortKey,
  direction: 'asc' | 'desc',
): number {
  let comparison: number
  switch (key) {
    case 'amount':
      comparison = movementTotal(a) - movementTotal(b)
      break
    case 'category':
      comparison = (categoryOf(a) ?? '').localeCompare(categoryOf(b) ?? '')
      break
    case 'account':
      comparison = (fundingAccountOf(a) ?? '').localeCompare(fundingAccountOf(b) ?? '')
      break
    default:
      comparison = String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
  }
  return direction === 'asc' ? comparison : -comparison
}

export function addMonths(referenceMonth: string, count: number): string {
  const [year, month] = referenceMonth.split('-').map(Number)
  const total = year * 12 + month - 1 + count
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`
}
