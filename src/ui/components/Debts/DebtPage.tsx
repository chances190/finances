import { CheckCircleIcon, UserIcon, UsersIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
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
import { addCurrency, formatCurrency } from '@/lib/currency'
import EmptyState from '@/ui/components/Common/EmptyState'
import { useFinance } from '@/ui/context'
import { useIsDesktop } from '@/ui/hooks/useIsDesktop'

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

function PersonCard({ person, onOpen }: { person: PersonData; onOpen: () => void }) {
  return (
    <div className={`px-3 pt-0 pb-3 ${person.allSettled ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 py-3 text-left"
      >
        <UserIcon className="size-3 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span>
        {person.allSettled ? (
          <Badge variant="outline" className={BADGE_GREEN}>
            All paid
          </Badge>
        ) : person.anySettled ? (
          <Badge variant="outline" className={BADGE_AMBER}>
            Partial
          </Badge>
        ) : (
          <Badge variant="outline" className={BADGE_RED}>
            Pending
          </Badge>
        )}
      </button>
      <div className="-mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Unsettled{' '}
          <span className="font-mono text-foreground">
            {formatCurrency(person.unsettledAmount)}
          </span>
        </span>
        <span>
          Total lent{' '}
          <span className="font-mono text-foreground">{formatCurrency(person.totalAmount)}</span>
        </span>
        <span>{person.txCount} transactions</span>
      </div>
    </div>
  )
}

function DebtorCard({
  tx,
  onOpen,
  onToggleSettle,
  onSettleAll,
}: {
  tx: Transaction
  onOpen: () => void
  onToggleSettle: (name: string) => void
  onSettleAll: () => void
}) {
  const days = daysSince(tx.date)
  const allSettled = tx.debts?.every((d) => d.settled) ?? true
  const debtNames = [...new Set(tx.debts?.map((d) => d.name) ?? [])]
  const splitCount = tx.debts?.length ?? 0
  const singleSplit = tx.debts?.[0]

  return (
    <div className={`px-3 pt-0 pb-3 ${allSettled ? 'opacity-50' : ''}`}>
      <button type="button" onClick={onOpen} className="w-full py-3 text-left">
        <span className="flex items-start gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1 text-sm font-medium">
            <UserIcon className="size-3 shrink-0" />
            <span className="truncate">{debtNames.length === 1 ? debtNames[0] : 'Multiple'}</span>
          </span>
          <span className="shrink-0 font-mono text-sm">{formatCurrency(tx.amount)}</span>
        </span>
        <span className="mt-1 block truncate text-xs">{tx.description}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          {allSettled ? (
            <Badge variant="outline" className={BADGE_GREEN}>
              Paid
            </Badge>
          ) : (
            <DebtUrgency days={days} />
          )}
          <span className="text-xs text-muted-foreground">lent {tx.date}</span>
        </span>
      </button>

      <div className="mt-1 space-y-1 border-t border-border pt-2">
        {splitCount > 1 ? (
          tx.debts?.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-2">
              <span className={`text-xs text-muted-foreground ${d.settled ? 'line-through' : ''}`}>
                {d.name}: {formatCurrency(d.amount)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={() => onToggleSettle(d.name)}
                title={d.settled ? `Unsettle ${d.name}` : `Settle ${d.name}`}
                aria-label={d.settled ? `Unsettle ${d.name}` : `Settle ${d.name}`}
              >
                <CheckCircleIcon />
              </Button>
            </div>
          ))
        ) : singleSplit ? (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3 text-xs"
              onClick={() => onToggleSettle(singleSplit.name)}
              title={singleSplit.settled ? 'Unsettle' : 'Settle'}
              aria-label={singleSplit.settled ? 'Unsettle' : 'Settle'}
            >
              {singleSplit.settled ? 'Settled' : '100%'}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={onSettleAll}
            title={allSettled ? 'Unsettle all' : 'Settle all'}
            aria-label={allSettled ? 'Unsettle all' : 'Settle all'}
          >
            <CheckCircleIcon />
          </Button>
        </div>
      </div>
    </div>
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
    const debts = tx.debts?.filter((d) => d.amount > 0) ?? []
    for (const d of debts) {
      let entry = map.get(d.name)
      if (!entry) {
        entry = {
          unsettledAmount: 0,
          totalAmount: 0,
          txCount: 0,
          anySettled: false,
          allSettled: true,
        }
        map.set(d.name, entry)
      }
      entry.totalAmount = addCurrency(entry.totalAmount, d.amount)
      entry.anySettled ||= d.settled
      if (!d.settled) {
        entry.unsettledAmount = addCurrency(entry.unsettledAmount, d.amount)
        entry.allSettled = false
      }
    }
    for (const name of new Set(debts.map((d) => d.name))) {
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
  const isDesktop = useIsDesktop()
  const [, navigate] = useLocation()
  const [showSettled, setShowSettled] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('transaction')

  const debts = useMemo(
    () =>
      state.transactions.filter(
        (t) => t.debts && t.debts.length > 0 && (showSettled || t.debts.some((d) => !d.settled)),
      ),
    [state.transactions, showSettled],
  )

  const personView = useMemo(
    () => aggregatePersonData(debts).filter((d) => showSettled || d.unsettledAmount > 0),
    [debts, showSettled],
  )

  function handleToggleSettle(id: string, debtName: string) {
    dispatch({ type: 'SETTLE_DEBT', payload: { transactionId: id, debtName } })
  }

  function handleSettleAll(id: string) {
    const tx = state.transactions.find((t) => t.id === id)
    if (!tx?.debts) return
    for (const d of tx.debts) {
      dispatch({ type: 'SETTLE_DEBT', payload: { transactionId: id, debtName: d.name } })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {showSettled ? 'All Debts' : 'Active Debts (who owes me)'}
        </h2>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
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

      {isDesktop && viewMode === 'person' && personView.length > 0 && (
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
                <TableRow
                  key={p.name}
                  className={`${p.allSettled ? 'opacity-50' : ''} cursor-pointer hover:bg-muted/50`}
                  onClick={() => navigate(`/?debtor=${encodeURIComponent(p.name)}`)}
                >
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
      )}

      {isDesktop && !(viewMode === 'person' && personView.length > 0) && (
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debtor</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Date Lent</TableHead>
                <TableHead>Debts</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      variant="cell"
                      message={`No ${showSettled ? 'debts' : 'active debts'}.`}
                    />
                  </TableCell>
                </TableRow>
              )}
              {debts.map((tx) => {
                const days = daysSince(tx.date)
                const allSettled = tx.debts?.every((d) => d.settled) ?? true
                const debtNames = [...new Set(tx.debts?.map((d) => d.name) ?? [])]
                const splitCount = tx.debts?.length ?? 0
                const singleSplit = tx.debts?.[0]
                return (
                  <TableRow
                    key={tx.id}
                    className={`${allSettled ? 'opacity-50' : ''} cursor-pointer hover:bg-muted/50`}
                    onClick={() => navigate(`/?tx=${tx.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        <UserIcon className="size-3" />
                        {debtNames.length === 1 ? debtNames[0] : 'Multiple'}
                      </div>
                    </TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      {allSettled ? (
                        <Badge variant="outline" className={BADGE_GREEN}>
                          Paid
                        </Badge>
                      ) : (
                        <DebtUrgency days={days} />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                    <TableCell>
                      {splitCount > 1 ? (
                        <div className="text-xs space-y-0.5">
                          {tx.debts?.map((d) => (
                            <div key={d.name} className="flex items-center justify-between gap-2">
                              <span
                                className={`text-muted-foreground ${d.settled ? 'line-through' : ''}`}
                              >
                                {d.name}: {formatCurrency(d.amount)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleSettle(tx.id, d.name)
                                }}
                                title={d.settled ? `Unsettle ${d.name}` : `Settle ${d.name}`}
                                aria-label={d.settled ? `Unsettle ${d.name}` : `Settle ${d.name}`}
                              >
                                <CheckCircleIcon />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : singleSplit ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-xs text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleSettle(tx.id, singleSplit.name)
                          }}
                          title={singleSplit.settled ? 'Unsettle' : 'Settle'}
                          aria-label={singleSplit.settled ? 'Unsettle' : 'Settle'}
                        >
                          {singleSplit.settled ? 'Settled' : '100%'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSettleAll(tx.id)
                        }}
                        title={allSettled ? 'Unsettle all' : 'Settle all'}
                        aria-label={allSettled ? 'Unsettle all' : 'Settle all'}
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

      {!isDesktop && viewMode === 'person' && personView.length > 0 && (
        <div className="border border-border">
          {personView.map((p) => (
            <div key={p.name} className="border-b border-border last:border-b-0">
              <PersonCard
                person={p}
                onOpen={() => navigate(`/?debtor=${encodeURIComponent(p.name)}`)}
              />
            </div>
          ))}
        </div>
      )}

      {!isDesktop && !(viewMode === 'person' && personView.length > 0) && (
        <div className="border border-border">
          {debts.length === 0 ? (
            <EmptyState message={`No ${showSettled ? 'debts' : 'active debts'}.`} />
          ) : (
            debts.map((tx) => (
              <div key={tx.id} className="border-b border-border last:border-b-0">
                <DebtorCard
                  tx={tx}
                  onOpen={() => navigate(`/?tx=${tx.id}`)}
                  onToggleSettle={(name) => handleToggleSettle(tx.id, name)}
                  onSettleAll={() => handleSettleAll(tx.id)}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
