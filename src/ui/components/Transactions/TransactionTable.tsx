import {
  CheckCircleIcon,
  FunnelIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { availableMonths, compareTransactions, monthRelation } from '@/domain/calculations'
import { getAllCategories } from '@/domain/categories'
import {
  INCOME_PAYMENT_METHODS,
  PAYMENT_METHOD_BADGE_COLORS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from '@/domain/constants'
import type { PaymentMethod, Transaction } from '@/domain/entities'
import { formatCurrency, parseCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import CSVImportDialog from '@/ui/components/Common/CSVImportDialog'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import SmartTransactionInput from './SmartTransactionInput'
import TransactionForm from './TransactionForm'

function PaymentBadge({ method }: { method: string }) {
  return (
    <Badge variant="outline" className={PAYMENT_METHOD_BADGE_COLORS[method] ?? ''}>
      {PAYMENT_METHOD_LABELS[method] ?? method}
    </Badge>
  )
}

export default function TransactionTable() {
  const { state, dispatch } = useFinance()
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterCategories, setFilterCategories] = useState<string[]>([])
  const [filterPayments, setFilterPayments] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 150)
    return () => clearTimeout(searchTimer.current)
  }, [searchQuery])
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImportCsv, setShowImportCsv] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  const months = useMemo(() => availableMonths(state.transactions), [state.transactions])

  const knownDescriptions = useMemo(() => {
    const descs = new Set<string>()
    for (const t of state.transactions) {
      if (t.description) descs.add(t.description)
    }
    return Array.from(descs).sort()
  }, [state.transactions])

  const allCategories = useMemo(
    () => getAllCategories(state.budgets, state.transactions),
    [state.budgets, state.transactions],
  )

  const filtered = useMemo(() => {
    let txs = state.transactions
    if (filterMonth !== 'all') {
      txs = txs.filter((t) => t.referenceMonth === filterMonth)
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      txs = txs.filter((t) => t.description.toLowerCase().includes(q))
    }
    if (filterCategories.length > 0) {
      txs = txs.filter((t) => filterCategories.includes(t.category))
    }
    if (filterPayments.length > 0) {
      txs = txs.filter((t) => filterPayments.includes(t.paymentMethod))
    }
    if (sortKey) {
      txs = [...txs].sort((a, b) =>
        compareTransactions(a, b, sortKey as keyof Transaction, sortDir),
      )
    } else {
      txs = [...txs].sort((a, b) => b.date.localeCompare(a.date))
    }
    return txs
  }, [
    state.transactions,
    filterMonth,
    debouncedSearch,
    filterCategories,
    filterPayments,
    sortKey,
    sortDir,
  ])

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'desc') {
        setSortDir('asc')
      } else {
        setSortKey(null)
        setSortDir('desc')
      }
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIndicator = (key: string) => {
    if (sortKey !== key) return null
    return sortDir === 'asc' ? (
      <SortAscendingIcon className="size-3 inline ml-0.5" />
    ) : (
      <SortDescendingIcon className="size-3 inline ml-0.5" />
    )
  }

  function handleSmartAdd(row: {
    description: string
    amount: string
    category: string | null
    paymentMethod: string | null
    date: string
    error: string | null
  }) {
    const amount = parseCurrency(row.amount)
    if (amount <= 0) return

    const isIncome =
      row.paymentMethod && INCOME_PAYMENT_METHODS.includes(row.paymentMethod as PaymentMethod)

    const refMonth = row.date.slice(0, 7)
    const tx: Omit<Transaction, 'id'> = {
      type: isIncome ? 'INCOME' : 'EXPENSE',
      date: row.date,
      referenceMonth: refMonth,
      description: row.description,
      amount,
      category: row.category ?? 'Other',
      paymentMethod: (row.paymentMethod ?? 'DEBIT') as PaymentMethod,
      isDebt: false,
      isSettled: false,
    }

    dispatch({ type: 'ADD_TRANSACTIONS', payload: [{ ...tx, id: uuid() }] })
    toast('Transaction added', 'success')
  }

  function handleDelete(id: string) {
    setConfirmDeleteId(id)
  }

  function handleConfirmDelete() {
    if (confirmDeleteId) {
      dispatch({ type: 'DELETE_TRANSACTION', payload: confirmDeleteId })
      setConfirmDeleteId(null)
    }
  }

  function handleSettle(id: string, currently: boolean, debtorName?: string) {
    if (debtorName) {
      dispatch({ type: 'SETTLE_TRANSACTION', payload: id, debtorName })
    } else {
      dispatch({ type: 'SETTLE_TRANSACTION', payload: id, settled: !currently })
    }
  }

  function handleEdit(tx: Transaction) {
    setEditingTx(tx)
    setShowEditForm(true)
  }

  function handleFormClose(open: boolean) {
    setShowEditForm(open)
    if (!open) setEditingTx(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Transactions</h2>
      <SmartTransactionInput
        onAdd={handleSmartAdd}
        onOpenModal={() => setShowAddForm(true)}
        onOpenImport={() => setShowImportCsv(true)}
        knownDescriptions={knownDescriptions}
        categories={allCategories}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-7 w-44 text-xs"
          aria-label="Search transactions"
        />
        <Select value={filterMonth} onValueChange={(v) => setFilterMonth(v ?? 'all')}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m) => {
              const rel = monthRelation(m)
              return (
                <SelectItem
                  key={m}
                  value={m}
                  className={
                    rel === 'future'
                      ? 'text-muted-foreground/60'
                      : rel === 'current'
                        ? 'text-primary font-medium'
                        : ''
                  }
                >
                  {m}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <FunnelIcon className="size-3" />
            Category{filterCategories.length > 0 && ` (${filterCategories.length})`}
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {allCategories.map((cat) => (
                <span key={cat} className="flex items-center gap-2 py-1 cursor-pointer">
                  <Checkbox
                    id={`cat-filter-${cat}`}
                    checked={filterCategories.includes(cat)}
                    onCheckedChange={(checked) => {
                      setFilterCategories(
                        checked
                          ? [...filterCategories, cat]
                          : filterCategories.filter((c) => c !== cat),
                      )
                    }}
                  />
                  <span className="text-xs">{cat}</span>
                </span>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <FunnelIcon className="size-3" />
            Payment{filterPayments.length > 0 && ` (${filterPayments.length})`}
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...PAYMENT_METHODS, ...INCOME_PAYMENT_METHODS].map((pm) => {
                const key = pm
                return (
                  <span key={key} className="flex items-center gap-2 py-1 cursor-pointer">
                    <Checkbox
                      id={`pay-filter-${key}`}
                      checked={filterPayments.includes(key)}
                      onCheckedChange={(checked) => {
                        setFilterPayments(
                          checked
                            ? [...filterPayments, key]
                            : filterPayments.filter((p) => p !== key),
                        )
                      }}
                    />
                    <span className="text-xs">{PAYMENT_METHOD_LABELS[key] ?? key}</span>
                  </span>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-20 cursor-pointer select-none"
                onClick={() => handleSort('referenceMonth')}
              >
                Period{sortIndicator('referenceMonth')}
              </TableHead>
              <TableHead
                className="w-20 cursor-pointer select-none"
                onClick={() => handleSort('date')}
              >
                Date{sortIndicator('date')}
              </TableHead>
              <TableHead
                className="w-14 cursor-pointer select-none"
                onClick={() => handleSort('type')}
              >
                Type{sortIndicator('type')}
              </TableHead>
              <TableHead
                className="flex-1 cursor-pointer select-none"
                onClick={() => handleSort('description')}
              >
                Description{sortIndicator('description')}
              </TableHead>
              <TableHead
                className="w-20 cursor-pointer select-none"
                onClick={() => handleSort('category')}
              >
                Category{sortIndicator('category')}
              </TableHead>
              <TableHead
                className="text-right w-24 cursor-pointer select-none"
                onClick={() => handleSort('amount')}
              >
                Amount{sortIndicator('amount')}
              </TableHead>
              <TableHead
                className="w-20 cursor-pointer select-none"
                onClick={() => handleSort('paymentMethod')}
              >
                Payment{sortIndicator('paymentMethod')}
              </TableHead>
              <TableHead className="w-16 text-center">Install</TableHead>
              <TableHead className="w-32">Details</TableHead>
              <TableHead className="text-right w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No transactions yet. Add one using the row above or import a CSV file.
                </TableCell>
              </TableRow>
            )}

            {filtered.map((tx) => {
              const isFullSettled =
                tx.isSettled && (tx.debtUserShare == null || tx.debtUserShare === 0)
              return (
                <TableRow
                  key={tx.id}
                  className="cursor-pointer"
                  onClick={() => !tx.parentId && handleEdit(tx)}
                >
                  <TableCell className="text-xs text-muted-foreground">
                    {tx.referenceMonth}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{tx.date}</TableCell>
                  <TableCell className="text-xs">
                    {tx.type === 'INCOME' ? (
                      <span className="text-green-600 font-medium">+</span>
                    ) : (
                      <span className="text-red-600 font-medium">−</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="max-w-48 truncate">
                        {tx.description}
                        {tx.parentId && (
                          <span className="text-muted-foreground ml-1 text-[10px]">
                            (installment)
                          </span>
                        )}
                      </div>
                      {isFullSettled && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-green-600 bg-green-50 dark:bg-green-900/20"
                        >
                          Paid
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{tx.category}</TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs ${tx.type === 'INCOME' ? 'text-green-600' : ''}`}
                  >
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <PaymentBadge method={tx.paymentMethod} />
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {tx.installment ? (
                      <Badge variant="outline" className="text-xs">
                        {tx.installment.current}/{tx.installment.total}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {tx.isDebt ? (
                      <div className="text-xs space-y-0.5">
                        {tx.debtUserShare != null && tx.debtUserShare > 0 && (
                          <div className="text-muted-foreground">
                            Me: {formatCurrency(tx.debtUserShare)}
                          </div>
                        )}
                        {tx.debtSplits?.map((s) => {
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSettle(tx.id, tx.isSettled, s.debtorName)
                                }}
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
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <span className="flex gap-1 justify-end">
                      {tx.isDebt && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleSettle(tx.id, tx.isSettled)}
                          title={tx.isSettled ? 'Unsettle' : 'Settle debt'}
                          aria-label={tx.isSettled ? 'Unsettle debt' : 'Settle debt'}
                        >
                          <CheckCircleIcon />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(tx.id)}
                        aria-label="Delete transaction"
                      >
                        <TrashIcon />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <TransactionForm
        open={showEditForm}
        onOpenChange={handleFormClose}
        editTransaction={editingTx}
      />

      <TransactionForm open={showAddForm} onOpenChange={setShowAddForm} />

      <CSVImportDialog open={showImportCsv} onOpenChange={setShowImportCsv} />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDeleteId(null)
        }}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? You can undo this with Ctrl+Z."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
