import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEFAULT_CATEGORIES, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/domain/constants'

import type { DebtConfig, PaymentMethod, Transaction } from '@/domain/entities'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import DebtConfigModal from './DebtConfigModal'

interface EditFormState {
  date: string
  amount: string
  description: string
  category: string
  paymentMethod: PaymentMethod
  referenceMonth: string
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
  const { dispatch } = useFinance()
  const { toast } = useToast()

  const [form, setForm] = useState<EditFormState>({
    date: '',
    amount: '',
    description: '',
    category: 'Other',
    paymentMethod: 'DEBIT',
    referenceMonth: '',
    installmentTotal: 1,
  })

  const [isDebt, setIsDebt] = useState(false)
  const [debtConfig, setDebtConfig] = useState<DebtConfig>({ userShare: 0, splits: [] })
  const [showDebtConfig, setShowDebtConfig] = useState(false)

  useEffect(() => {
    if (editTransaction) {
      setForm({
        date: editTransaction.date,
        amount: String(editTransaction.amount),
        description: editTransaction.description,
        category: editTransaction.category,
        paymentMethod: editTransaction.paymentMethod,
        referenceMonth: editTransaction.referenceMonth,
        installmentTotal: editTransaction.installment?.total ?? 1,
      })

      setIsDebt(editTransaction.isDebt)
      if (editTransaction.isDebt && editTransaction.debtSplits) {
        setDebtConfig({
          userShare: editTransaction.debtUserShare ?? 0,
          splits: editTransaction.debtSplits.map((s) => ({
            id: uuid(),
            name: s.debtorName,
            amount: s.amount,
          })),
        })
      } else {
        setDebtConfig({ userShare: 0, splits: [] })
      }
    }
  }, [editTransaction])

  function handleSave() {
    const amount = parseFloat(form.amount) || 0
    if (amount <= 0) {
      toast('Amount must be greater than 0', 'error')
      return
    }
    if (!form.description.trim()) {
      toast('Description is required', 'error')
      return
    }

    if (!editTransaction) return

    const updated: Transaction = {
      ...editTransaction,
      date: form.date,
      amount,
      description: form.description,
      category: form.category,
      paymentMethod: form.paymentMethod,
      referenceMonth: form.referenceMonth,
      installment:
        form.installmentTotal > 1
          ? { current: editTransaction.installment?.current ?? 1, total: form.installmentTotal }
          : undefined,
      isDebt,
      debtUserShare: isDebt ? debtConfig.userShare : undefined,
      debtSplits:
        isDebt && debtConfig.splits.length > 0
          ? debtConfig.splits.map((s) => ({ debtorName: s.name, amount: s.amount }))
          : undefined,
    }

    dispatch({ type: 'UPDATE_TRANSACTION', payload: updated })
    onOpenChange(false)
  }

  const amount = parseFloat(form.amount) || 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Date, Amount, Description - top priority */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Category, Payment, RefMonth */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? 'Other' }))}
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
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, paymentMethod: (v ?? 'DEBIT') as PaymentMethod }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm} value={pm}>
                        {PAYMENT_METHOD_LABELS[pm] ?? pm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reference Month</Label>
              <Input
                type="month"
                value={form.referenceMonth}
                onChange={(e) => setForm((f) => ({ ...f, referenceMonth: e.target.value }))}
              />
            </div>

            {/* Installments (if CREDIT) */}
            {form.paymentMethod === 'CREDIT' && (
              <div className="space-y-1">
                <Label className="text-xs">Installments</Label>
                <Input
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

            {/* Debt toggle + configuration */}
            {form.paymentMethod !== 'MEAL_VOUCHER' && (
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setIsDebt((v) => {
                        if (v) {
                          setDebtConfig({ userShare: 0, splits: [] })
                        }
                        return !v
                      })
                    }
                    className={`text-xs px-2 py-1 border ${
                      isDebt
                        ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    Is Debt
                  </button>
                  {isDebt &&
                    (debtConfig.splits.length === 0 ? (
                      <Button variant="outline" size="xs" onClick={() => setShowDebtConfig(true)}>
                        Add splits
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="xs" onClick={() => setShowDebtConfig(true)}>
                          {debtConfig.splits.length} debtor
                          {debtConfig.splits.length !== 1 ? 's' : ''}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          (My share: R$ {debtConfig.userShare.toFixed(2)})
                        </span>
                      </>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Update</Button>
          </div>
        </DialogContent>
      </Dialog>

      <DebtConfigModal
        open={showDebtConfig}
        onOpenChange={setShowDebtConfig}
        config={debtConfig}
        onConfigChange={setDebtConfig}
        totalAmount={amount}
      />
    </>
  )
}
