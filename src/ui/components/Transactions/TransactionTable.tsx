import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  FileArrowDownIcon,
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
import AuditLogPanel from '../Common/AuditLogPanel'
import CSVImportDialog from '../Common/CSVImportDialog'
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
  const [showImport, setShowImport] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const months = useMemo(() => getAvailableMonths(state.transactions), [state.transactions])

  const filtered = useMemo(() => {
    let txs = state.transactions
    if (filterMonth !== 'all') {
      txs = txs.filter((t) => t.referenceMonth === filterMonth)
    }
    return txs.sort((a, b) => b.date.localeCompare(a.date))
  }, [state.transactions, filterMonth])

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id })
  }

  function handleSettle(id: string, currently: boolean) {
    dispatch({ type: 'SETTLE_TRANSACTION', payload: id, settled: !currently })
  }

  function handleEdit(tx: Transaction) {
    setEditingTx(tx)
    setShowForm(true)
  }

  function handleFormClose(open: boolean) {
    setShowForm(open)
    if (!open) setEditingTx(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Transactions</h2>
          <Select value={filterMonth} onValueChange={(v) => setFilterMonth(v ?? 'all')}>
            <SelectTrigger className="w-36">
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
          <Button variant="ghost" size="xs" onClick={() => setShowAudit(!showAudit)}>
            <ArrowCounterClockwiseIcon />{' '}
            {state.auditLog.length > 0 ? `Undo (${state.auditLog.length})` : 'History'}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="xs" onClick={() => setShowImport(true)}>
            <FileArrowDownIcon /> Import
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <PlusIcon /> Add
          </Button>
        </div>
      </div>

      {showAudit && <AuditLogPanel onClose={() => setShowAudit(false)} />}

      <div className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  No transactions yet. Click "Add" to create one.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((tx) => (
              <TableRow
                key={tx.id}
                className={`cursor-pointer ${tx.isSettled ? 'opacity-50' : ''}`}
                onClick={() => !tx.parentId && handleEdit(tx)}
              >
                <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                <TableCell>
                  <Badge variant={tx.type === 'INCOME' ? 'default' : 'secondary'}>
                    {TRANSACTION_TYPE_LABELS[tx.type]}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-48 truncate">
                  {tx.description}
                  {tx.parentId && (
                    <span className="text-muted-foreground ml-1 text-[10px]">(installment)</span>
                  )}
                  {tx.debtSplits && tx.debtSplits.length > 1 && (
                    <span className="text-muted-foreground ml-1 text-[10px]">
                      ({tx.debtSplits.length} debtors)
                    </span>
                  )}
                </TableCell>
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
                  <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {tx.isDebt && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleSettle(tx.id, tx.isSettled)}
                      >
                        <CheckCircleIcon />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(tx.id)}>
                      <TrashIcon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TransactionForm open={showForm} onOpenChange={handleFormClose} editTransaction={editingTx} />

      <CSVImportDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  )
}
