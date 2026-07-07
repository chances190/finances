import { CheckCircleIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { availableMonths, generateInstallments, monthRelation } from '@/domain/calculations'
import {
  PAYMENT_METHOD_BADGE_COLORS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from '@/domain/constants'
import type { DebtConfig, PaymentMethod, Transaction, TransactionType } from '@/domain/entities'
import { formatCurrency, parseCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import DebtConfigModal from './DebtConfigModal'
import QuickAddRow from './QuickAddRow'
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
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 150)
    return () => clearTimeout(searchTimer.current)
  }, [searchQuery])
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPayment, setFilterPayment] = useState<string>('all')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDebtModal, setShowDebtModal] = useState(false)
  const [debtModalCallback, setDebtModalCallback] = useState<((config: DebtConfig) => void) | null>(
    null,
  )
  const [debtModalAmount, setDebtModalAmount] = useState(0)
  const [tempDebtConfig, setTempDebtConfig] = useState<DebtConfig>({ userShare: 0, splits: [] })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [defaultCategory, setDefaultCategory] = useState<string | null>(null)
  const [defaultPayment, setDefaultPayment] = useState<PaymentMethod | null>(null)
  const { toast } = useToast()

  const months = useMemo(() => availableMonths(state.transactions), [state.transactions])

  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const t of state.transactions) cats.add(t.category)
    return Array.from(cats).sort()
  }, [state.transactions])

  const filtered = useMemo(() => {
    let txs = state.transactions
    if (filterMonth !== 'all') {
      txs = txs.filter((t) => t.referenceMonth === filterMonth)
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      txs = txs.filter((t) => t.description.toLowerCase().includes(q))
    }
    if (filterCategory !== 'all') {
      txs = txs.filter((t) => t.category === filterCategory)
    }
    if (filterPayment !== 'all') {
      txs = txs.filter((t) => t.paymentMethod === filterPayment)
    }
    return txs.sort((a, b) => b.date.localeCompare(a.date))
  }, [state.transactions, filterMonth, debouncedSearch, filterCategory, filterPayment])

  const displayRefMonth =
    filterMonth !== 'all'
      ? filterMonth
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  function handleQuickAdd(
    rowData: {
      type: TransactionType
      description: string
      date: string
      amount: string
      category: string
      paymentMethod: PaymentMethod
      installmentTotal: number
      isDebt: boolean
    },
    refMonth: string,
    debtConfig?: DebtConfig,
  ) {
    const amount = parseCurrency(rowData.amount)
    if (amount <= 0) return

    const isDebt = rowData.isDebt || (!!debtConfig && debtConfig.splits.length > 0)

    const tx: Omit<Transaction, 'id'> = {
      type: rowData.type,
      date: rowData.date,
      referenceMonth: refMonth,
      description: rowData.description,
      amount,
      category: rowData.category,
      paymentMethod: rowData.paymentMethod,
      isDebt,
      debtUserShare: debtConfig ? debtConfig.userShare : undefined,
      debtSplits:
        debtConfig && debtConfig.splits.length > 0
          ? debtConfig.splits.map((s) => ({ debtorName: s.name, amount: s.amount }))
          : undefined,
      isSettled: false,
    }

    setDefaultCategory(rowData.category)
    setDefaultPayment(rowData.paymentMethod)

    if (rowData.paymentMethod === 'CREDIT' && rowData.installmentTotal > 1) {
      const groupId = uuid()
      const txs = generateInstallments(tx, rowData.installmentTotal, groupId)
      dispatch({ type: 'ADD_TRANSACTIONS', payload: txs.map((t) => ({ ...t, id: uuid() })) })
      toast(`Added ${rowData.installmentTotal} installments`, 'success')
    } else {
      dispatch({ type: 'ADD_TRANSACTIONS', payload: [{ ...tx, id: uuid() }] })
      toast('Transaction added', 'success')
    }
  }

  function handleOpenDebtModal(callback: (config: DebtConfig) => void, totalAmount: number) {
    setDebtModalCallback(() => callback)
    setDebtModalAmount(totalAmount)
    setTempDebtConfig({ userShare: 0, splits: [] })
    setShowDebtModal(true)
  }

  function handleDebtModalSave(config: DebtConfig) {
    if (debtModalCallback) {
      debtModalCallback(config)
    }
    setShowDebtModal(false)
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
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold mr-2">Transactions</h2>
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
        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v ?? 'all')}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={(v) => setFilterPayment(v ?? 'all')}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {PAYMENT_METHODS.map((pm) => (
              <SelectItem key={pm} value={pm} className="text-xs">
                {PAYMENT_METHOD_LABELS[pm] ?? pm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Period</TableHead>
              <TableHead className="w-20">Date</TableHead>
              <TableHead className="w-14">Type</TableHead>
              <TableHead className="flex-1">Description</TableHead>
              <TableHead className="w-20">Category</TableHead>
              <TableHead className="text-right w-24">Amount</TableHead>
              <TableHead className="w-20">Payment</TableHead>
              <TableHead className="w-16 text-center">Install</TableHead>
              <TableHead className="w-32">Details</TableHead>
              <TableHead className="text-right w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <QuickAddRow
              refMonth={displayRefMonth}
              onAdd={handleQuickAdd}
              isFilteredMonth={filterMonth !== 'all'}
              onOpenDebtModal={handleOpenDebtModal}
              defaultCategory={defaultCategory ?? undefined}
              defaultPayment={defaultPayment ?? undefined}
            />

            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
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
                  className={`cursor-pointer ${isFullSettled ? 'opacity-50' : ''}`}
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
                    <div className="max-w-48 truncate">
                      {tx.description}
                      {tx.parentId && (
                        <span className="text-muted-foreground ml-1 text-[10px]">
                          (installment)
                        </span>
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
                            <button
                              key={s.debtorName}
                              type="button"
                              className={`block w-full text-muted-foreground hover:text-foreground text-left ${splitSettled ? 'line-through opacity-50' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSettle(tx.id, tx.isSettled, s.debtorName)
                              }}
                            >
                              {s.debtorName}: {formatCurrency(s.amount)}
                            </button>
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

      <DebtConfigModal
        open={showDebtModal}
        onOpenChange={setShowDebtModal}
        config={tempDebtConfig}
        onConfigChange={handleDebtModalSave}
        totalAmount={debtModalAmount}
      />

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
