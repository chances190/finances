<script lang="ts">
import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon'
import { MediaQuery } from 'svelte/reactivity'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  availableMonths,
  compareMovements,
  currentYM,
  type MovementSortKey,
} from '@/domain/calculations'
import { allCategoryNames, categoryOptionsForMonth } from '@/domain/categories'
import {
  accountForPaymentMethod,
  buildIncome,
  buildPurchase,
  categoryOf,
  type IncomePaymentMethod,
  type InstallmentInfo,
  installmentInfo,
  type Movement,
  movementMonth,
  type OutstandingMovement,
  outstandingMovements,
  PAYMENT_METHODS,
  type PaymentMethod,
  paymentMethodOf,
} from '@/domain/ledger'
import { navigate, router } from '@/lib/router.svelte'
import { finance } from '@/lib/stores/finance.svelte'
import { toast } from '@/lib/stores/toast.svelte'
import { toastUndo } from '@/lib/undo-toast'
import DesktopMovementList from './DesktopMovementList.svelte'
import MobileMovementList from './MobileMovementList.svelte'
import { paymentLabelOf } from './movement-display'
import RefundDialog from './RefundDialog.svelte'
import SmartTransactionInput from './SmartTransactionInput.svelte'
import TransactionFilters from './TransactionFilters.svelte'
import TransactionForm from './TransactionForm.svelte'

const SORT_OPTIONS: { value: string; label: string; compact: string }[] = [
  { value: 'date:desc', label: 'Date: newest first', compact: 'Date ↓' },
  { value: 'date:asc', label: 'Date: oldest first', compact: 'Date ↑' },
  { value: 'amount:desc', label: 'Amount: high to low', compact: 'Amount ↓' },
  { value: 'amount:asc', label: 'Amount: low to high', compact: 'Amount ↑' },
  { value: 'description:asc', label: 'Description: A to Z', compact: 'Description ↑' },
  { value: 'description:desc', label: 'Description: Z to A', compact: 'Description ↓' },
  { value: 'category:asc', label: 'Category: A to Z', compact: 'Category ↑' },
  { value: 'payment:asc', label: 'Payment: A to Z', compact: 'Payment ↑' },
]

function getParamList(params: URLSearchParams, key: string): string[] {
  const value = params.get(key)
  return value ? value.split(',').filter(Boolean) : []
}

const financeState = $derived(finance.state)
const isDesktop = new MediaQuery('(min-width: 640px)')

let sortKey = $state<string | null>(null)
let sortDir = $state<'asc' | 'desc'>('desc')
let editingMovement = $state<Movement | null>(null)
let showEditForm = $state(false)
let showAddForm = $state(false)
let refundPurchase = $state<Movement | null>(null)

const searchParams = $derived(new URLSearchParams(router.search))
const filterSearch = $derived(searchParams.get('search') ?? '')
const filterMonth = $derived(searchParams.get('month') ?? 'all')
const filterType = $derived(searchParams.get('type') ?? 'all')
const viewParam = $derived(searchParams.get('view'))
const view = $derived<'spending' | 'activity'>(
  viewParam === 'activity' || (!viewParam && searchParams.has('movement'))
    ? 'activity'
    : 'spending',
)
const filterCategories = $derived(getParamList(searchParams, 'category'))
const filterPayments = $derived(getParamList(searchParams, 'payment'))
const filterCounterparties = $derived(getParamList(searchParams, 'person'))
const movementParam = $derived(searchParams.get('movement'))
const filterMovementId = $derived(
  movementParam && financeState.movements.some((movement) => movement.id === movementParam)
    ? movementParam
    : null,
)

let localSearch = $state('')

$effect(() => {
  localSearch = filterSearch
})

$effect(() => {
  if (localSearch === filterSearch) return
  const timer = setTimeout(() => {
    updateParam('search', localSearch || null)
  }, 150)
  return () => clearTimeout(timer)
})

function applyParams(next: URLSearchParams, replace = true) {
  const query = next.toString()
  navigate(query ? `${router.path}?${query}` : router.path, { replace })
}

function updateParam(key: string, value: string | string[] | null) {
  const next = new URLSearchParams(router.search)
  if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    next.delete(key)
  } else if (Array.isArray(value)) {
    next.set(key, value.join(','))
  } else if (value === 'all') {
    next.delete(key)
  } else {
    next.set(key, value)
  }
  applyParams(next)
}

const months = $derived(availableMonths(financeState.movements))

const knownDescriptions = $derived.by(() => {
  const descriptions = new Set<string>()
  for (const movement of financeState.movements) descriptions.add(movement.description)
  return Array.from(descriptions).sort()
})

const allCategories = $derived(allCategoryNames(financeState.budgets, financeState.movements))

function categoriesForMonth(month: string | null) {
  return categoryOptionsForMonth(month ?? currentYM(), financeState.budgets, financeState.movements)
}

const allCounterparties = $derived.by(() => {
  const names = new Set<string>()
  for (const movement of financeState.movements) {
    for (const posting of movement.postings) {
      if (posting.counterparty) names.add(posting.counterparty)
    }
  }
  return Array.from(names).sort()
})

const installmentsById = $derived.by(() => {
  const map = new Map<string, InstallmentInfo>()
  for (const movement of financeState.movements) {
    const info = installmentInfo(movement, financeState.movements)
    if (info) map.set(movement.id, info)
  }
  return map
})

const debtRowsById = $derived.by(() => {
  const map = new Map<string, OutstandingMovement[]>()
  for (const direction of ['receivable', 'payable'] as const) {
    for (const row of outstandingMovements(financeState.movements, direction)) {
      const rows = map.get(row.movementId)
      if (rows) rows.push(row)
      else map.set(row.movementId, [row])
    }
  }
  return map
})

const allPaymentMethods = $derived.by(() => {
  const labels = new Set<string>([...PAYMENT_METHODS, 'Someone else'])
  for (const movement of financeState.movements) {
    const method = paymentMethodOf(movement)
    if (method) labels.add(method)
  }
  return Array.from(labels).sort()
})

function setView(next: 'spending' | 'activity') {
  const params = new URLSearchParams(router.search)
  params.set('view', next)
  if (next === 'spending' && params.get('type') === 'Other') params.delete('type')
  applyParams(params)
}

const filtered = $derived.by(() => {
  let movements = financeState.movements
  if (filterMovementId) {
    movements = movements.filter((movement) => movement.id === filterMovementId)
  }
  if (view === 'spending') {
    movements = movements.filter(
      (movement) =>
        movement.kind === 'purchase' || movement.kind === 'income' || movement.kind === 'refund',
    )
  }
  if (filterType === 'Expense') {
    movements = movements.filter(
      (movement) => movement.kind === 'purchase' || movement.kind === 'refund',
    )
  } else if (filterType === 'Income') {
    movements = movements.filter((movement) => movement.kind === 'income')
  } else if (filterType === 'Other') {
    movements = movements.filter(
      (movement) =>
        movement.kind === 'transfer' ||
        movement.kind === 'settlement' ||
        movement.kind === 'adjustment',
    )
  }
  if (filterMonth !== 'all') {
    movements = movements.filter((movement) => movementMonth(movement) === filterMonth)
  }
  if (filterSearch) {
    const needle = filterSearch.toLowerCase()
    movements = movements.filter((movement) => movement.description.toLowerCase().includes(needle))
  }
  if (filterCategories.length > 0) {
    movements = movements.filter(
      (movement) =>
        categoryOf(movement) && filterCategories.includes(categoryOf(movement) as string),
    )
  }
  if (filterPayments.length > 0) {
    movements = movements.filter((movement) => filterPayments.includes(paymentLabelOf(movement)))
  }
  if (filterCounterparties.length > 0) {
    movements = movements.filter((movement) =>
      movement.postings.some(
        (posting) => posting.counterparty && filterCounterparties.includes(posting.counterparty),
      ),
    )
  }
  if (sortKey === 'payment') {
    movements = [...movements].sort(
      (a, b) => paymentLabelOf(a).localeCompare(paymentLabelOf(b)) * (sortDir === 'asc' ? 1 : -1),
    )
  } else if (sortKey) {
    movements = [...movements].sort((a, b) =>
      compareMovements(a, b, sortKey as MovementSortKey, sortDir),
    )
  } else {
    movements = [...movements].sort((a, b) => b.date.localeCompare(a.date))
  }
  return movements
})

const activeFilterCount = $derived(
  (filterMovementId ? 1 : 0) +
    (filterType !== 'all' ? 1 : 0) +
    (filterMonth !== 'all' ? 1 : 0) +
    filterCategories.length +
    filterPayments.length +
    filterCounterparties.length,
)

function handleSort(key: string) {
  if (sortKey === key) {
    if (sortDir === 'desc') {
      sortDir = 'asc'
    } else {
      sortKey = null
      sortDir = 'desc'
    }
  } else {
    sortKey = key
    sortDir = 'desc'
  }
}

function handleSmartAdd(row: {
  description: string
  amount: number
  category: string | null
  paymentMethod: PaymentMethod | null
  kind: 'income' | 'expense' | null
  date: string
}) {
  if (row.amount <= 0) return
  const method: PaymentMethod =
    row.paymentMethod ?? (row.kind === 'income' ? 'Transfer' : 'Debit/PIX')
  const account = accountForPaymentMethod(method)

  if (row.kind === 'income') {
    const incomeMethod: IncomePaymentMethod =
      method === 'Salary' || method === 'Voucher Income' ? method : 'Transfer'
    const incomeAccount = accountForPaymentMethod(incomeMethod)
    const result = buildIncome({
      id: crypto.randomUUID(),
      date: row.date,
      description: row.description,
      amount: row.amount,
      account: incomeAccount === 'voucher' || incomeAccount === 'cash' ? incomeAccount : 'checking',
      method: incomeMethod,
      category: 'Income',
    })
    if (!result.ok) {
      toast(result.reason, 'error')
      return
    }
    const auditId = finance.dispatchUndoable({ type: 'ADD_MOVEMENTS', payload: [result.value] })
    toastUndo('Income added', auditId)
    return
  }

  const result = buildPurchase({
    id: crypto.randomUUID(),
    date: row.date,
    description: row.description,
    amount: row.amount,
    category: row.category ?? 'Other',
    account,
  })
  if (!result.ok) {
    toast(result.reason, 'error')
    return
  }
  const auditId = finance.dispatchUndoable({ type: 'ADD_MOVEMENTS', payload: result.value })
  toastUndo('Transaction added', auditId)
}

function handleDelete(id: string) {
  const selected = financeState.movements.find((movement) => movement.id === id)
  if (!selected) return

  const ids = new Set([selected.id])
  if (selected.kind === 'purchase') {
    const rootId =
      selected.links?.find((linkedId) =>
        financeState.movements.some(
          (movement) => movement.id === linkedId && movement.kind === 'purchase',
        ),
      ) ?? selected.id
    for (const movement of financeState.movements) {
      if (
        movement.kind === 'purchase' &&
        (movement.id === rootId || movement.links?.includes(rootId))
      ) {
        ids.add(movement.id)
      }
    }
    for (const movement of financeState.movements) {
      if (movement.links?.some((linkedId) => ids.has(linkedId))) ids.add(movement.id)
    }
  }
  const auditId = finance.dispatchUndoable({ type: 'DELETE_MOVEMENTS', payload: [...ids] })
  toastUndo(
    ids.size > 1 ? 'Purchase and linked activity deleted' : 'Transaction deleted',
    auditId,
    'info',
  )
}

function handleRowOpen(movement: Movement) {
  if (movement.kind !== 'purchase' && movement.kind !== 'income') return
  editingMovement = movement
  showEditForm = true
}

const emptyMessage = $derived(
  view === 'spending' ? 'No spending transactions yet.' : 'No activity yet.',
)
</script>

{#snippet clearAll()}
  {#if activeFilterCount > 0 || filterSearch}
    <Button
      variant="ghost"
      size="sm"
      class="h-7 px-2 text-xs text-muted-foreground"
      onclick={() => applyParams(new URLSearchParams())}
    >
      Clear all
    </Button>
  {/if}
{/snippet}

<div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-lg font-semibold text-foreground">Transactions</h2>
    <SegmentedControl
      aria-label="Transaction view"
      value={view}
      onValueChange={(value) => setView(value as 'spending' | 'activity')}
      options={[
        { value: 'spending', label: 'Spending' },
        { value: 'activity', label: 'All activity' },
      ]}
    />
  </div>

  <SmartTransactionInput
    onAdd={handleSmartAdd}
    onOpenModal={() => {
      showAddForm = true
    }}
    {knownDescriptions}
    {categoriesForMonth}
  />

  <div class="flex flex-wrap items-center gap-2">
    <Input
      placeholder="Search description..."
      value={localSearch}
      oninput={(event) => {
        localSearch = event.currentTarget.value
      }}
      class="h-10 min-w-0 flex-1 text-xs sm:h-7 sm:w-44 sm:flex-none"
      aria-label="Search transactions"
    />

    {#if !isDesktop.current}
      <Select
        type="single"
        value={sortKey ? `${sortKey}:${sortDir}` : 'date:desc'}
        onValueChange={(value) => {
          if (!value) return
          const [key, direction] = value.split(':')
          sortKey = key === 'date' && direction === 'desc' ? null : key
          sortDir = direction as 'asc' | 'desc'
        }}
      >
        <SelectTrigger class="h-10 w-28 text-xs sm:h-7" aria-label="Sort transactions">
          {SORT_OPTIONS.find(
            (option) => option.value === (sortKey ? `${sortKey}:${sortDir}` : 'date:desc'),
          )?.compact ?? 'Sort'}
        </SelectTrigger>
        <SelectContent>
          {#each SORT_OPTIONS as option (option.value)}
            <SelectItem value={option.value}>{option.label}</SelectItem>
          {/each}
        </SelectContent>
      </Select>
    {/if}

    {#if isDesktop.current}
      <TransactionFilters
        {filterType}
        {filterMonth}
        {filterCategories}
        {filterPayments}
        {filterCounterparties}
        {months}
        {allCategories}
        {allPaymentMethods}
        {allCounterparties}
        showOtherType={view === 'activity'}
        {updateParam}
      />
    {:else}
      <Popover>
        <PopoverTrigger>
          {#snippet child({ props })}
            <Button
              variant="outline"
              size="icon-sm"
              class="size-10 sm:size-8 {activeFilterCount > 0
                ? 'border-primary bg-muted text-foreground'
                : ''}"
              {...props}
            >
              <FunnelIcon class="size-3" />
              <span class="sr-only">
                {activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
              </span>
            </Button>
          {/snippet}
        </PopoverTrigger>
        <PopoverContent class="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-3">
          <div class="flex flex-col gap-3">
            {@render clearAll()}
            <TransactionFilters
              {filterType}
              {filterMonth}
              {filterCategories}
              {filterPayments}
              {filterCounterparties}
              {months}
              {allCategories}
              {allPaymentMethods}
              {allCounterparties}
              showOtherType={view === 'activity'}
              {updateParam}
              wide
            />
          </div>
        </PopoverContent>
      </Popover>
    {/if}

    {#if isDesktop.current}
      {@render clearAll()}
    {/if}
  </div>

  {#if isDesktop.current}
    <DesktopMovementList
      movements={filtered}
      {debtRowsById}
      {emptyMessage}
      {installmentsById}
      onOpen={handleRowOpen}
      onRefund={(movement) => {
        refundPurchase = movement
      }}
      onDelete={handleDelete}
      onSort={handleSort}
      {sortKey}
      {sortDir}
    />
  {:else}
    <MobileMovementList
      movements={filtered}
      {debtRowsById}
      {emptyMessage}
      {installmentsById}
      onOpen={handleRowOpen}
      onRefund={(movement) => {
        refundPurchase = movement
      }}
      onDelete={handleDelete}
    />
  {/if}
</div>

{#if showEditForm}
  <TransactionForm
    open
    onOpenChange={(open) => {
      showEditForm = open
      if (!open) editingMovement = null
    }}
    editMovement={editingMovement}
    onDelete={handleDelete}
  />
{/if}

{#if showAddForm}
  <TransactionForm
    open
    onOpenChange={(open) => {
      showAddForm = open
    }}
  />
{/if}

{#if refundPurchase}
  <RefundDialog
    purchase={refundPurchase}
    onOpenChange={(open) => {
      if (!open) refundPurchase = null
    }}
  />
{/if}
