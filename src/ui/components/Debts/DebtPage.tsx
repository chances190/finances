import { UserIcon, UsersIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
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
  ACCOUNT_LABELS,
  buildSettlement,
  CASH_ACCOUNTS,
  daysSince,
  localYMD,
  type OutstandingMovement,
  outstandingMovements,
} from '@/domain/ledger'
import { addCurrency, formatCurrency, parseCurrency } from '@/lib/currency'
import EmptyState from '@/ui/components/Common/EmptyState'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import { useIsDesktop } from '@/ui/hooks/useIsDesktop'

const BADGE_GREEN = 'text-green-600 bg-green-50 '
const BADGE_AMBER = 'text-amber-600 bg-amber-50 '
const BADGE_RED = 'text-red-600 bg-red-50 '

type Relation = 'receivable' | 'payable'
type ViewMode = 'transaction' | 'person'

interface SettleTarget {
  direction: Relation
  counterparty: string
  amount: number
  movementId?: string
}

interface PersonData {
  counterparty: string
  outstanding: number
  total: number
  count: number
  anySettled: boolean
  allSettled: boolean
}

function statusOf(row: OutstandingMovement): { label: string; color: string } {
  if (row.outstanding <= 0.004) return { label: 'Paid', color: BADGE_GREEN }
  if (row.settled > 0.004) return { label: 'Partial', color: BADGE_AMBER }
  return { label: 'Pending', color: BADGE_RED }
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
        anySettled: false,
        allSettled: true,
      }
      map.set(row.counterparty, entry)
    }
    entry.outstanding = addCurrency(entry.outstanding, row.outstanding)
    entry.total = addCurrency(entry.total, row.total)
    entry.count += 1
    entry.anySettled ||= row.settled > 0.004
    entry.allSettled &&= row.outstanding <= 0.004
  }
  return [...map.values()].sort((a, b) => b.outstanding - a.outstanding)
}

function PersonStatus({ person }: { person: PersonData }) {
  if (person.allSettled) {
    return (
      <Badge variant="outline" className={BADGE_GREEN}>
        All paid
      </Badge>
    )
  }
  if (person.anySettled) {
    return (
      <Badge variant="outline" className={BADGE_AMBER}>
        Partial
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={BADGE_RED}>
      Pending
    </Badge>
  )
}

function RelationSection({
  title,
  description,
  relation,
  rows,
  showSettled,
  viewMode,
  onSettle,
  isDesktop,
}: {
  title: string
  description: string
  relation: Relation
  rows: OutstandingMovement[]
  showSettled: boolean
  viewMode: ViewMode
  onSettle: (target: SettleTarget) => void
  isDesktop: boolean
}) {
  const active = showSettled ? rows : rows.filter((row) => row.outstanding > 0.004)
  const people = aggregate(active)
  const outstandingTotal = active.reduce((sum, row) => addCurrency(sum, row.outstanding), 0)

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className={relation === 'receivable' ? BADGE_GREEN : BADGE_AMBER}>
          {formatCurrency(outstandingTotal)}
        </Badge>
      </div>

      {active.length === 0 ? (
        <EmptyState
          message={
            relation === 'receivable'
              ? 'Nobody owes you right now.'
              : 'You do not owe anyone right now.'
          }
        />
      ) : viewMode === 'person' ? (
        isDesktop ? (
          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead className="text-right">
                    {relation === 'receivable' ? 'Owed to you' : 'You owe'}
                  </TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow key={person.counterparty}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1">
                        <UserIcon className="size-3" />
                        {person.counterparty}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(person.outstanding)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(person.total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {person.count}
                    </TableCell>
                    <TableCell>
                      <PersonStatus person={person} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={person.outstanding <= 0.004}
                        onClick={() =>
                          onSettle({
                            direction: relation,
                            counterparty: person.counterparty,
                            amount: person.outstanding,
                          })
                        }
                      >
                        Settle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="space-y-2">
            {people.map((person) => (
              <div
                key={person.counterparty}
                className="flex items-center justify-between gap-3 border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-medium">
                    <UserIcon className="size-3 shrink-0" />
                    <span className="truncate">{person.counterparty}</span>
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatCurrency(person.outstanding)} of {formatCurrency(person.total)}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <PersonStatus person={person} />
                    <span className="text-[10px] text-muted-foreground">
                      {person.count} purchase{person.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={person.outstanding <= 0.004}
                  onClick={() =>
                    onSettle({
                      direction: relation,
                      counterparty: person.counterparty,
                      amount: person.outstanding,
                    })
                  }
                >
                  Settle
                </Button>
              </div>
            ))}
          </div>
        )
      ) : isDesktop ? (
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Purchase</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((row) => {
                const status = statusOf(row)
                const age = daysSince(row.date)
                return (
                  <TableRow key={`${row.movementId}:${row.counterparty}`}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1">
                        <UserIcon className="size-3" />
                        {row.counterparty}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-40 truncate">{row.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.outstanding)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(row.total)}
                    </TableCell>
                    <TableCell className="text-xs">{row.date}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{age}d</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.color}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={row.outstanding <= 0.004}
                        onClick={() =>
                          onSettle({
                            direction: relation,
                            counterparty: row.counterparty,
                            amount: row.outstanding,
                            movementId: row.movementId,
                          })
                        }
                      >
                        Settle
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((row) => {
            const status = statusOf(row)
            const age = daysSince(row.date)
            return (
              <div
                key={`${row.movementId}:${row.counterparty}`}
                className="flex items-start justify-between gap-3 border border-border px-3 py-2"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">{row.description}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserIcon className="size-3 shrink-0" />
                    {row.counterparty}
                  </p>
                  <p className="font-mono text-sm">
                    {formatCurrency(row.outstanding)}{' '}
                    <span className="text-xs text-muted-foreground">
                      of {formatCurrency(row.total)}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className={status.color}>
                      {status.label}
                    </Badge>
                    <span>
                      {row.date} · {age}d
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={row.outstanding <= 0.004}
                  onClick={() =>
                    onSettle({
                      direction: relation,
                      counterparty: row.counterparty,
                      amount: row.outstanding,
                      movementId: row.movementId,
                    })
                  }
                >
                  Settle
                </Button>
              </div>
            )
          })}
        </div>
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
  const [forgiven, setForgiven] = useState('')
  const [account, setAccount] = useState<'checking' | 'voucher' | 'cash'>('checking')
  const [date, setDate] = useState(localYMD())
  const [description, setDescription] = useState('')

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setCash('')
    setForgiven('')
    setAccount('checking')
    setDate(localYMD())
    setDescription(target ? `Settled with ${target.counterparty}` : '')
  }, [target, open])

  function handleSave() {
    if (!target) return
    const paid = parseCurrency(cash)
    const waived = parseCurrency(forgiven)
    const links = target.movementId ? [target.movementId] : undefined

    const settlement =
      target.direction === 'receivable'
        ? buildSettlement(
            {
              id: crypto.randomUUID(),
              date,
              description,
              direction: 'receivable',
              counterparty: target.counterparty,
              received: paid,
              forgiven: waived,
              account,
              ...(links ? { links } : {}),
            },
            state.movements,
          )
        : buildSettlement(
            {
              id: crypto.randomUUID(),
              date,
              description,
              direction: 'payable',
              counterparty: target.counterparty,
              paid,
              forgiven: waived,
              account,
              ...(links ? { links } : {}),
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
          <DialogTitle>
            {target?.direction === 'receivable' ? 'Receive payment' : 'Pay someone'}
          </DialogTitle>
          <DialogDescription>
            {target
              ? `${target.counterparty} · ${formatCurrency(target.amount)} outstanding${target.movementId ? ' on this purchase' : ''}`
              : 'Record a settlement.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="settle-cash" className="text-xs">
                {target?.direction === 'receivable' ? 'Received (R$)' : 'Paid (R$)'}
              </Label>
              <MoneyInput id="settle-cash" value={cash} onValueChange={setCash} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settle-forgiven" className="text-xs">
                Forgiven (R$)
              </Label>
              <MoneyInput id="settle-forgiven" value={forgiven} onValueChange={setForgiven} />
            </div>
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
              <Label htmlFor="settle-account" className="text-xs">
                Account
              </Label>
              <Select
                modal={false}
                value={account}
                onValueChange={(value) =>
                  setAccount((value as 'checking' | 'voucher' | 'cash') ?? 'checking')
                }
              >
                <SelectTrigger id="settle-account" className="w-full">
                  <SelectValue>{ACCOUNT_LABELS[account]}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {CASH_ACCOUNTS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ACCOUNT_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="settle-description" className="text-xs">
              Description
            </Label>
            <Input
              id="settle-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DebtPage() {
  const { state } = useFinance()
  const isDesktop = useIsDesktop()
  const [, navigate] = useLocation()
  const [viewMode, setViewMode] = useState<ViewMode>('transaction')
  const [showSettled, setShowSettled] = useState(false)
  const [target, setTarget] = useState<SettleTarget | null>(null)

  const receivableRows = useMemo(
    () => outstandingMovements(state.movements, 'receivable'),
    [state.movements],
  )
  const payableRows = useMemo(
    () => outstandingMovements(state.movements, 'payable'),
    [state.movements],
  )

  const emptyAction = { label: 'Go to Transactions', onClick: () => navigate('/') }
  const hasAny = receivableRows.length > 0 || payableRows.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Debts</h2>
          <p className="text-xs text-muted-foreground">
            Money people owe you, and money you owe. Settlements never change your spending pace.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            aria-label="Debt view"
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
            options={[
              {
                value: 'transaction',
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
          <label
            htmlFor="show-settled"
            className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground"
          >
            <Checkbox
              id="show-settled"
              checked={showSettled}
              onCheckedChange={(checked) => setShowSettled(checked === true)}
            />
            <span>Show settled</span>
          </label>
        </div>
      </div>

      {!hasAny ? (
        <EmptyState
          message="No debts yet. Split a purchase or pay with “Someone else” to start one."
          action={emptyAction}
        />
      ) : (
        <>
          <RelationSection
            title="Owed to you"
            description="Purchases you covered for someone else."
            relation="receivable"
            rows={receivableRows}
            showSettled={showSettled}
            viewMode={viewMode}
            onSettle={setTarget}
            isDesktop={isDesktop}
          />
          <RelationSection
            title="You owe"
            description="Purchases someone else covered for you."
            relation="payable"
            rows={payableRows}
            showSettled={showSettled}
            viewMode={viewMode}
            onSettle={setTarget}
            isDesktop={isDesktop}
          />
        </>
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
