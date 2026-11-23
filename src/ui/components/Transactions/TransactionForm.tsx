import { lazy, Suspense, startTransition, useEffect, useMemo, useState } from 'react'
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
import { categoryOptionsForMonth, monthOf } from '@/domain/categories'
import {
  ACCOUNT_LABELS,
  buildIncome,
  buildPurchase,
  CASH_ACCOUNTS,
  categoryOf,
  currentYM,
  FUNDING_ACCOUNTS,
  type FundingAccount,
  fundingAccountOf,
  incomeAmount,
  localYMD,
  type Movement,
  movementTotal,
  type PurchaseShare,
} from '@/domain/ledger'
import { addCurrency, formatPlainCurrency, parseCurrency } from '@/lib/currency'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import SplitConfigModal from './SplitConfigModal'

const ImportDialog = lazy(() => import('@/ui/components/Common/ImportDialog'))

interface FormState {
  type: 'Expense' | 'Income'
  date: string
  amount: string
  description: string
  category: string
  account: FundingAccount
  counterparty: string
  installmentTotal: number
}

interface TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editMovement?: Movement | null
}

function initialForm(movement: Movement | null | undefined, defaultCategory: string): FormState {
  if (movement?.kind === 'income') {
    return {
      type: 'Income',
      date: movement.date,
      amount: formatPlainCurrency(incomeAmount(movement)),
      description: movement.description,
      category: categoryOf(movement) ?? 'Income',
      account: (fundingAccountOf(movement) as FundingAccount) ?? 'checking',
      counterparty: '',
      installmentTotal: 1,
    }
  }
  if (movement?.kind === 'purchase') {
    return {
      type: 'Expense',
      date: movement.date,
      amount: formatPlainCurrency(movementTotal(movement)),
      description: movement.description,
      category: categoryOf(movement) ?? defaultCategory,
      account: fundingAccountOf(movement) ?? 'checking',
      counterparty:
        movement.postings.find((posting) => posting.account === 'payable')?.counterparty ?? '',
      installmentTotal: 1,
    }
  }
  return {
    type: 'Expense',
    date: localYMD(),
    amount: '',
    description: '',
    category: defaultCategory,
    account: 'checking',
    counterparty: '',
    installmentTotal: 1,
  }
}

function sharesOf(movement: Movement | null | undefined): PurchaseShare[] {
  if (movement?.kind !== 'purchase') return []
  return movement.postings
    .filter((posting) => posting.account === 'receivable' && posting.counterparty)
    .map((posting) => ({ counterparty: posting.counterparty as string, amount: posting.amount }))
}

export default function TransactionForm({
  open,
  onOpenChange,
  editMovement,
}: TransactionFormProps) {
  const { dispatch, state } = useFinance()
  const { toast } = useToast()
  const defaultCategory =
    categoryOptionsForMonth(currentYM(), state.budgets, state.movements)[0] ?? 'Other'

  const [form, setForm] = useState<FormState>(() => initialForm(editMovement, defaultCategory))
  const [shares, setShares] = useState<PurchaseShare[]>(() => sharesOf(editMovement))
  const [showSplitConfig, setShowSplitConfig] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)

  const categories = useMemo(() => {
    const month = form.date ? monthOf(form.date) : currentYM()
    const options = categoryOptionsForMonth(month, state.budgets, state.movements)
    return options.includes(form.category) ? options : [form.category, ...options]
  }, [form.date, form.category, state.budgets, state.movements])

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setForm(initialForm(editMovement, defaultCategory))
    setShares(sharesOf(editMovement))
  }, [editMovement, open, defaultCategory])

  const amount = parseCurrency(form.amount)
  const shareTotal = shares.reduce((sum, share) => addCurrency(sum, share.amount), 0)
  const userShare = Math.max(0, addCurrency(amount, -shareTotal))
  const overBy = Math.max(0, addCurrency(shareTotal, -amount))

  function handleSave() {
    if (amount <= 0) {
      toast('Amount must be greater than 0', 'error')
      return
    }
    if (!form.description.trim()) {
      toast('Description is required', 'error')
      return
    }
    if (form.type === 'Expense' && form.account === 'payable' && !form.counterparty.trim()) {
      toast('Name who paid for this purchase', 'error')
      return
    }
    if (form.type === 'Expense' && overBy > 0) {
      toast('Shares cannot exceed the purchase amount', 'error')
      return
    }

    if (form.type === 'Income') {
      const result = buildIncome({
        id: editMovement?.id ?? crypto.randomUUID(),
        date: form.date,
        description: form.description,
        amount,
        account:
          form.account === 'voucher' ? 'voucher' : form.account === 'cash' ? 'cash' : 'checking',
        category: 'Income',
      })
      if (!result.ok) {
        toast(result.reason, 'error')
        return
      }
      commit([result.value])
      return
    }

    const result = buildPurchase({
      id: editMovement?.id ?? crypto.randomUUID(),
      date: form.date,
      description: form.description,
      amount,
      category: form.category,
      account: form.account,
      ...(form.account === 'payable' ? { counterparty: form.counterparty.trim() } : {}),
      shares: shares.filter((share) => share.counterparty.trim() && share.amount > 0),
      installments: editMovement ? 1 : form.installmentTotal,
    })
    if (!result.ok) {
      toast(result.reason, 'error')
      return
    }
    commit(result.value)
  }

  function commit(movements: Movement[]) {
    const editing = Boolean(editMovement)
    startTransition(() => {
      if (editing) {
        for (const movement of movements) {
          dispatch({ type: 'UPDATE_MOVEMENT', payload: movement })
        }
      } else {
        dispatch({ type: 'ADD_MOVEMENTS', payload: movements })
      }
    })
    toast(editing ? 'Transaction updated' : 'Transaction added', 'success')
    onOpenChange(false)
  }

  const accounts = form.type === 'Income' ? CASH_ACCOUNTS : FUNDING_ACCOUNTS

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editMovement ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <SegmentedControl
              aria-label="Transaction type"
              className="w-full"
              value={form.type}
              onValueChange={(value) => {
                const type = value as 'Expense' | 'Income'
                setForm((current) => ({
                  ...current,
                  type,
                  account: type === 'Income' ? 'checking' : 'checking',
                  installmentTotal: 1,
                }))
                setShares([])
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
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-amount" className="text-xs">
                  Amount (R$)
                </Label>
                <MoneyInput
                  id="tx-amount"
                  value={form.amount}
                  onValueChange={(value) => setForm((current) => ({ ...current, amount: value }))}
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
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>

            <div
              className={`grid grid-cols-2 gap-2 ${form.type === 'Income' ? 'sm:grid-cols-1' : ''}`}
            >
              <div className="min-w-0 space-y-1">
                <Label htmlFor="tx-account" className="text-xs">
                  {form.type === 'Income' ? 'Received in' : 'Paid with'}
                </Label>
                <Select
                  modal={false}
                  value={form.account}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      account: (value ?? 'checking') as FundingAccount,
                      installmentTotal: value === 'card' ? current.installmentTotal : 1,
                    }))
                  }
                >
                  <SelectTrigger id="tx-account" className="w-full min-w-0">
                    <SelectValue>{ACCOUNT_LABELS[form.account]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {accounts.map((account) => (
                      <SelectItem key={account} value={account}>
                        {account === 'payable' ? 'Someone else' : ACCOUNT_LABELS[account]}
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
                    modal={false}
                    value={form.category}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, category: value ?? 'Other' }))
                    }
                  >
                    <SelectTrigger id="tx-category" className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {form.type === 'Expense' && form.account === 'payable' && (
              <div className="space-y-1">
                <Label htmlFor="tx-payer" className="text-xs">
                  Who paid?
                </Label>
                <Input
                  id="tx-payer"
                  placeholder="Name"
                  value={form.counterparty}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, counterparty: event.target.value }))
                  }
                />
              </div>
            )}

            {form.type === 'Expense' && !editMovement && form.account === 'card' && (
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
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      installmentTotal: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
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
                  {shares.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 shrink-0"
                      onClick={() => setShowSplitConfig(true)}
                    >
                      Edit split
                    </Button>
                  )}
                </div>
                {shares.length === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10"
                    disabled={!(amount > 0)}
                    onClick={() => setShowSplitConfig(true)}
                  >
                    Add people
                  </Button>
                ) : (
                  <div className="border border-border p-2 text-xs">
                    {shares.map((share) => (
                      <div
                        key={share.counterparty}
                        className="flex items-baseline justify-between gap-3 py-0.5"
                      >
                        <span className="min-w-0 break-words">{share.counterparty}</span>
                        <span className="shrink-0 font-mono">
                          {formatPlainCurrency(share.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-3 py-0.5 font-medium">
                      <span>You</span>
                      <span className="shrink-0 font-mono">{formatPlainCurrency(userShare)}</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1 font-medium">
                      <span>Purchase total</span>
                      <span className="shrink-0 font-mono">{formatPlainCurrency(amount)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            {!editMovement && (
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
            <Button onClick={handleSave}>{editMovement ? 'Update' : 'Add'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SplitConfigModal
        open={showSplitConfig}
        onOpenChange={setShowSplitConfig}
        shares={shares}
        onSharesChange={setShares}
        onRemoveAll={() => setShares([])}
        totalAmount={amount}
      />

      {showCsvImport && (
        <Suspense fallback={null}>
          <ImportDialog open={showCsvImport} onOpenChange={setShowCsvImport} mode="transactions" />
        </Suspense>
      )}
    </>
  )
}
