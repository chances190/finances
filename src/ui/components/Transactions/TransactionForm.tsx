import { useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { currentYM, localYMD } from '@/domain/calculations'
import { categoryOptionsForMonth, monthOf } from '@/domain/categories'
import {
  EXPENSE_PAYMENT_METHODS,
  INCOME_PAYMENT_METHODS,
  isExpensePaymentMethod,
  isIncomePaymentMethod,
} from '@/domain/constants'
import type { Debt, PaymentMethod, Transaction, TransactionType } from '@/domain/entities'
import { addCurrency, formatCurrency, formatPlainCurrency, parseCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import ImportDialog from '@/ui/components/Common/ImportDialog'
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
  const defaultCategory =
    categoryOptionsForMonth(currentYM(), state.budgets, state.transactions)[0] ?? 'Other'

  const [form, setForm] = useState<EditFormState>({
    type: 'Expense',
    date: '',
    amount: '',
    description: '',
    category: defaultCategory,
    paymentMethod: 'Debit/PIX',
    installmentTotal: 1,
  })

  const categories = useMemo(() => {
    const month = form.date ? monthOf(form.date) : currentYM()
    const options = categoryOptionsForMonth(month, state.budgets, state.transactions)
    return options.includes(form.category) ? options : [form.category, ...options]
  }, [form.date, form.category, state.budgets, state.transactions])

  const [debts, setDebts] = useState<Debt[]>([])
  const [showDebtConfig, setShowDebtConfig] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const debtTotal = debts.reduce((sum, debt) => addCurrency(sum, debt.amount), 0)
  const purchaseAmount = parseCurrency(form.amount)
  const userShare = Math.max(0, addCurrency(purchaseAmount, -debtTotal))
  const debtOverage = Math.max(0, addCurrency(debtTotal, -purchaseAmount))

  useEffect(() => {
    if (editTransaction) {
      setForm({
        type: editTransaction.type,
        date: editTransaction.date,
        amount: formatPlainCurrency(editTransaction.amount),
        description: editTransaction.description,
        category: editTransaction.category,
        paymentMethod: editTransaction.paymentMethod,
        installmentTotal:
          editTransaction.type === 'Expense' ? (editTransaction.installments ?? 1) : 1,
      })
      setDebts(
        editTransaction.type === 'Expense' && editTransaction.debts
          ? [...editTransaction.debts]
          : [],
      )
    } else if (open) {
      setForm({
        type: 'Expense',
        date: localYMD(),
        amount: '',
        description: '',
        category: defaultCategory,
        paymentMethod: 'Debit/PIX',
        installmentTotal: 1,
      })
      setDebts([])
    }
  }, [editTransaction, open, defaultCategory])

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
    if (form.type === 'Expense' && debts.length > 0) {
      const debtTotal = debts.reduce((s, d) => addCurrency(s, d.amount), 0)
      if (debtTotal > amount) {
        toast('Total debts cannot exceed purchase amount', 'error')
        return
      }
    }

    const category = form.type === 'Income' ? 'Income' : form.category
    const importId = editTransaction?.importId ? { importId: editTransaction.importId } : {}

    if (form.type === 'Income') {
      if (!isIncomePaymentMethod(form.paymentMethod)) return
      commit({
        id: editTransaction?.id ?? uuid(),
        type: 'Income',
        date: form.date,
        description: form.description,
        amount,
        category,
        paymentMethod: form.paymentMethod,
        ...importId,
      })
      return
    }

    if (!isExpensePaymentMethod(form.paymentMethod)) return
    commit({
      id: editTransaction?.id ?? uuid(),
      type: 'Expense',
      date: form.date,
      description: form.description,
      amount,
      category,
      paymentMethod: form.paymentMethod,
      ...(form.paymentMethod === 'Credit' && form.installmentTotal > 1
        ? { installments: form.installmentTotal }
        : {}),
      ...(debts.length > 0 ? { debts } : {}),
      ...importId,
    })
  }

  function commit(transaction: Transaction) {
    if (editTransaction) {
      dispatch({ type: 'UPDATE_TRANSACTION', payload: transaction })
    } else {
      dispatch({ type: 'ADD_TRANSACTIONS', payload: [transaction] })
      toast('Transaction added', 'success')
    }
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
                  paymentMethod: type === 'Income' ? 'Salary' : 'Debit/PIX',
                  ...(type === 'Income' ? { installmentTotal: 1 } : {}),
                }))
                setDebts([])
              }}
              options={[
                { value: 'Expense', label: 'Expense' },
                { value: 'Income', label: 'Income' },
              ]}
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                <MoneyInput
                  id="tx-amount"
                  value={form.amount}
                  onValueChange={(amount) => setForm((f) => ({ ...f, amount }))}
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
              <div className={`min-w-0 space-y-1 ${form.type === 'Income' ? 'col-span-2' : ''}`}>
                <Label htmlFor="tx-payment" className="text-xs">
                  Payment Method
                </Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      paymentMethod: (v ??
                        (form.type === 'Income' ? 'Salary' : 'Debit/PIX')) as PaymentMethod,
                    }))
                  }
                >
                  <SelectTrigger id="tx-payment" className="w-full min-w-0">
                    <SelectValue>{form.paymentMethod}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(form.type === 'Income'
                      ? INCOME_PAYMENT_METHODS
                      : EXPENSE_PAYMENT_METHODS
                    ).map((pm) => (
                      <SelectItem key={pm} value={pm}>
                        {pm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.type === 'Expense' && (
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="tx-category" className="text-xs">
                    Category
                  </Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? 'Other' }))}
                  >
                    <SelectTrigger id="tx-category" className="w-full min-w-0">
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
              )}
            </div>

            {form.type === 'Expense' && form.paymentMethod === 'Credit' && (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="tx-installments" className="text-xs">
                    Installments
                  </Label>
                  <p className="text-xs text-muted-foreground">Number of monthly payments</p>
                </div>
                <Input
                  id="tx-installments"
                  type="number"
                  min="1"
                  max="48"
                  value={form.installmentTotal}
                  className="h-10 w-24 text-right"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      installmentTotal: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                />
              </div>
            )}

            {form.type === 'Expense' && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label className="text-xs font-medium">Shared expense</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Split this expense with people who owe you.
                    </p>
                  </div>
                  {debts.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 shrink-0"
                      onClick={() => setShowDebtConfig(true)}
                    >
                      Edit split
                    </Button>
                  )}
                </div>
                {debts.length === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    disabled={!(parseCurrency(form.amount) > 0)}
                    onClick={() => setShowDebtConfig(true)}
                  >
                    Add people
                  </Button>
                ) : (
                  <>
                    <div className="border border-border p-2 text-xs">
                      {debts.map((debt) => (
                        <div
                          key={debt.name}
                          className="flex items-baseline justify-between gap-3 py-0.5"
                        >
                          <span className="min-w-0 break-words">{debt.name}</span>
                          <span className="shrink-0 font-mono">{formatCurrency(debt.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-baseline justify-between gap-3 py-0.5 font-medium">
                        <span>You</span>
                        <span className="shrink-0 font-mono">{formatCurrency(userShare)}</span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1 font-medium">
                        <span>Purchase total</span>
                        <span className="shrink-0 font-mono">{formatCurrency(purchaseAmount)}</span>
                      </div>
                    </div>
                    {debtOverage > 0 && (
                      <p className="text-xs text-destructive">
                        Splits exceed the purchase by {formatCurrency(debtOverage)}.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            {!editTransaction && (
              <Button
                variant="outline"
                size="sm"
                className="mr-auto text-xs"
                onClick={() => setShowCsvImport(true)}
              >
                Import from file
              </Button>
            )}
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
        onRemoveAll={() => setShowRemoveConfirm(true)}
        onDebtsChange={(d) => {
          setDebts(d)
          setShowDebtConfig(false)
        }}
        totalAmount={amount}
      />

      <ImportDialog
        open={showCsvImport}
        onOpenChange={setShowCsvImport}
        mode="transactions"
        onImported={() => onOpenChange(false)}
      />

      <ConfirmDialog
        open={showRemoveConfirm}
        onOpenChange={(o) => {
          if (!o) setShowRemoveConfirm(false)
        }}
        title="Remove shared expense?"
        message="This will remove all people and their amounts from this expense."
        confirmLabel="Remove"
        onConfirm={() => {
          setDebts([])
          setShowDebtConfig(false)
          setShowRemoveConfirm(false)
        }}
      />
    </>
  )
}
