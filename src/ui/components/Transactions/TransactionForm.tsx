import { TrashIcon } from '@phosphor-icons/react'
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
  accountForPaymentMethod,
  buildIncome,
  buildPurchase,
  categoryOf,
  currentYM,
  EXPENSE_PAYMENT_METHODS,
  type FundingAccount,
  fundingAccountOf,
  INCOME_PAYMENT_METHODS,
  type IncomePaymentMethod,
  incomeAmount,
  localYMD,
  type Movement,
  movementTotal,
  type PaymentMethod,
  type PurchaseShare,
  paymentMethodOf,
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
  method: PaymentMethod
  counterparty: string
  installmentTotal: string
}

interface TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editMovement?: Movement | null
  onDelete?: (id: string) => void
}

function purchaseGroup(movement: Movement | null | undefined, movements: Movement[]): Movement[] {
  if (movement?.kind !== 'purchase') return movement ? [movement] : []
  const linkedRoot = movement.links?.find((id) =>
    movements.some((candidate) => candidate.id === id && candidate.kind === 'purchase'),
  )
  const rootId = linkedRoot ?? movement.id
  const group = movements.filter(
    (candidate) =>
      candidate.kind === 'purchase' &&
      (candidate.id === rootId || candidate.links?.includes(rootId)),
  )
  if (!group.some((candidate) => candidate.id === movement.id)) group.push(movement)
  return group.sort((a, b) => a.date.localeCompare(b.date))
}

function initialForm(
  movement: Movement | null | undefined,
  defaultCategory: string,
  group: Movement[] = movement ? [movement] : [],
): FormState {
  if (movement?.kind === 'income') {
    const detected = paymentMethodOf(movement)
    const method = detected === 'Voucher Income' || detected === 'Salary' ? detected : 'Transfer'
    return {
      type: 'Income',
      date: movement.date,
      amount: formatPlainCurrency(incomeAmount(movement)),
      description: movement.description,
      category: categoryOf(movement) ?? 'Income',
      account: accountForPaymentMethod(method),
      method,
      counterparty: '',
      installmentTotal: '1',
    }
  }
  if (movement?.kind === 'purchase') {
    const amount = group.reduce((sum, item) => addCurrency(sum, movementTotal(item)), 0)
    const method =
      paymentMethodOf(movement) && paymentMethodOf(movement) !== 'Someone else'
        ? (paymentMethodOf(movement) as PaymentMethod)
        : 'Debit/PIX'
    return {
      type: 'Expense',
      date: movement.date,
      amount: formatPlainCurrency(amount),
      description: movement.description,
      category: categoryOf(movement) ?? defaultCategory,
      account: fundingAccountOf(movement) ?? accountForPaymentMethod(method),
      method,
      counterparty:
        movement.postings.find((posting) => posting.account === 'payable')?.counterparty ?? '',
      installmentTotal: String(Math.max(1, group.length)),
    }
  }
  return {
    type: 'Expense',
    date: localYMD(),
    amount: '',
    description: '',
    category: defaultCategory,
    account: 'checking',
    method: 'Debit/PIX',
    counterparty: '',
    installmentTotal: '1',
  }
}

function sharesOf(movements: Movement[]): PurchaseShare[] {
  const totals = new Map<string, number>()
  for (const movement of movements) {
    for (const posting of movement.postings) {
      if (posting.account !== 'receivable' || !posting.counterparty) continue
      totals.set(
        posting.counterparty,
        addCurrency(totals.get(posting.counterparty) ?? 0, posting.amount),
      )
    }
  }
  return [...totals].map(([counterparty, amount]) => ({ counterparty, amount }))
}

export default function TransactionForm({
  open,
  onOpenChange,
  editMovement,
  onDelete,
}: TransactionFormProps) {
  const { dispatch, state } = useFinance()
  const { toast } = useToast()
  const defaultCategory =
    categoryOptionsForMonth(currentYM(), state.budgets, state.movements)[0] ?? 'Other'
  const editGroup = useMemo(
    () => purchaseGroup(editMovement, state.movements),
    [editMovement, state.movements],
  )
  const editRoot =
    editMovement?.kind === 'purchase'
      ? (editGroup.find(
          (movement) => !movement.links?.some((id) => editGroup.some((item) => item.id === id)),
        ) ??
        editGroup[0] ??
        editMovement)
      : editMovement

  const [form, setForm] = useState<FormState>(() =>
    initialForm(editRoot, defaultCategory, editGroup),
  )
  const [shares, setShares] = useState<PurchaseShare[]>(() => sharesOf(editGroup))
  const [showSplitConfig, setShowSplitConfig] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customCategory, setCustomCategory] = useState(false)
  const isGroupedInstallment = editGroup.length > 1

  const categories = useMemo(() => {
    const month = form.date ? monthOf(form.date) : currentYM()
    const options = categoryOptionsForMonth(month, state.budgets, state.movements)
    const all = options.includes(form.category) ? options : [form.category, ...options]
    return all.filter(Boolean)
  }, [form.date, form.category, state.budgets, state.movements])

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setForm(initialForm(editRoot, defaultCategory, editGroup))
    setShares(sharesOf(editGroup))
    setError(null)
    setCustomCategory(false)
  }, [editMovement, editRoot, editGroup, open, defaultCategory])

  const amount = parseCurrency(form.amount)
  const shareTotal = shares.reduce((sum, share) => addCurrency(sum, share.amount), 0)
  const userShare = Math.max(0, addCurrency(amount, -shareTotal))
  const overBy = Math.max(0, addCurrency(shareTotal, -amount))

  function changeType(type: 'Expense' | 'Income') {
    const method: PaymentMethod = type === 'Income' ? 'Transfer' : 'Debit/PIX'
    setForm((current) => ({
      ...current,
      type,
      method,
      account: accountForPaymentMethod(method),
    }))
  }

  function changeMethod(method: PaymentMethod) {
    setForm((current) => ({
      ...current,
      method,
      account: accountForPaymentMethod(method),
    }))
  }

  function changePayer(payer: 'me' | 'someone-else') {
    setForm((current) => ({
      ...current,
      account: payer === 'someone-else' ? 'payable' : accountForPaymentMethod(current.method),
    }))
  }

  function handleSave() {
    setError(null)
    if (amount <= 0) {
      setError('Amount must be greater than 0')
      return
    }
    if (!form.description.trim()) {
      setError('Description is required')
      return
    }
    if (form.type === 'Expense' && form.account === 'payable' && !form.counterparty.trim()) {
      setError('Name who paid for this purchase')
      return
    }
    if (form.type === 'Expense' && !form.category.trim()) {
      setError('Category is required')
      return
    }
    if (form.type === 'Expense' && overBy > 0) {
      setError('Shares cannot exceed the purchase amount')
      return
    }

    if (form.type === 'Income') {
      const method: IncomePaymentMethod =
        form.method === 'Salary' || form.method === 'Voucher Income' ? form.method : 'Transfer'
      const result = buildIncome({
        id: editRoot?.id ?? crypto.randomUUID(),
        date: form.date,
        description: form.description,
        amount,
        account: accountForPaymentMethod(method) as 'checking' | 'voucher' | 'cash',
        method,
        category: 'Income',
        ...(editRoot?.importId ? { importId: editRoot.importId } : {}),
      })
      if (!result.ok) {
        setError(result.reason)
        return
      }
      commit([result.value])
      return
    }

    const result = buildPurchase({
      id: editRoot?.kind === 'purchase' ? editRoot.id : crypto.randomUUID(),
      date: form.date,
      description: form.description,
      amount,
      category: form.category,
      account: form.account,
      ...(form.account === 'payable' ? { counterparty: form.counterparty.trim() } : {}),
      shares:
        form.account === 'payable'
          ? []
          : shares.filter((share) => share.counterparty.trim() && share.amount > 0),
      installments: Math.max(1, Number.parseInt(form.installmentTotal, 10) || 1),
      ...(editRoot?.importId ? { importId: editRoot.importId } : {}),
    })
    if (!result.ok) {
      setError(result.reason)
      return
    }
    const existingById = new Map(editGroup.map((movement) => [movement.id, movement]))
    const built = result.value.map((movement) => {
      const existing = existingById.get(movement.id)
      return {
        ...movement,
        ...(existing?.importId ? { importId: existing.importId } : {}),
        ...(movement.id === editRoot?.id && existing?.links ? { links: existing.links } : {}),
      }
    })
    commit(built)
  }

  function commit(movements: Movement[]) {
    const editing = Boolean(editMovement)
    startTransition(() => {
      if (!editing) {
        dispatch({ type: 'ADD_MOVEMENTS', payload: movements })
        return
      }
      const existingIds = new Set(editGroup.map((movement) => movement.id))
      for (const movement of movements) {
        if (existingIds.has(movement.id)) {
          dispatch({ type: 'UPDATE_MOVEMENT', payload: movement })
        } else {
          dispatch({ type: 'ADD_MOVEMENTS', payload: [movement] })
        }
      }
      for (const movement of editGroup) {
        if (!movements.some((updated) => updated.id === movement.id)) {
          dispatch({ type: 'DELETE_MOVEMENT', payload: movement.id })
        }
      }
    })
    toast(editing ? 'Transaction updated' : 'Transaction added', 'success')
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isGroupedInstallment
                ? 'Edit purchase plan'
                : editMovement
                  ? 'Edit Transaction'
                  : 'Add Transaction'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <SegmentedControl
              aria-label="Transaction type"
              className="w-full"
              value={form.type}
              onValueChange={(value) => changeType(value as 'Expense' | 'Income')}
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

            {form.type === 'Expense' && form.account === 'payable' ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="tx-payer" className="text-xs">
                    Who paid?
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => changePayer('me')}
                  >
                    I paid
                  </button>
                </div>
                <Input
                  id="tx-payer"
                  placeholder="Name"
                  value={form.counterparty}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, counterparty: event.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="tx-method" className="text-xs">
                    Payment method
                  </Label>
                  {form.type === 'Expense' && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline"
                      onClick={() => changePayer('someone-else')}
                    >
                      Someone else paid
                    </button>
                  )}
                </div>
                <Select
                  modal={false}
                  value={form.method}
                  onValueChange={(value) => changeMethod((value ?? 'Debit/PIX') as PaymentMethod)}
                >
                  <SelectTrigger id="tx-method" className="w-full min-w-0">
                    <SelectValue>{form.method}</SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {(form.type === 'Income'
                      ? INCOME_PAYMENT_METHODS
                      : EXPENSE_PAYMENT_METHODS
                    ).map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.type === 'Expense' && (
              <div className="space-y-1">
                <Label htmlFor="tx-category" className="text-xs">
                  Category
                </Label>
                <Select
                  modal={false}
                  value={customCategory ? '__custom' : form.category}
                  onValueChange={(value) => {
                    if (value === '__custom') {
                      setCustomCategory(true)
                      setForm((current) => ({ ...current, category: '' }))
                      return
                    }
                    setCustomCategory(false)
                    setForm((current) => ({ ...current, category: value ?? 'Other' }))
                  }}
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
                    <SelectItem value="__custom">New category…</SelectItem>
                  </SelectContent>
                </Select>
                {customCategory && (
                  <Input
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value }))
                    }
                    placeholder="Category name"
                  />
                )}
              </div>
            )}

            {form.type === 'Expense' &&
              form.method === 'Credit' &&
              (!editMovement || isGroupedInstallment) && (
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="tx-installments" className="text-xs">
                      Installments
                    </Label>
                  </div>
                  <Input
                    id="tx-installments"
                    type="number"
                    min="1"
                    max="48"
                    inputMode="numeric"
                    value={form.installmentTotal}
                    className="h-10 w-24 text-right"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        installmentTotal: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      setForm((current) => ({
                        ...current,
                        installmentTotal: String(
                          Math.min(
                            48,
                            Math.max(1, Number.parseInt(current.installmentTotal, 10) || 1),
                          ),
                        ),
                      }))
                    }
                  />
                </div>
              )}

            {form.type === 'Expense' && form.account !== 'payable' && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-start justify-between gap-3">
                  <Label className="text-xs font-medium">Who owes you?</Label>
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

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
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
            {editMovement && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto text-xs text-destructive hover:bg-destructive/10"
                onClick={() => {
                  const id = editRoot?.id ?? editMovement.id
                  onOpenChange(false)
                  onDelete(id)
                }}
              >
                <TrashIcon /> Delete
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
