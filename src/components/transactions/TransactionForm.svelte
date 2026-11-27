<script lang="ts">
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/svelte'
import { untrack } from 'svelte'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
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
import { type FinanceAction, finance } from '@/lib/stores/finance.svelte'
import { toastUndo } from '@/lib/undo-toast'
import SplitConfigModal from './SplitConfigModal.svelte'

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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editMovement?: Movement | null
  onDelete?: (id: string) => void
}

let { open, onOpenChange, editMovement = null, onDelete }: Props = $props()

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

const financeState = $derived(finance.state)
const defaultCategory = $derived(
  categoryOptionsForMonth(currentYM(), financeState.budgets, financeState.movements)[0] ?? 'Other',
)
const editGroup = $derived(purchaseGroup(editMovement, financeState.movements))
const editRoot = $derived(
  editMovement?.kind === 'purchase'
    ? (editGroup.find(
        (movement) => !movement.links?.some((id) => editGroup.some((item) => item.id === id)),
      ) ??
        editGroup[0] ??
        editMovement)
    : editMovement,
)

let form = $state<FormState>(untrack(() => initialForm(editRoot, defaultCategory, editGroup)))
let shares = $state<PurchaseShare[]>(untrack(() => sharesOf(editGroup)))
let showSplitConfig = $state(false)
let showCsvImport = $state(false)
let error = $state<string | null>(null)
let customCategory = $state(false)

const isGroupedInstallment = $derived(editGroup.length > 1)

const categories = $derived.by(() => {
  const month = form.date ? monthOf(form.date) : currentYM()
  const options = categoryOptionsForMonth(month, financeState.budgets, financeState.movements)
  const all = options.includes(form.category) ? options : [form.category, ...options]
  return all.filter(Boolean)
})

const amount = $derived(parseCurrency(form.amount))
const shareTotal = $derived(shares.reduce((sum, share) => addCurrency(sum, share.amount), 0))
const userShare = $derived(Math.max(0, addCurrency(amount, -shareTotal)))
const overBy = $derived(Math.max(0, addCurrency(shareTotal, -amount)))

function changeType(type: 'Expense' | 'Income') {
  const method: PaymentMethod = type === 'Income' ? 'Transfer' : 'Debit/PIX'
  form.type = type
  form.method = method
  form.account = accountForPaymentMethod(method)
}

function changeMethod(method: PaymentMethod) {
  form.method = method
  form.account = accountForPaymentMethod(method)
}

function changePayer(payer: 'me' | 'someone-else') {
  form.account = payer === 'someone-else' ? 'payable' : accountForPaymentMethod(form.method)
}

function handleSave() {
  error = null
  if (amount <= 0) {
    error = 'Amount must be greater than 0'
    return
  }
  if (!form.description.trim()) {
    error = 'Description is required'
    return
  }
  if (form.type === 'Expense' && form.account === 'payable' && !form.counterparty.trim()) {
    error = 'Name who paid for this purchase'
    return
  }
  if (form.type === 'Expense' && !form.category.trim()) {
    error = 'Category is required'
    return
  }
  if (form.type === 'Expense' && overBy > 0) {
    error = 'Shares cannot exceed the purchase amount'
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
      error = result.reason
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
    error = result.reason
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
  const actions: FinanceAction[] = []
  if (!editing) {
    actions.push({ type: 'ADD_MOVEMENTS', payload: movements })
  } else {
    const existingIds = new Set(editGroup.map((movement) => movement.id))
    for (const movement of movements) {
      if (existingIds.has(movement.id)) {
        actions.push({ type: 'UPDATE_MOVEMENT', payload: movement })
      } else {
        actions.push({ type: 'ADD_MOVEMENTS', payload: [movement] })
      }
    }
    for (const movement of editGroup) {
      if (!movements.some((updated) => updated.id === movement.id)) {
        actions.push({ type: 'DELETE_MOVEMENT', payload: movement.id })
      }
    }
  }
  const auditId = finance.dispatchBatch(actions)
  toastUndo(editing ? 'Transaction updated' : 'Transaction added', auditId)
  onOpenChange(false)
}
</script>

<Dialog {open} {onOpenChange}>
  <DialogContent class="sm:max-h-[calc(100dvh-2rem)] sm:overflow-y-auto sm:max-w-md">
    <DialogHeader>
      <DialogTitle>
        {isGroupedInstallment
          ? 'Edit purchase plan'
          : editMovement
            ? 'Edit Transaction'
            : 'Add Transaction'}
      </DialogTitle>
    </DialogHeader>

    <div class="space-y-3">
      <SegmentedControl
        aria-label="Transaction type"
        class="w-full"
        value={form.type}
        onValueChange={(value) => changeType(value as 'Expense' | 'Income')}
        options={[
          { value: 'Expense', label: 'Expense' },
          { value: 'Income', label: 'Income' },
        ]}
      />

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div class="space-y-1">
          <Label for="tx-date" class="text-xs">Date</Label>
          <Input
            id="tx-date"
            type="date"
            value={form.date}
            oninput={(event) => {
              form.date = event.currentTarget.value
            }}
          />
        </div>
        <div class="space-y-1">
          <Label for="tx-amount" class="text-xs">Amount (R$)</Label>
          <MoneyInput
            id="tx-amount"
            value={form.amount}
            placeholder="0,00"
            onValueChange={(value) => {
              form.amount = value
            }}
          />
        </div>
      </div>

      <div class="space-y-1">
        <Label for="tx-description" class="text-xs">Description</Label>
        <Input
          id="tx-description"
          value={form.description}
          placeholder="What was it?"
          oninput={(event) => {
            form.description = event.currentTarget.value
          }}
        />
      </div>

      {#if form.type === 'Expense' && form.account === 'payable'}
        <div class="space-y-1">
          <div class="flex items-center justify-between gap-2">
            <Label for="tx-payer" class="text-xs">Who paid?</Label>
            <button
              type="button"
              class="text-xs text-muted-foreground underline"
              onclick={() => changePayer('me')}
            >
              I paid
            </button>
          </div>
          <Input
            id="tx-payer"
            placeholder="Name"
            value={form.counterparty}
            oninput={(event) => {
              form.counterparty = event.currentTarget.value
            }}
          />
        </div>
      {:else}
        <div class="space-y-1">
          <div class="flex items-center justify-between gap-2">
            <Label for="tx-method" class="text-xs">Payment method</Label>
            {#if form.type === 'Expense'}
              <button
                type="button"
                class="text-xs text-muted-foreground underline"
                onclick={() => changePayer('someone-else')}
              >
                Someone else paid
              </button>
            {/if}
          </div>
          <Select
            type="single"
            value={form.method}
            onValueChange={(value) => changeMethod((value ?? 'Debit/PIX') as PaymentMethod)}
          >
            <SelectTrigger id="tx-method" class="w-full min-w-0">
              {form.method}
            </SelectTrigger>
            <SelectContent>
              {#each form.type === 'Income'
                ? INCOME_PAYMENT_METHODS
                : EXPENSE_PAYMENT_METHODS as method (method)}
                <SelectItem value={method}>{method}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
        </div>
      {/if}

      {#if form.type === 'Expense'}
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <Label for="tx-category" class="text-xs">Category</Label>
            {#if !customCategory}
              <button
                type="button"
                class="text-[10px] font-semibold text-primary"
                onclick={() => {
                  customCategory = true
                  form.category = ''
                }}
              >
                New category
              </button>
            {/if}
          </div>
          <Select
            type="single"
            value={form.category}
            onValueChange={(value) => {
              customCategory = false
              form.category = value ?? 'Other'
            }}
          >
            <SelectTrigger id="tx-category" class="w-full min-w-0">
              {form.category || 'Choose…'}
            </SelectTrigger>
            <SelectContent>
              {#each categories as category (category)}
                <SelectItem value={category}>{category}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
          {#if customCategory}
            <Input
              value={form.category}
              oninput={(event) => {
                form.category = event.currentTarget.value
              }}
              placeholder="Category name"
            />
          {/if}
        </div>
      {/if}

      {#if form.type === 'Expense' &&
        form.method === 'Credit' &&
        (!editMovement || isGroupedInstallment)}
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-0.5">
            <Label for="tx-installments" class="text-xs">Installments</Label>
          </div>
          <Input
            id="tx-installments"
            type="number"
            min="1"
            max="48"
            inputmode="numeric"
            value={form.installmentTotal}
            class="h-10 w-24 text-right"
            oninput={(event) => {
              form.installmentTotal = event.currentTarget.value
            }}
            onblur={() => {
              form.installmentTotal = String(
                Math.min(48, Math.max(1, Number.parseInt(form.installmentTotal, 10) || 1)),
              )
            }}
          />
        </div>
      {/if}

      {#if form.type === 'Expense' && form.account !== 'payable'}
        <div class="space-y-2 border-t border-border pt-3">
          <div class="flex items-start justify-between gap-3">
            <Label class="text-xs font-medium">Who owes you?</Label>
            {#if shares.length > 0}
              <Button
                variant="outline"
                size="sm"
                class="h-10 shrink-0"
                onclick={() => {
                  showSplitConfig = true
                }}
              >
                Edit split
              </Button>
            {/if}
          </div>
          {#if shares.length === 0}
            <Button
              variant="outline"
              size="sm"
              class="h-10"
              disabled={!(amount > 0)}
              onclick={() => {
                showSplitConfig = true
              }}
            >
              Add people
            </Button>
          {:else}
            <div class="panel-inset p-2 text-xs">
              {#each shares as share (share.counterparty)}
                <div class="flex items-baseline justify-between gap-3 py-0.5">
                  <span class="min-w-0 break-words">{share.counterparty}</span>
                  <span class="shrink-0 font-mono">{formatPlainCurrency(share.amount)}</span>
                </div>
              {/each}
              <div class="flex items-baseline justify-between gap-3 py-0.5 font-medium">
                <span>You</span>
                <span class="shrink-0 font-mono">{formatPlainCurrency(userShare)}</span>
              </div>
              <div
                class="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1 font-medium"
              >
                <span>Purchase total</span>
                <span class="shrink-0 font-mono">{formatPlainCurrency(amount)}</span>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if error}
        <p role="alert" class="text-xs text-destructive">{error}</p>
      {/if}
    </div>

    <div class="flex gap-2 justify-end pt-4">
      {#if !editMovement}
        <Button
          variant="outline"
          size="sm"
          class="mr-auto text-xs"
          onclick={() => {
            showCsvImport = true
          }}
        >
          Import from file
        </Button>
      {/if}
      {#if editMovement && onDelete}
        <Button
          variant="ghost"
          size="sm"
          class="mr-auto text-xs text-destructive hover:bg-destructive/10"
          onclick={() => {
            const id = editRoot?.id ?? editMovement.id
            onOpenChange(false)
            onDelete(id)
          }}
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} /> Delete
        </Button>
      {/if}
      <Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
      <Button onclick={handleSave}>{editMovement ? 'Update' : 'Add'}</Button>
    </div>
  </DialogContent>
</Dialog>

{#if showSplitConfig}
  <SplitConfigModal
    onOpenChange={(value) => {
      showSplitConfig = value
    }}
    {shares}
    onSharesChange={(value) => {
      shares = value
    }}
    onRemoveAll={() => {
      shares = []
    }}
    totalAmount={amount}
  />
{/if}

{#if showCsvImport}
  {#await import('@/components/common/ImportDialog.svelte') then module}
    {@const ImportDialog = module.default}
    <ImportDialog
      open
      onOpenChange={(value) => {
        showCsvImport = value
      }}
      mode="transactions"
    />
  {/await}
{/if}
