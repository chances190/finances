import { PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useState } from 'react'
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
import { addMonths } from '@/domain/calculations'
import type { PaymentMethod, Transaction, TransactionType } from '@/domain/entities'
import { useFinance } from '@/ui/context'

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
  debtorName: string
  installmentTotal: string
  isInstallment: boolean
}

const emptyRow = (refMonth: string): FormRow => ({
  id: uuid(),
  date: new Date().toISOString().slice(0, 10),
  type: 'EXPENSE',
  amount: '',
  category: 'Other',
  paymentMethod: 'DEBIT',
  description: '',
  referenceMonth: refMonth,
  isDebt: false,
  debtorName: '',
  installmentTotal: '1',
  isInstallment: false,
})

const CATEGORIES = [
  'Food',
  'Transport',
  'Rent',
  'Leisure',
  'Utilities',
  'Health',
  'Education',
  'Shopping',
  'Salary',
  'Other',
]
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
      result.push({
        type: row.type,
        date: row.date,
        referenceMonth: row.referenceMonth,
        description: row.description,
        amount,
        category: row.category,
        paymentMethod: row.paymentMethod,
        isDebt: row.isDebt,
        debtorName: row.isDebt ? row.debtorName : undefined,
        isSettled: false,
      })
    }
  }
  return result
}

export default function TransactionForm({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { dispatch } = useFinance()
  const defaultRefMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [rows, setRows] = useState<FormRow[]>([emptyRow(defaultRefMonth)])

  function updateRow(id: string, patch: Partial<FormRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(defaultRefMonth)])
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function handleSave() {
    const txs = toTransactions(rows)
    if (txs.length === 0) return
    dispatch({ type: 'ADD_TRANSACTIONS', payload: txs.map((t) => ({ ...t, id: uuid() })) })
    setRows([emptyRow(defaultRefMonth)])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Transactions</DialogTitle>
          <DialogDescription>
            Add one or multiple transactions. For credit installments, the system will auto-generate
            monthly records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {rows.map((row, index) => (
            <div key={row.id} className="border border-border p-3 rounded-none space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Transaction {index + 1}
                </span>
                {rows.length > 1 && (
                  <Button variant="ghost" size="icon-xs" onClick={() => removeRow(row.id)}>
                    <TrashIcon />
                  </Button>
                )}
              </div>

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
                      {CATEGORIES.map((c) => (
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Installments</Label>
                    <Select
                      value={row.isInstallment ? 'yes' : 'no'}
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

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`debt-${row.id}`}
                    checked={row.isDebt}
                    onCheckedChange={(v) => updateRow(row.id, { isDebt: v === true })}
                  />
                  <Label htmlFor={`debt-${row.id}`} className="text-xs">
                    Is debt (someone owes me)
                  </Label>
                </div>
                {row.isDebt && (
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Debtor name</Label>
                    <Input
                      value={row.debtorName}
                      onChange={(e) => updateRow(row.id, { debtorName: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <PlusIcon /> Add Row
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
