import { CheckCircleIcon, PercentIcon, UserIcon, UsersIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  buildSettlement,
  counterpartyOf,
  daysSince,
  localYMD,
  type Movement,
  type OutstandingMovement,
  outstandingMovements,
} from '@/domain/ledger'
import { addCurrency, formatCurrency, formatPlainCurrency, parseCurrency } from '@/lib/currency'
import EmptyState from '@/ui/components/Common/EmptyState'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import { useIsDesktop } from '@/ui/hooks/useIsDesktop'

const BADGE_GREEN = 'text-green-600 bg-green-50 '
const BADGE_RED = 'text-red-600 bg-red-50 '

const SORT_LABELS: Record<DebtSort, string> = {
  due: 'Due',
  amount: 'Amount',
  name: 'Name',
}
const BADGE_AMBER = 'text-amber-600 bg-amber-50 '

type Relation = 'receivable' | 'payable'
type ViewMode = 'purchase' | 'person'
type DebtSort = 'due' | 'amount' | 'name'

interface SettleTarget {
  rows: OutstandingMovement[]
}

interface PurchaseGroup {
  movementId: string
  description: string
  date: string
  outstanding: number
  rows: OutstandingMovement[]
}

interface PersonData {
  counterparty: string
  outstanding: number
  total: number
  count: number
  oldest: string
  allSettled: boolean
  anySettled: boolean
}

function groupByPurchase(rows: OutstandingMovement[], sort: DebtSort): PurchaseGroup[] {
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
    .sort((a, b) => sortGroups(a, b, sort))
}

function sortGroups(a: PurchaseGroup, b: PurchaseGroup, sort: DebtSort): number {
  if (sort === 'amount') return b.outstanding - a.outstanding
  if (sort === 'name') return a.description.localeCompare(b.description)
  return a.date.localeCompare(b.date) || b.outstanding - a.outstanding
}

function aggregate(rows: OutstandingMovement[]): PersonData[] {
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
    entry.oldest = entry.oldest < row.date ? entry.oldest : row.date
    entry.allSettled &&= row.outstanding <= 0.004
    entry.anySettled ||= row.settled > 0.004
  }
  return [...map.values()]
}

function sortPeople(people: PersonData[], sort: DebtSort): PersonData[] {
  if (sort === 'amount') return [...people].sort((a, b) => b.outstanding - a.outstanding)
  if (sort === 'name')
    return [...people].sort((a, b) => a.counterparty.localeCompare(b.counterparty))
  return [...people].sort(
    (a, b) => a.oldest.localeCompare(b.oldest) || b.outstanding - a.outstanding,
  )
}

function formatDebtDate(date: string): string {
  const [year, month, day] = date.split('-')
  return year && month && day ? `${day}/${month}/${year}` : date
}

function settlementHistory(row: OutstandingMovement): string {
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

function PersonStatus({ person, showSettled }: { person: PersonData; showSettled: boolean }) {
  if (person.allSettled) {
    return (
      <Badge variant="outline" className={BADGE_GREEN}>
        Paid
      </Badge>
    )
  }
  if (showSettled && person.anySettled) {
    return (
      <span title="Partially paid">
        <PercentIcon className="size-3.5 text-amber-600" aria-label="Partially paid" />
      </span>
    )
  }
  return null
}

function urgencyOf(days: number): { label: string; color: string } {
  if (days > 30) return { label: `Overdue (${days}d)`, color: BADGE_RED }
  if (days > 15) return { label: `Aging (${days}d)`, color: BADGE_AMBER }
  return { label: `Recent (${days}d)`, color: BADGE_GREEN }
}

function DebtorInfo({ row, open }: { row: OutstandingMovement; open: boolean }) {
  const history = settlementHistory(row)
  return (
    <>
      <p className={`text-xs leading-tight text-muted-foreground ${open ? '' : 'line-through'}`}>
        <span className="font-medium text-foreground">{row.counterparty}</span>
        {': '}
        <span className="font-mono">{formatCurrency(open ? row.outstanding : row.total)}</span>
      </p>
      {history && <p className="text-[10px] leading-tight text-muted-foreground">{history}</p>}
    </>
  )
}

function DebtorControls({
  row,
  size,
  onPartial,
  onSettle,
  onRevoke,
}: {
  row: OutstandingMovement
  size: string
  onPartial: (target: SettleTarget) => void
  onSettle: (target: SettleTarget) => void
  onRevoke: (row: OutstandingMovement) => void
}) {
  if (row.outstanding <= 0.004) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`${size} shrink-0`}
        title={`Undo settlement for ${row.counterparty}`}
        aria-label={`Undo settlement for ${row.counterparty}`}
        onClick={() => onRevoke(row)}
      >
        <CheckCircleIcon className="size-4 text-green-600" />
      </Button>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`${size} shrink-0`}
        title={`Settle a different amount with ${row.counterparty}`}
        aria-label={`Settle a different amount with ${row.counterparty}`}
        onClick={() => onPartial({ rows: [row] })}
      >
        <PercentIcon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={`${size} shrink-0`}
        title={`Settle ${formatCurrency(row.outstanding)} from ${row.counterparty}`}
        aria-label={`Settle ${formatCurrency(row.outstanding)} from ${row.counterparty}`}
        onClick={() => onSettle({ rows: [row] })}
      >
        <CheckCircleIcon className="size-4" />
      </Button>
    </>
  )
}

function DebtorLine({
  row,
  onPartial,
  onSettle,
  onRevoke,
}: {
  row: OutstandingMovement
  onPartial: (target: SettleTarget) => void
  onSettle: (target: SettleTarget) => void
  onRevoke: (row: OutstandingMovement) => void
}) {
  const open = row.outstanding > 0.004
  const history = settlementHistory(row)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-xs leading-tight text-muted-foreground ${open ? '' : 'line-through'}`}
        >
          <span className="font-medium text-foreground">{row.counterparty}</span>
        </p>
        {history && (
          <p className="truncate text-[10px] leading-tight text-muted-foreground">{history}</p>
        )}
      </div>
      <span className="shrink-0 font-mono text-xs">
        {formatCurrency(open ? row.outstanding : row.total)}
      </span>
      <DebtorControls
        row={row}
        size="size-9"
        onPartial={onPartial}
        onSettle={onSettle}
        onRevoke={onRevoke}
      />
    </div>
  )
}

type PurchaseListProps = {
  groups: PurchaseGroup[]
  onSettle: (target: SettleTarget) => void
  onSettleAll: (rows: OutstandingMovement[]) => void
  onPartial: (target: SettleTarget) => void
  onRevoke: (row: OutstandingMovement) => void
  onView: (target: { counterparty: string; movementId?: string }) => void
}

function statusOfGroup(group: PurchaseGroup, allSettled: boolean) {
  return allSettled ? { label: 'Paid', color: BADGE_GREEN } : urgencyOf(daysSince(group.date))
}

function PurchaseCards({
  groups,
  onSettle,
  onSettleAll,
  onPartial,
  onRevoke,
  onView,
}: PurchaseListProps) {
  return (
    <div className="divide-y divide-border border border-border">
      {groups.map((group) => {
        const openRows = group.rows.filter((row) => row.outstanding > 0.004)
        const allSettled = openRows.length === 0
        const status = statusOfGroup(group, allSettled)

        return (
          <div key={group.movementId} className={`px-3 py-2 ${allSettled ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() =>
                  onView({
                    counterparty: group.rows[0].counterparty,
                    movementId: group.movementId,
                  })
                }
              >
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    {group.description}
                  </span>
                  <Badge variant="outline" className={`shrink-0 ${status.color}`}>
                    {status.label}
                  </Badge>
                </span>
                {group.rows.length > 1 && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatCurrency(group.outstanding)} still owed
                  </span>
                )}
              </button>
              {group.rows.length > 1 && openRows.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0"
                  title="Settle all"
                  aria-label="Settle all"
                  onClick={() => onSettleAll(openRows)}
                >
                  <CheckCircleIcon className="size-5" />
                </Button>
              )}
            </div>

            <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2">
              {group.rows.map((row) => (
                <DebtorLine
                  key={row.counterparty}
                  row={row}
                  onPartial={onPartial}
                  onSettle={onSettle}
                  onRevoke={onRevoke}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PurchaseTable({ groups, onSettle, onPartial, onRevoke, onView }: PurchaseListProps) {
  return (
    <div className="border border-border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Due</TableHead>
            <TableHead className="w-28 text-right">Amount</TableHead>
            <TableHead>Purchase</TableHead>
            <TableHead>Split</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const allSettled = group.rows.every((row) => row.outstanding <= 0.004)
            const status = statusOfGroup(group, allSettled)

            return group.rows.map((row, index) => (
              <TableRow
                key={`${group.movementId}:${row.counterparty}`}
                className={allSettled ? 'opacity-60' : undefined}
              >
                {index === 0 && (
                  <>
                    <TableCell rowSpan={group.rows.length} className="align-top">
                      <Badge variant="outline" className={status.color}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell
                      rowSpan={group.rows.length}
                      className="text-right align-top font-mono"
                    >
                      {formatCurrency(group.outstanding)}
                    </TableCell>
                    <TableCell rowSpan={group.rows.length} className="align-top">
                      <button
                        type="button"
                        className="min-w-0 text-left font-medium hover:underline"
                        onClick={() =>
                          onView({
                            counterparty: group.rows[0].counterparty,
                            movementId: group.movementId,
                          })
                        }
                      >
                        {group.description}
                      </button>
                    </TableCell>
                  </>
                )}
                <TableCell className="align-top">
                  <DebtorInfo row={row} open={row.outstanding > 0.004} />
                </TableCell>
                <TableCell className="text-right align-top">
                  <div className="flex justify-end">
                    <DebtorControls
                      row={row}
                      size="size-7"
                      onPartial={onPartial}
                      onSettle={onSettle}
                      onRevoke={onRevoke}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function PersonList({
  people,
  rows,
  relation,
  showSettled,
  isDesktop,
  onSettle,
  onPartial,
  onView,
}: {
  people: PersonData[]
  rows: OutstandingMovement[]
  relation: Relation
  showSettled: boolean
  isDesktop: boolean
  onSettle: (target: SettleTarget) => void
  onPartial: (target: SettleTarget) => void
  onView: (target: { counterparty: string }) => void
}) {
  const targetFor = (person: PersonData): SettleTarget => ({
    rows: rows.filter((row) => row.counterparty === person.counterparty && row.outstanding > 0.004),
  })
  if (!isDesktop) {
    return (
      <div className="divide-y divide-border border border-border">
        {people.map((person) => (
          <div key={person.counterparty} className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onView({ counterparty: person.counterparty })}
            >
              <span className="block truncate text-sm font-medium">{person.counterparty}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                <PersonStatus person={person} showSettled={showSettled} />
                <span>
                  {person.count} purchase{person.count !== 1 ? 's' : ''}
                </span>
              </span>
            </button>
            <span className="shrink-0 font-mono text-sm">
              {formatCurrency(person.allSettled ? person.total : person.outstanding)}
            </span>
            {person.outstanding > 0.004 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0"
                  title={`Settle a different amount with ${person.counterparty}`}
                  aria-label={`Settle a different amount with ${person.counterparty}`}
                  onClick={() => onPartial(targetFor(person))}
                >
                  <PercentIcon className="size-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0"
                  title={`Settle ${formatCurrency(person.outstanding)} with ${person.counterparty}`}
                  aria-label={`Settle ${formatCurrency(person.outstanding)} with ${person.counterparty}`}
                  onClick={() => onSettle(targetFor(person))}
                >
                  <CheckCircleIcon className="size-5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead className="text-right">
              {relation === 'receivable' ? 'Owed to you' : 'You owe'}
            </TableHead>
            <TableHead className="text-right">Purchases</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person) => (
            <TableRow
              key={person.counterparty}
              className="cursor-pointer hover:bg-muted/50"
              tabIndex={0}
              onClick={() => onView({ counterparty: person.counterparty })}
              onKeyDown={(event) => {
                if (
                  event.target !== event.currentTarget ||
                  (event.key !== 'Enter' && event.key !== ' ')
                ) {
                  return
                }
                event.preventDefault()
                onView({ counterparty: person.counterparty })
              }}
            >
              <TableCell className="font-medium">
                <span className="flex items-center gap-1">
                  <UserIcon className="size-3" />
                  {person.counterparty}
                  <PersonStatus person={person} showSettled={showSettled} />
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(person.outstanding)}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {person.count}
              </TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                {person.outstanding > 0.004 && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title={`Settle a different amount with ${person.counterparty}`}
                      aria-label={`Settle a different amount with ${person.counterparty}`}
                      onClick={() => onPartial(targetFor(person))}
                    >
                      <PercentIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title={`Settle ${formatCurrency(person.outstanding)} with ${person.counterparty}`}
                      aria-label={`Settle ${formatCurrency(person.outstanding)} with ${person.counterparty}`}
                      onClick={() => onSettle(targetFor(person))}
                    >
                      <CheckCircleIcon className="size-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RelationSection({
  title,
  description,
  relation,
  rows,
  searching,
  sort,
  showSettled,
  viewMode,
  onSettle,
  onSettleAll,
  onPartial,
  onRevoke,
  onView,
  isDesktop,
}: {
  title: string
  description: string
  relation: Relation
  rows: OutstandingMovement[]
  searching: boolean
  sort: DebtSort
  showSettled: boolean
  viewMode: ViewMode
  onSettle: (target: SettleTarget) => void
  onSettleAll: (rows: OutstandingMovement[]) => void
  onPartial: (target: SettleTarget) => void
  onRevoke: (row: OutstandingMovement) => void
  onView: (target: { counterparty: string; movementId?: string }) => void
  isDesktop: boolean
}) {
  const active = showSettled ? rows : rows.filter((row) => row.outstanding > 0.004)
  const outstandingTotal = active.reduce((sum, row) => addCurrency(sum, row.outstanding), 0)
  const groups = groupByPurchase(rows, sort)
    .map((group) => {
      const visible = showSettled ? group.rows : group.rows.filter((row) => row.outstanding > 0.004)
      return {
        ...group,
        rows: visible,
        outstanding: visible.reduce((sum, row) => addCurrency(sum, row.outstanding), 0),
      }
    })
    .filter((group) => group.rows.length > 0)
  const people = sortPeople(aggregate(active), sort)

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {outstandingTotal > 0.004 && (
          <p className="text-right">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              Outstanding
            </span>
            <span className="font-mono text-sm font-semibold">
              {formatCurrency(outstandingTotal)}
            </span>
          </p>
        )}
      </div>

      {active.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {searching
            ? 'No matching debts.'
            : relation === 'receivable'
              ? 'Nobody owes you right now.'
              : 'You do not owe anyone right now.'}
        </p>
      ) : viewMode === 'person' ? (
        <PersonList
          people={people}
          rows={active}
          relation={relation}
          showSettled={showSettled}
          isDesktop={isDesktop}
          onSettle={onSettle}
          onPartial={onPartial}
          onView={onView}
        />
      ) : isDesktop ? (
        <PurchaseTable
          groups={groups}
          onSettle={onSettle}
          onSettleAll={onSettleAll}
          onPartial={onPartial}
          onRevoke={onRevoke}
          onView={onView}
        />
      ) : (
        <PurchaseCards
          groups={groups}
          onSettle={onSettle}
          onSettleAll={onSettleAll}
          onPartial={onPartial}
          onRevoke={onRevoke}
          onView={onView}
        />
      )}
    </section>
  )
}

function SettleDialog({
  target,
  open,
  onOpenChange,
}: {
  target: SettleTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [cash, setCash] = useState('')
  const [method, setMethod] = useState<'Transfer' | 'Cash'>('Transfer')
  const [date, setDate] = useState(localYMD())
  const [forgiveRest, setForgiveRest] = useState(false)

  const rows = target?.rows ?? []
  const direction = rows[0]?.direction
  const counterparty = rows[0]?.counterparty
  const owed = rows.reduce((sum, row) => addCurrency(sum, row.outstanding), 0)
  const description = rows.length === 1 ? rows[0].description : undefined

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setCash(formatPlainCurrency(owed))
    setMethod('Transfer')
    setDate(localYMD())
    setForgiveRest(false)
  }, [target, open])

  const received = parseCurrency(cash)
  const remainder = addCurrency(owed, -received)

  function handleSave() {
    if (!direction || !counterparty) return
    const cleared = forgiveRest || received > owed + 0.004 ? owed : received
    const settlement = buildSettlement(
      {
        id: crypto.randomUUID(),
        date,
        description: `Settled with ${counterparty}`,
        direction,
        counterparty,
        cash: received,
        cleared,
        account: method === 'Cash' ? 'cash' : 'checking',
        links: rows.map((row) => row.movementId),
      },
      state.movements,
    )

    if (!settlement.ok) {
      toast(settlement.reason, 'error')
      return
    }
    dispatch({ type: 'ADD_MOVEMENTS', payload: [settlement.value] })
    toast('Settlement recorded', 'success')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Settle debt</DialogTitle>
          <DialogDescription>
            {counterparty
              ? `${counterparty} · ${formatCurrency(owed)} outstanding${description ? ` on “${description}”` : ''}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="settle-cash" className="text-xs">
              {direction === 'receivable' ? 'Received (R$)' : 'Paid (R$)'}
            </Label>
            <MoneyInput id="settle-cash" value={cash} onValueChange={setCash} />
            <p className="text-[11px] text-muted-foreground">
              {remainder < -0.004
                ? `${formatCurrency(-remainder)} overpaid`
                : remainder <= 0.004
                  ? 'Settles the full amount'
                  : forgiveRest
                    ? `${formatCurrency(remainder)} forgiven`
                    : `${formatCurrency(remainder)} still owed`}
            </p>
            {remainder > 0.004 && (
              <label
                htmlFor="settle-forgive"
                className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground"
              >
                <Checkbox
                  id="settle-forgive"
                  checked={forgiveRest}
                  onCheckedChange={(checked) => setForgiveRest(checked === true)}
                />
                <span>Forgive the rest</span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="settle-date" className="text-xs">
                Date
              </Label>
              <Input
                id="settle-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settle-method" className="text-xs">
                Payment method
              </Label>
              <Select
                modal={false}
                value={method}
                onValueChange={(value) => setMethod(value === 'Cash' ? 'Cash' : 'Transfer')}
              >
                <SelectTrigger id="settle-method" className="w-full">
                  <SelectValue>{method}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={received <= 0.004 && !forgiveRest}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DebtPage() {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const isDesktop = useIsDesktop()
  const [, navigate] = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [target, setTarget] = useState<SettleTarget | null>(null)

  const movementsById = useMemo(
    () => new Map(state.movements.map((movement) => [movement.id, movement])),
    [state.movements],
  )
  const viewMode: ViewMode = searchParams.get('view') === 'person' ? 'person' : 'purchase'
  const movementParam = searchParams.get('movement')
  const movementFilter = movementParam && movementsById.has(movementParam) ? movementParam : null
  const showSettled = searchParams.get('settled') === '1'
  const sortParam = searchParams.get('sort')
  const sort: DebtSort = sortParam === 'amount' || sortParam === 'name' ? sortParam : 'due'
  const search = searchParams.get('search') ?? ''

  function updateParam(key: string, value: string | null) {
    setSearchParams(
      (previous) => {
        if (!value) previous.delete(key)
        else previous.set(key, value)
        return previous
      },
      { replace: true },
    )
  }

  const debts = useMemo(
    () => ({
      receivable: outstandingMovements(state.movements, 'receivable'),
      payable: outstandingMovements(state.movements, 'payable'),
    }),
    [state.movements],
  )
  const receivableRows = useMemo(
    () =>
      movementFilter
        ? debts.receivable.filter((row) => row.movementId === movementFilter)
        : debts.receivable,
    [debts, movementFilter],
  )
  const payableRows = useMemo(
    () =>
      movementFilter
        ? debts.payable.filter((row) => row.movementId === movementFilter)
        : debts.payable,
    [debts, movementFilter],
  )
  const filteredMovement = movementFilter ? movementsById.get(movementFilter) : undefined

  const emptyAction = { label: 'Go to Transactions', onClick: () => navigate('/') }
  const hasAny = debts.receivable.length > 0 || debts.payable.length > 0
  const needle = search.trim().toLowerCase()
  function matchingPurchases(rows: OutstandingMovement[]): OutstandingMovement[] {
    if (!needle) return rows
    const matched = new Set(
      rows
        .filter(
          (row) =>
            row.description.toLowerCase().includes(needle) ||
            row.counterparty.toLowerCase().includes(needle),
        )
        .map((row) => row.movementId),
    )
    return rows.filter((row) => matched.has(row.movementId))
  }
  const visibleReceivable = matchingPurchases(receivableRows)
  const visiblePayable = matchingPurchases(payableRows)

  function handleView({ counterparty, movementId }: { counterparty: string; movementId?: string }) {
    if (movementId) navigate(`/?movement=${encodeURIComponent(movementId)}`)
    else navigate(`/?person=${encodeURIComponent(counterparty)}`)
  }

  function recordSettlements(rows: OutstandingMovement[]) {
    if (rows.length === 0) return
    const movements: Movement[] = []
    let settled = 0
    for (const row of rows) {
      const result = buildSettlement(
        {
          id: crypto.randomUUID(),
          date: localYMD(),
          description: `Settled with ${row.counterparty}`,
          direction: row.direction,
          counterparty: row.counterparty,
          cash: row.outstanding,
          cleared: row.outstanding,
          account: 'checking',
          links: [row.movementId],
        },
        state.movements,
      )
      if (!result.ok) {
        toast(result.reason, 'error')
        return
      }
      movements.push(result.value)
      settled = addCurrency(settled, row.outstanding)
    }

    dispatch({ type: 'ADD_MOVEMENTS', payload: movements })
    toast(`${formatCurrency(settled)} settled — Ctrl+Z to undo`, 'success')
  }

  function handleSettle(target: SettleTarget) {
    recordSettlements(target.rows)
  }

  function revokeSettlement(row: OutstandingMovement) {
    const ids = state.movements
      .filter(
        (movement) =>
          movement.kind === 'settlement' &&
          movement.links?.includes(row.movementId) &&
          counterpartyOf(movement) === row.counterparty,
      )
      .map((movement) => movement.id)
    if (ids.length === 0) return
    dispatch({ type: 'DELETE_MOVEMENTS', payload: ids })
    toast('Settlement undone — Ctrl+Z to restore', 'info')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Debts</h2>
        <SegmentedControl
          aria-label="Debt view"
          value={viewMode}
          onValueChange={(value) => updateParam('view', value === 'person' ? 'person' : null)}
          options={[
            {
              value: 'purchase',
              label: 'By purchase',
              icon: <UserIcon className="size-3" />,
            },
            {
              value: 'person',
              label: 'By person',
              icon: <UsersIcon className="size-3" />,
            },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => updateParam('search', event.target.value || null)}
          placeholder="Search debts..."
          aria-label="Search debts"
          className="h-10 min-w-0 flex-1 text-xs sm:h-7 sm:w-44 sm:flex-none"
        />
        <Select
          value={sort}
          onValueChange={(value) => updateParam('sort', value === 'due' ? null : value)}
        >
          <SelectTrigger
            className="h-10 w-24 text-xs data-[size=default]:h-10 sm:h-7 sm:data-[size=default]:h-7"
            aria-label="Sort debts"
          >
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="due">Due</SelectItem>
            <SelectItem value="amount">Amount</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
        <label
          htmlFor="show-settled"
          className="flex min-h-10 shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:min-h-7"
        >
          <Checkbox
            id="show-settled"
            checked={showSettled}
            onCheckedChange={(checked) => updateParam('settled', checked === true ? '1' : null)}
          />
          <span>Show settled</span>
        </label>
      </div>

      {filteredMovement && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">Showing “{filteredMovement.description}”</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={() => updateParam('movement', null)}
          >
            Show all
          </Button>
        </div>
      )}

      {!hasAny ? (
        <EmptyState
          message="No debts yet. Split a purchase or pay with “Someone else” to start one."
          action={emptyAction}
        />
      ) : (
        <div className={viewMode === 'person' ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
          <RelationSection
            title="You owe"
            description="Purchases someone else covered for you."
            relation="payable"
            rows={visiblePayable}
            searching={Boolean(needle)}
            sort={sort}
            showSettled={showSettled}
            viewMode={viewMode}
            onSettle={handleSettle}
            onSettleAll={recordSettlements}
            onPartial={setTarget}
            onRevoke={revokeSettlement}
            onView={handleView}
            isDesktop={isDesktop}
          />
          <RelationSection
            title="Owed to you"
            description="Purchases you covered for someone else."
            relation="receivable"
            rows={visibleReceivable}
            searching={Boolean(needle)}
            sort={sort}
            showSettled={showSettled}
            viewMode={viewMode}
            onSettle={handleSettle}
            onSettleAll={recordSettlements}
            onPartial={setTarget}
            onRevoke={revokeSettlement}
            onView={handleView}
            isDesktop={isDesktop}
          />
        </div>
      )}

      <SettleDialog
        target={target}
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
      />
    </div>
  )
}
