import { daysSince, type OutstandingMovement } from '@/domain/ledger'
import { addCurrency, formatCurrency } from '@/lib/currency'

export type Relation = 'receivable' | 'payable'
export type ViewMode = 'purchase' | 'person'
export type DebtSort = 'due' | 'amount' | 'name'

export interface SettleTarget {
  rows: OutstandingMovement[]
}

export interface PurchaseGroup {
  movementId: string
  description: string
  date: string
  outstanding: number
  rows: OutstandingMovement[]
}

export interface PersonData {
  counterparty: string
  outstanding: number
  total: number
  count: number
  oldest: string
  allSettled: boolean
  anySettled: boolean
}

export const BADGE_GREEN = 'text-green-600 bg-green-50'
export const BADGE_RED = 'text-red-600 bg-red-50'
export const BADGE_AMBER = 'text-amber-600 bg-amber-50'

export const SORT_LABELS: Record<DebtSort, string> = {
  due: 'Due',
  amount: 'Amount',
  name: 'Name',
}

export function groupByPurchase(rows: OutstandingMovement[], sort: DebtSort): PurchaseGroup[] {
  const groups = new Map<string, PurchaseGroup>()
  for (const row of rows) {
    let group = groups.get(row.movementId)
    if (!group) {
      group = {
        movementId: row.movementId,
        description: row.description,
        date: row.date,
        outstanding: 0,
        rows: [],
      }
      groups.set(row.movementId, group)
    }
    group.rows.push(row)
    group.outstanding = addCurrency(group.outstanding, row.outstanding)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => b.outstanding - a.outstanding),
    }))
    .sort((a, b) => {
      if (sort === 'amount') return b.outstanding - a.outstanding
      if (sort === 'name') return a.description.localeCompare(b.description)
      return a.date.localeCompare(b.date) || b.outstanding - a.outstanding
    })
}

export function aggregate(rows: OutstandingMovement[]): PersonData[] {
  const map = new Map<string, PersonData>()
  for (const row of rows) {
    let entry = map.get(row.counterparty)
    if (!entry) {
      entry = {
        counterparty: row.counterparty,
        outstanding: 0,
        total: 0,
        count: 0,
        oldest: row.date,
        allSettled: true,
        anySettled: false,
      }
      map.set(row.counterparty, entry)
    }
    entry.outstanding = addCurrency(entry.outstanding, row.outstanding)
    entry.total = addCurrency(entry.total, row.total)
    entry.count += 1
    if (row.date < entry.oldest) entry.oldest = row.date
    entry.allSettled &&= row.outstanding <= 0.004
    entry.anySettled ||= row.settled > 0.004
  }
  return [...map.values()]
}

export function sortPeople(people: PersonData[], sort: DebtSort): PersonData[] {
  if (sort === 'amount') return [...people].sort((a, b) => b.outstanding - a.outstanding)
  if (sort === 'name') {
    return [...people].sort((a, b) => a.counterparty.localeCompare(b.counterparty))
  }
  return [...people].sort(
    (a, b) => a.oldest.localeCompare(b.oldest) || b.outstanding - a.outstanding,
  )
}

export function formatDebtDate(date: string): string {
  const [year, month, day] = date.split('-')
  return year && month && day ? `${day}/${month}/${year}` : date
}

export function settlementHistory(row: OutstandingMovement): string {
  return row.settlements
    .map((settlement) =>
      [
        settlement.paid > 0.004 ? `${formatCurrency(settlement.paid)} paid` : '',
        settlement.forgiven > 0.004 ? `${formatCurrency(settlement.forgiven)} forgiven` : '',
        settlement.overpaid > 0.004 ? `${formatCurrency(settlement.overpaid)} overpaid` : '',
        formatDebtDate(settlement.date),
      ]
        .filter(Boolean)
        .join(' · '),
    )
    .join(' · ')
}

export function urgencyOf(days: number): { label: string; color: string } {
  if (days > 30) return { label: `Overdue (${days}d)`, color: BADGE_RED }
  if (days > 15) return { label: `Aging (${days}d)`, color: BADGE_AMBER }
  return { label: `Recent (${days}d)`, color: BADGE_GREEN }
}

export function groupStatus(group: PurchaseGroup, allSettled: boolean) {
  return allSettled ? { label: 'Paid', color: BADGE_GREEN } : urgencyOf(daysSince(group.date))
}
