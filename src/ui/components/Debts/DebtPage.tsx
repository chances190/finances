import { CheckCircleIcon, UserIcon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { activeDebts, daysSince } from '@/domain/calculations'
import { formatCurrency } from '@/lib/format'
import { useFinance } from '@/ui/context'

function DebtUrgency({ days }: { days: number }) {
  const color =
    days > 30
      ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
      : days > 15
        ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
        : 'text-green-600 bg-green-50 dark:bg-green-900/20'
  return (
    <Badge variant="outline" className={color}>
      {days}d
    </Badge>
  )
}

export default function DebtPage() {
  const { state, dispatch } = useFinance()

  const debts = useMemo(() => activeDebts(state.transactions), [state.transactions])

  function handleSettle(id: string) {
    dispatch({ type: 'SETTLE_TRANSACTION', payload: id, settled: true })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Active Debts (who owes me)</h2>

      {debts.length === 0 ? (
        <div className="border border-border p-8 text-center text-muted-foreground text-sm">
          No active debts.
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
              {debts.map((tx) => {
                const days = daysSince(tx.date)
                const splits = tx.debtSplits?.filter((s) => s.amount > 0) ?? []
                return (
                  <TableRow key={tx.id}>
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
                      <DebtUrgency days={days} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                    <TableCell>
                      {splits.length > 1 ? (
                        <div className="text-xs space-y-0.5">
                          {splits.map((s) => (
                            <div key={s.debtorName} className="text-muted-foreground">
                              {s.debtorName}: {formatCurrency(s.amount)}
                            </div>
                          ))}
                        </div>
                      ) : splits.length === 1 ? (
                        <span className="text-xs text-muted-foreground">100%</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleSettle(tx.id)}>
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
