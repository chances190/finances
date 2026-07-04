import { FileArrowDownIcon, GearIcon, PlusIcon, TrashIcon, UserIcon, UsersIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEFAULT_CATEGORIES } from '@/domain/constants'
import { addMonths } from '@/domain/calculations'
import type { PaymentMethod, Transaction, TransactionType } from '@/domain/entities'
import { useFinance } from '@/ui/context'
import CSVImportDialog from '../Common/CSVImportDialog'
interface DebtSplitEntry {
  id: string
  debtorName: string
  amount: string
}

interface FormRow {
  id: string
  date: string
  type: TransactionType
  amount: string
  category: string
  paymentMethod: PaymentMethod
  description: string
  referenceMonth: string
  isDebt: boolean
  debtSplits: DebtSplitEntry[]
  debtMode: 'single' | 'equal' | 'custom' | null
  installmentTotal: string
  isInstallment: boolean
}

const emptyDebtSplit = (): DebtSplitEntry => ({ id: uuid(), debtorName: '', amount: '' })

const emptyRow = (refMonth: string, defaults?: Partial<FormRow>): FormRow => ({
  id: uuid(),
  date: new Date().toISOString().slice(0, 10),
  type: 'EXPENSE',
  amount: '',
  category: 'Other',
  paymentMethod: 'DEBIT',
  description: '',
  referenceMonth: refMonth,
  isDebt: false,
  debtSplits: [],
  debtMode: null,
  installmentTotal: '1',
  isInstallment: false,
  ...defaults,
})

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'DEBIT', 'CREDIT', 'PIX', 'MEAL_VOUCHER']

function generateInstallments(row: FormRow): Omit<Transaction, 'id'>[] {
  const total = parseInt(row.installmentTotal, 10) || 1
  const perInstallment = Math.round(((parseFloat(row.amount) || 0) / total) * 100) / 100
  const groupId = uuid()
  const result: Omit<Transaction, 'id'>[] = []

  for (let i = 1; i <= total; i++) {
    result.push({
      type: 'EXPENSE',
      date: row.date,
      referenceMonth: i === 1 ? row.referenceMonth : addMonths(row.referenceMonth, i - 1),
      description: `${row.description} - ${i}/${total}`,
      amount:
        i === total ? (parseFloat(row.amount) || 0) - perInstallment * (total - 1) : perInstallment,
      category: row.category,
      paymentMethod: 'CREDIT',
      installment: { current: i, total },
      groupId,
      parentId: groupId,
      isDebt: false,
      isSettled: false,
    })
  }

  return result
}

function toTransactions(rows: FormRow[]): Omit<Transaction, 'id'>[] {
  const result: Omit<Transaction, 'id'>[] = []
  for (const row of rows) {
    const amount = parseFloat(row.amount) || 0
    if (amount <= 0) continue

    if (
      row.isInstallment &&
      row.paymentMethod === 'CREDIT' &&
      parseInt(row.installmentTotal, 10) > 1
    ) {
      result.push(...generateInstallments(row))
    } else {
      const debtSplits = row.debtSplits
        .filter((d) => d.debtorName.trim() && parseFloat(d.amount) > 0)
        .map((d) => ({ debtorName: d.debtorName, amount: parseFloat(d.amount) }))

      result.push({
        type: row.type,
        date: row.date,
        referenceMonth: row.referenceMonth,
        description: row.description,
        amount,
        category: row.category,
        paymentMethod: row.paymentMethod,
        isDebt: row.isDebt,
        debtorName: debtSplits.length === 1 ? debtSplits[0].debtorName : undefined,
        debtSplits: debtSplits.length > 0 ? debtSplits : undefined,
        isSettled: false,
      })
    }
  }
  return result
}

function toRow(tx: Transaction, _refMonth: string): FormRow {
  const hasLegacyDebtor = tx.isDebt && tx.debtorName && !tx.debtSplits?.length
  const splits = hasLegacyDebtor
    ? [{ id: uuid(), debtorName: tx.debtorName!, amount: String(tx.amount) }]
    : tx.debtSplits?.map((d) => ({
        id: uuid(),
        debtorName: d.debtorName,
        amount: String(d.amount),
      })) ?? []

  return {
    id: tx.id,
    date: tx.date,
    type: tx.type,
    amount: String(tx.amount),
    category: tx.category,
    paymentMethod: tx.paymentMethod,
    description: tx.description,
    referenceMonth: tx.referenceMonth,
    isDebt: tx.isDebt,
    debtSplits: splits,
    debtMode: splits.length === 1 ? 'single' : tx.debtSplits?.length ? 'custom' : null,
    installmentTotal: String(tx.installment?.total ?? 1),
    isInstallment: !!tx.installment && tx.installment.total > 1,
  }
}

interface TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTransaction?: Transaction | null
}

export default function TransactionForm({
  open,
  onOpenChange,
  editTransaction,
}: TransactionFormProps) {
  const { dispatch } = useFinance()
  const [showImport, setShowImport] = useState(false)
  const defaultRefMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const isEdit = !!editTransaction

  const [rows, setRows] = useState<FormRow[]>(
    editTransaction ? [toRow(editTransaction, defaultRefMonth)] : [emptyRow(defaultRefMonth)],
  )

  useEffect(() => {
    if (editTransaction) {
      setRows([toRow(editTransaction, defaultRefMonth)])
    } else {
      setRows([emptyRow(defaultRefMonth)])
    }
  }, [editTransaction, defaultRefMonth])

  function updateRow(id: string, patch: Partial<FormRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(defaultRefMonth)])
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function applyDebtPreset(rowId: string, preset: 'single' | 'equal' | 'custom', newDebtorName?: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        const amount = parseFloat(row.amount) || 0
        if (amount <= 0) return row

        if (preset === 'single') {
          const name = newDebtorName || ''
          return {
            ...row,
            debtMode: 'single',
            debtSplits: [{ id: uuid(), debtorName: name, amount: String(amount) }],
          }
        }

        if (preset === 'equal') {
          const debtors = newDebtorName
            ? [...row.debtSplits, { id: uuid(), debtorName: newDebtorName, amount: '0' }]
            : row.debtSplits
          const count = debtors.length || 1
          const perPerson = Math.round((amount / count) * 100) / 100
          const remainder = Math.round((amount - perPerson * count) * 100) / 100
          const splits = debtors.map((s, i) => ({
            ...s,
            amount: String(i === debtors.length - 1 ? perPerson + remainder : perPerson),
          }))
          return { ...row, debtMode: 'equal', debtSplits: splits }
        }

        if (preset === 'custom') {
          return {
            ...row,
            debtMode: 'custom',
            debtSplits: [...row.debtSplits, emptyDebtSplit()],
          }
        }

        return row
      })
    )
  }

  function handleSave() {
    if (isEdit && editTransaction) {
      const row = rows[0]
      if (!row) return
      const amount = parseFloat(row.amount) || 0
      if (amount <= 0) return
      const debtSplits = row.debtSplits
        .filter((d) => d.debtorName.trim() && parseFloat(d.amount) > 0)
        .map((d) => ({ debtorName: d.debtorName, amount: parseFloat(d.amount) }))
      dispatch({
        type: 'UPDATE_TRANSACTION',
        payload: {
          ...editTransaction,
          date: row.date,
          referenceMonth: row.referenceMonth,
          description: row.description,
          amount,
          category: row.category,
          paymentMethod: row.paymentMethod,
          isDebt: row.isDebt,
          debtorName: debtSplits.length === 1 ? debtSplits[0].debtorName : undefined,
          debtSplits: debtSplits.length > 0 ? debtSplits : undefined,
        },
      })
    } else {
      const txs = toTransactions(rows)
      if (txs.length === 0) return
      dispatch({ type: 'ADD_TRANSACTIONS', payload: txs.map((t) => ({ ...t, id: uuid() })) })
    }
    setRows([emptyRow(defaultRefMonth)])
    onOpenChange(false)
  }

  const debtSplit = rows[0]?.debtSplits ?? []
  const rowAmount = parseFloat(rows[0]?.amount || '0') || 0
  const totalSplit = debtSplit.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const splitMatch = Math.abs(totalSplit - rowAmount) < 0.01

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Transaction' : 'Add Transactions'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the transaction details.'
              : 'Add one or multiple transactions. For credit installments, the system will auto-generate monthly records.'}
            {!isEdit && (
              <>
                {' '}
                <button type="button" className="underline cursor-pointer" onClick={() => setShowImport(true)}>
                  <FileArrowDownIcon className="inline size-3" /> Import from CSV/JSON
                </button>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {rows.map((row, index) => (
            <div key={row.id} className="border border-border p-3 space-y-2">
              {!isEdit && rows.length > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Transaction {index + 1}
                  </span>
                  <Button variant="ghost" size="icon-xs" onClick={() => removeRow(row.id)}>
                    <TrashIcon />
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(row.id, { date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={row.type}
                    onValueChange={(v) =>
                      updateRow(row.id, { type: (v ?? 'EXPENSE') as TransactionType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOME">Income</SelectItem>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={row.category}
                    onValueChange={(v) => updateRow(row.id, { category: v ?? 'Other' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Payment Method</Label>
                  <Select
                    value={row.paymentMethod}
                    onValueChange={(v) =>
                      updateRow(row.id, { paymentMethod: (v ?? 'DEBIT') as PaymentMethod })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((pm) => (
                        <SelectItem key={pm} value={pm}>
                          {pm}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reference Month</Label>
                  <Input
                    type="month"
                    value={row.referenceMonth}
                    onChange={(e) => updateRow(row.id, { referenceMonth: e.target.value })}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={row.description}
                    onChange={(e) => updateRow(row.id, { description: e.target.value })}
                  />
                </div>
              </div>

              {row.paymentMethod === 'CREDIT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Installments</Label>
                    <Select
                      value={row.isInstallment ? 'yes' : 'no'}
                      disabled={row.isDebt}
                      onValueChange={(v) => updateRow(row.id, { isInstallment: v === 'yes' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">Single payment</SelectItem>
                        <SelectItem value="yes">Installments</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {row.isInstallment && (
                    <div className="space-y-1">
                      <Label className="text-xs">Total installments</Label>
                      <Input
                        type="number"
                        min="2"
                        max="48"
                        value={row.installmentTotal}
                        onChange={(e) => updateRow(row.id, { installmentTotal: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start gap-4 pt-1">
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id={`debt-${row.id}`}
                    checked={row.isDebt}
                    disabled={row.isInstallment}
                    onCheckedChange={(v) => updateRow(row.id, { isDebt: v === true })}
                  />
                  <Label htmlFor={`debt-${row.id}`} className="text-xs">
                    Is debt (someone owes me)
                  </Label>
                </div>

                {row.isDebt && (
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Label className="text-xs">Splits:</Label>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          const name = prompt('Debtor name:')
                          if (name) applyDebtPreset(row.id, 'single', name)
                        }}
                      >
                        <UserIcon /> 100% one person
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          const name = prompt('Debtor name:')
                          if (name) applyDebtPreset(row.id, 'equal', name)
                        }}
                      >
                        <UsersIcon /> Equal per person
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => applyDebtPreset(row.id, 'custom')}
                      >
                        <GearIcon /> Custom
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Total: R$ {rowAmount.toFixed(2)}</span>
                      <span>Split: R$ {totalSplit.toFixed(2)}</span>
                      {!splitMatch && rowAmount > 0 && (
                        <span className="text-destructive">Does not match!</span>
                      )}
                    </div>

                    {row.debtSplits.map((split) => {
                      const amountEditable = row.debtMode === 'custom'
                      return (
                        <div key={split.id} className="flex gap-2 items-center">
                          <Input
                            placeholder="Name"
                            value={split.debtorName}
                            onChange={(e) =>
                              updateRow(row.id, {
                                debtSplits: row.debtSplits.map((s) =>
                                  s.id === split.id ? { ...s, debtorName: e.target.value } : s,
                                ),
                              })
                            }
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Amount"
                            value={split.amount}
                            disabled={!amountEditable}
                            onChange={(e) =>
                              updateRow(row.id, {
                                debtSplits: row.debtSplits.map((s) =>
                                  s.id === split.id ? { ...s, amount: e.target.value } : s,
                                ),
                              })
                            }
                            className="w-28"
                          />
                          <Button
                            variant="ghost"
                            size="icon-xs"
                          onClick={() =>
                            updateRow(row.id, {
                              debtSplits: row.debtSplits.filter((s) => s.id !== split.id),
                            })
                          }
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          {!isEdit && (
            <Button variant="outline" size="sm" onClick={addRow}>
              <PlusIcon /> Add Row
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{isEdit ? 'Update' : 'Save'}</Button>
          </div>
        </div>
      </DialogContent>
      <CSVImportDialog open={showImport} onOpenChange={setShowImport} />
    </Dialog>
  )
}
