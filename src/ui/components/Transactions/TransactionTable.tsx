import {
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS } from '@/domain/constants'
import type { Transaction } from '@/domain/entities'
import { useFinance } from '@/ui/context'
import TransactionForm from './TransactionForm'

function formatCurrency(n: number): string {
  return `R$ ${n.toFixed(2)}`
}

function PaymentBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    CREDIT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    DEBIT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    PIX: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    CASH: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    MEAL_VOUCHER: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  }
  return (
    <Badge variant="outline" className={colors[method] ?? ''}>
      {PAYMENT_METHOD_LABELS[method] ?? method}
    </Badge>
  )
}

function getAvailableMonths(tx: Transaction[]): string[] {
  const months = new Set(tx.map((t) => t.referenceMonth))
  return Array.from(months).sort().reverse()
}

export default function TransactionTable() {
  const { state, dispatch } = useFinance()
  const [showForm, setShowForm] = useState(false)
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const months = useMemo(() => getAvailableMonths(state.transactions), [state.transactions])

  const filtered = useMemo(() => {
    let txs = state.transactions
    if (filterMonth !== 'all') {
      txs = txs.filter((t) => t.referenceMonth === filterMonth)
    }
    return txs.sort((a, b) => b.date.localeCompare(a.date))
  }, [state.transactions, filterMonth])

  function toggleGroup(groupId?: string) {
    if (!groupId) return
    const next = new Set(expandedGroups)
    if (next.has(groupId)) next.delete(groupId)
    else next.add(groupId)
    setExpandedGroups(next)
  }

  function hasChildren(t: Transaction): boolean {
    return state.transactions.some(
      (c) => c.parentId === t.groupId || (c.groupId === t.groupId && c.id !== t.id),
    )
  }

  function getChildren(t: Transaction): Transaction[] {
    return state.transactions.filter(
      (c) => c.parentId === t.groupId || (c.groupId === t.groupId && c.id !== t.id),
    )
  }

  function handleDelete(id: string) {
    if (confirm('Delete this transaction and all related installment records?')) {
      dispatch({ type: 'DELETE_TRANSACTION', payload: id })
    }
  }

  function handleSettle(id: string) {
    dispatch({ type: 'SETTLE_TRANSACTION', payload: id })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Transactions</h2>
          <Select value={filterMonth} onValueChange={(v) => setFilterMonth(v ?? 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <PlusIcon /> Add Transaction
        </Button>
      </div>

      <div className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tx) => {
              const isInstallmentParent = !!(tx.groupId && !tx.parentId && hasChildren(tx))
              const children = isInstallmentParent ? getChildren(tx) : []
              const isExpanded = expandedGroups.has(tx.groupId ?? '')
              const isChild = !!tx.parentId

              if (isChild) return null

              return (
                <TableRow key={tx.id} className={tx.isSettled ? 'opacity-50' : ''}>
                  <TableCell>
                    {children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(tx.groupId)}
                        className="cursor-pointer"
                      >
                        {isExpanded ? <CaretDownIcon /> : <CaretRightIcon />}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'INCOME' ? 'default' : 'secondary'}>
                      {TRANSACTION_TYPE_LABELS[tx.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-40 truncate">{tx.description}</TableCell>
                  <TableCell>{tx.category}</TableCell>
                  <TableCell
                    className={`text-right font-mono ${tx.type === 'INCOME' ? 'text-green-600' : ''}`}
                  >
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <PaymentBadge method={tx.paymentMethod} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tx.referenceMonth}</TableCell>
                  <TableCell>
                    {tx.isSettled ? (
                      <Badge variant="outline" className="text-green-600">
                        Settled
                      </Badge>
                    ) : tx.isDebt ? (
                      <Badge variant="outline" className="text-amber-600">
                        Active
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      {!tx.isSettled && (
                        <Button variant="ghost" size="icon-xs" onClick={() => handleSettle(tx.id)}>
                          <CheckCircleIcon />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(tx.id)}>
                        <TrashIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <TransactionForm open={showForm} onOpenChange={setShowForm} />
    </div>
  )
}
