import { CheckCircleIcon, UserIcon, UsersIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { daysSince } from '@/domain/calculations'
import type { Transaction } from '@/domain/entities'
import { formatCurrency } from '@/lib/currency'
import { useFinance } from '@/ui/context'

const BADGE_GREEN = 'text-green-600 bg-green-50 '
const BADGE_AMBER = 'text-amber-600 bg-amber-50 '
const BADGE_RED = 'text-red-600 bg-red-50 '

function DebtUrgency({ days }: { days: number }) {
  const urgency =
    days > 30
      ? { label: 'Overdue', color: BADGE_RED }
      : days > 15
        ? { label: 'Aging', color: BADGE_AMBER }
        : { label: 'Recent', color: BADGE_GREEN }
  return (
    <Badge variant="outline" className={urgency.color}>
      {urgency.label} ({days}d)
    </Badge>
  )
}

type ViewMode = 'transaction' | 'person'

interface PersonData {
  name: string
  unsettledAmount: number
  totalAmount: number
  txCount: number
  anySettled: boolean
  allSettled: boolean
}

function aggregatePersonData(transactions: Transaction[]): PersonData[] {
  const map = new Map<string, Omit<PersonData, 'name'>>()
  for (const tx of transactions) {
    const splits = tx.debtSplits?.filter((s) => s.amount > 0) ?? []
    for (const s of splits) {
      const settled = s.settled ?? tx.isSettled
      let entry = map.get(s.debtorName)
      if (!entry) {
        entry = {
          unsettledAmount: 0,
          totalAmount: 0,
          txCount: 0,
          anySettled: false,
          allSettled: true,
        }
        map.set(s.debtorName, entry)
      }
      entry.totalAmount += s.amount
      entry.anySettled ||= settled
      if (!settled) {
        entry.unsettledAmount += s.amount
        entry.allSettled = false
      }
    }
    for (const name of new Set(splits.map((s) => s.debtorName))) {
      const entry = map.get(name)
      if (entry) entry.txCount++
    }
  }
  return [...map.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.unsettledAmount - a.unsettledAmount)
}

export default function DebtPage() {
  const { state, dispatch } = useFinance()
  const [showSettled, setShowSettled] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('transaction')

  const debts = useMemo(
    () => state.transactions.filter((t) => t.isDebt && (showSettled || !t.isSettled)),
    [state.transactions, showSettled],
  )

  const personView = useMemo(
    () => aggregatePersonData(debts).filter((d) => showSettled || d.unsettledAmount > 0),
    [debts, showSettled],
  )

  function handleToggleSettle(id: string, settled: boolean, debtorName?: string) {
    if (debtorName) {
      dispatch({ type: 'SETTLE_TRANSACTION', payload: id, debtorName })
    } else {
      dispatch({ type: 'SETTLE_TRANSACTION', payload: id, settled: !settled })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {showSettled ? 'All Debts' : 'Active Debts (who owes me)'}
        </h2>
        <div className="flex items-center gap-3">
          <SegmentedControl
            aria-label="Debt view"
            value={viewMode}
            onValueChange={(v) => setViewMode(v as ViewMode)}
            options={[
              {
                value: 'transaction',
                label: 'Per-Tx',
                icon: <UserIcon className="size-3" />,
              },
              {
                value: 'person',
                label: 'Per-Person',
                icon: <UsersIcon className="size-3" />,
              },
            ]}
          />
          <span className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              id="show-settled"
              checked={showSettled}
              onCheckedChange={(c) => setShowSettled(c === true)}
              aria-labelledby="show-settled-label"
            />
            <span id="show-settled-label">Show settled</span>
          </span>
        </div>
      </div>

      {viewMode === 'person' && personView.length > 0 ? (
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Unsettled</TableHead>
                <TableHead className="text-right">Total Lent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personView.map((p) => (
                <TableRow key={p.name} className={p.allSettled ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1">
                      <UserIcon className="size-3" />
                      {p.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(p.unsettledAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatCurrency(p.totalAmount)}
                  </TableCell>
                  <TableCell>
                    {p.allSettled ? (
                      <Badge variant="outline" className={BADGE_GREEN}>
                        All paid
                      </Badge>
                    ) : p.anySettled ? (
                      <Badge variant="outline" className={BADGE_AMBER}>
                        Partial
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={BADGE_RED}>
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {p.txCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debtor</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Date Lent</TableHead>
                <TableHead>Splits</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No {showSettled ? 'debts' : 'active debts'}.
                  </TableCell>
                </TableRow>
              )}
              {debts.map((tx) => {
                const days = daysSince(tx.date)
                const splits = tx.debtSplits?.filter((s) => s.amount > 0) ?? []
                return (
                  <TableRow key={tx.id} className={tx.isSettled ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        <UserIcon className="size-3" />
                        {splits.length === 1 ? splits[0].debtorName : tx.debtorName || 'Multiple'}
                      </div>
                    </TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      {tx.isSettled ? (
                        <Badge variant="outline" className={BADGE_GREEN}>
                          Paid
                        </Badge>
                      ) : (
                        <DebtUrgency days={days} />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                    <TableCell>
                      {splits.length > 1 ? (
                        <div className="text-xs space-y-0.5">
                          {splits.map((s) => {
                            const splitSettled = s.settled ?? tx.isSettled
                            return (
                              <div
                                key={s.debtorName}
                                className="flex items-center justify-between gap-2"
                              >
                                <span
                                  className={`text-muted-foreground ${splitSettled ? 'line-through' : ''}`}
                                >
                                  {s.debtorName}: {formatCurrency(s.amount)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() =>
                                    handleToggleSettle(tx.id, tx.isSettled, s.debtorName)
                                  }
                                  title={
                                    splitSettled
                                      ? `Unsettle ${s.debtorName}`
                                      : `Settle ${s.debtorName}`
                                  }
                                  aria-label={
                                    splitSettled
                                      ? `Unsettle ${s.debtorName}`
                                      : `Settle ${s.debtorName}`
                                  }
                                >
                                  <CheckCircleIcon />
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      ) : splits.length === 1 ? (
                        <span className="text-xs text-muted-foreground">
                          {(splits[0].settled ?? tx.isSettled) ? 'Settled' : '100%'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleSettle(tx.id, tx.isSettled)}
                        title={tx.isSettled ? 'Unsettle all' : 'Settle all'}
                        aria-label={tx.isSettled ? 'Unsettle all' : 'Settle all'}
                      >
                        <CheckCircleIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
