import { CheckCircleIcon, TrashIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
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
import { availableMonths, generateInstallments, monthRelation } from '@/domain/calculations'
import { PAYMENT_METHOD_LABELS } from '@/domain/constants'
import type { DebtConfig, PaymentMethod, Transaction, TransactionType } from '@/domain/entities'
import { formatCurrency, parseCurrency } from '@/lib/currency'
import { useFinance } from '@/ui/context'
import DebtConfigModal from './DebtConfigModal'
import QuickAddRow from './QuickAddRow'
import TransactionForm from './TransactionForm'

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

export default function TransactionTable() {
  const { state, dispatch } = useFinance()
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDebtModal, setShowDebtModal] = useState(false)
  const [debtModalCallback, setDebtModalCallback] = useState<((config: DebtConfig) => void) | null>(
    null,
  )
  const [debtModalAmount, setDebtModalAmount] = useState(0)
  const [tempDebtConfig, setTempDebtConfig] = useState<DebtConfig>({ userShare: 0, splits: [] })

  const months = useMemo(() => availableMonths(state.transactions), [state.transactions])

  const filtered = useMemo(() => {
    let txs = state.transactions
    if (filterMonth !== 'all') {
      txs = txs.filter((t) => t.referenceMonth === filterMonth)
    }
    return txs.sort((a, b) => b.date.localeCompare(a.date))
  }, [state.transactions, filterMonth])

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

    if (rowData.paymentMethod === 'CREDIT' && rowData.installmentTotal > 1) {
      const groupId = uuid()
      const txs = generateInstallments(tx, rowData.installmentTotal, groupId)
      dispatch({ type: 'ADD_TRANSACTIONS', payload: txs.map((t) => ({ ...t, id: uuid() })) })
    } else {
      dispatch({ type: 'ADD_TRANSACTIONS', payload: [{ ...tx, id: uuid() }] })
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
    dispatch({ type: 'DELETE_TRANSACTION', payload: id })
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Transactions</h2>
          <Select value={filterMonth} onValueChange={(v) => setFilterMonth(v ?? 'all')}>
            <SelectTrigger className="w-36">
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
        </div>
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
            />

            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  No transactions yet.
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
                        >
                          <CheckCircleIcon />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(tx.id)}>
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
    </div>
  )
}
