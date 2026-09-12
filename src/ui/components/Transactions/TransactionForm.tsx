import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { localYMD } from '@/domain/calculations'
import { getAllCategories } from '@/domain/categories'
import { INCOME_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/domain/constants'
import type { Debt, PaymentMethod, Transaction, TransactionType } from '@/domain/entities'
import { parseCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import DebtConfigModal from './DebtConfigModal'

interface EditFormState {
  type: TransactionType
  date: string
  amount: string
  description: string
  category: string
  paymentMethod: PaymentMethod
  installmentTotal: number
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
  const { dispatch, state } = useFinance()
  const { toast } = useToast()

  const categories = useMemo(
    () => getAllCategories(state.budgets, state.transactions),
    [state.budgets, state.transactions],
  )

  const isEditingInstallment = useMemo(() => {
    if (!editTransaction) return false
    return editTransaction.installments != null && editTransaction.installments > 1
  }, [editTransaction])

  const [form, setForm] = useState<EditFormState>({
    type: 'EXPENSE',
    date: '',
    amount: '',
    description: '',
    category: 'Other',
    paymentMethod: 'DEBIT',
    installmentTotal: 1,
  })

  const [debts, setDebts] = useState<Debt[]>([])
  const [showDebtConfig, setShowDebtConfig] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  useEffect(() => {
    if (editTransaction) {
      setForm({
        type: editTransaction.type,
        date: editTransaction.date,
        amount: String(editTransaction.amount),
        description: editTransaction.description,
        category: editTransaction.category,
        paymentMethod: editTransaction.paymentMethod,
        installmentTotal: editTransaction.installments ?? 1,
      })
      setDebts(editTransaction.debts ? [...editTransaction.debts] : [])
    } else if (open) {
      setForm({
        type: 'EXPENSE',
        date: localYMD(),
        amount: '',
        description: '',
        category: 'Other',
        paymentMethod: 'DEBIT',
        installmentTotal: 1,
      })
      setDebts([])
    }
  }, [editTransaction, open])

  function handleSave() {
    const amount = parseCurrency(form.amount)
    if (amount <= 0) {
      toast('Amount must be greater than 0', 'error')
      return
    }
    if (!form.description.trim()) {
      toast('Description is required', 'error')
      return
    }
    if (form.type === 'EXPENSE' && form.paymentMethod === 'CREDIT' && debts.length > 0) {
      const debtTotal = debts.reduce((s, d) => s + d.amount, 0)
      if (debtTotal > amount) {
        toast('Total debts cannot exceed purchase amount', 'error')
        return
      }
    }

    if (!editTransaction) {
      const created: Transaction = {
        id: uuid(),
        type: form.type,
        date: form.date,
        description: form.description,
        amount,
        category: form.category,
        paymentMethod: form.paymentMethod,
        ...(form.installmentTotal > 1 && form.paymentMethod === 'CREDIT'
          ? { installments: form.installmentTotal }
          : {}),
        ...(debts.length > 0 ? { debts } : {}),
      }

      dispatch({ type: 'ADD_TRANSACTIONS', payload: [created] })
      toast('Transaction added', 'success')
      onOpenChange(false)
      return
    }

    const updated: Transaction = {
      ...editTransaction,
      type: form.type,
      date: form.date,
      amount,
      description: form.description,
      category: form.category,
      paymentMethod: form.paymentMethod,
      ...(isEditingInstallment
        ? {}
        : { installments: form.installmentTotal > 1 ? form.installmentTotal : undefined }),
      ...(debts.length > 0 ? { debts } : {}),
    }

    dispatch({ type: 'UPDATE_TRANSACTION', payload: updated })
    onOpenChange(false)
  }

  const amount = parseCurrency(form.amount)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <SegmentedControl
              aria-label="Transaction type"
              className="w-full"
              value={form.type}
              onValueChange={(v) => {
                const type = v as TransactionType
                setForm((f) => ({
                  ...f,
                  type,
                  paymentMethod: type === 'INCOME' ? 'SALARY' : 'DEBIT',
                  ...(type === 'INCOME' ? { installmentTotal: 1 } : {}),
                }))
                setDebts([])
              }}
              options={[
                { value: 'EXPENSE', label: 'Expense' },
                { value: 'INCOME', label: 'Income' },
              ]}
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="tx-date" className="text-xs">
                  Date
                </Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-amount" className="text-xs">
                  Amount (R$)
                </Label>
                <Input
                  id="tx-amount"
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tx-description" className="text-xs">
                Description
              </Label>
              <Input
                id="tx-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="tx-category" className="text-xs">
                  Category
                </Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? 'Other' }))}
                >
                  <SelectTrigger id="tx-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-payment" className="text-xs">
                  Payment Method
                </Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      paymentMethod: (v ??
                        (form.type === 'INCOME' ? 'SALARY' : 'DEBIT')) as PaymentMethod,
                    }))
                  }
                >
                  <SelectTrigger id="tx-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(form.type === 'INCOME' ? INCOME_PAYMENT_METHODS : PAYMENT_METHODS).map(
                      (pm) => (
                        <SelectItem key={pm} value={pm}>
                          {PAYMENT_METHOD_LABELS[pm] ?? pm}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.type === 'EXPENSE' &&
              form.paymentMethod === 'CREDIT' &&
              !isEditingInstallment && (
                <div className="space-y-1">
                  <Label htmlFor="tx-installments" className="text-xs">
                    Installments
                  </Label>
                  <Input
                    id="tx-installments"
                    type="number"
                    min="1"
                    max="48"
                    value={form.installmentTotal}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        installmentTotal: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                  />
                </div>
              )}

            {form.type === 'EXPENSE' && form.paymentMethod !== 'MEAL_VOUCHER' && (
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant={debts.length > 0 ? 'default' : 'outline'}
                    disabled={!(parseCurrency(form.amount) > 0)}
                    onClick={() => setShowDebtConfig(true)}
                  >
                    {debts.length > 0
                      ? `Debt (${debts.length} debtor${debts.length !== 1 ? 's' : ''})`
                      : 'Debt'}
                  </Button>
                  {debts.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-destructive hover:text-destructive/80 underline"
                      onClick={() => setShowRemoveConfirm(true)}
                    >
                      Remove debt
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editTransaction ? 'Update' : 'Add'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <DebtConfigModal
        open={showDebtConfig}
        onOpenChange={setShowDebtConfig}
        debts={debts}
        onDebtsChange={(d) => {
          setDebts(d)
          setShowDebtConfig(false)
        }}
        totalAmount={amount}
      />

      <ConfirmDialog
        open={showRemoveConfirm}
        onOpenChange={(o) => {
          if (!o) setShowRemoveConfirm(false)
        }}
        title="Remove debt"
        message="This will remove all debt configuration from this transaction."
        confirmLabel="Remove"
        onConfirm={() => {
          setDebts([])
          setShowRemoveConfirm(false)
        }}
      />
    </>
  )
}
