<script lang="ts">
import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon'
import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon'
import { MediaQuery } from 'svelte/reactivity'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { currentYM } from '@/domain/calculations'
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
} from '@/domain/ledger'
import { navigate, router } from '@/lib/router.svelte'
import { finance } from '@/lib/stores/finance.svelte'
import { toast } from '@/lib/stores/toast.svelte'
import { toastUndo } from '@/lib/undo-toast'
import MovementDetail from './MovementDetail.svelte'
import MovementLedger from './MovementLedger.svelte'
import { paymentLabelOf } from './movement-display'
import RefundDialog from './RefundDialog.svelte'
import SmartTransactionInput from './SmartTransactionInput.svelte'
import TransactionFilters from './TransactionFilters.svelte'
import TransactionForm from './TransactionForm.svelte'
import TransactionsRail from './TransactionsRail.svelte'

function getParamList(params: URLSearchParams, key: string): string[] {
  const value = params.get(key)
  return value ? value.split(',').filter(Boolean) : []
}

const financeState = $derived(finance.state)
const hybrid = new MediaQuery('(min-width: 900px)')
const wideFilters = new MediaQuery('(min-width: 1040px)')
const railVisible = new MediaQuery('(min-width: 1100px)')

let editingMovement = $state<Movement | null>(null)
let showEditForm = $state(false)
let showAddForm = $state(false)
let refundPurchase = $state<Movement | null>(null)
let showFilters = $state(false)
let selectedId = $state<string | null>(null)
let detailOpen = $state(false)
let deepLinked = $state(false)

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

$effect(() => {
  if (railVisible.current) detailOpen = false
})

$effect(() => {
  if (deepLinked || !filterMovementId) return
  selectedId = filterMovementId
  if (!railVisible.current) detailOpen = true
  deepLinked = true
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

const months = $derived.by(() => {
  const values = new Set<string>()
  for (const movement of financeState.movements) values.add(movementMonth(movement))
  return [...values].sort().reverse()
})

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
  for (const movement of financeState.movements) labels.add(paymentLabelOf(movement))
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

const hasFilters = $derived(activeFilterCount > 0 || filterSearch !== '')
const selected = $derived(
  selectedId ? (filtered.find((movement) => movement.id === selectedId) ?? null) : null,
)
const railMonth = $derived(filterMonth === 'all' ? currentYM() : filterMonth)
const emptyMessage = $derived(
  hasFilters
    ? 'No transactions match'
    : view === 'spending'
      ? 'No spending transactions yet.'
      : 'No activity yet.',
)

function clearFilters() {
  applyParams(new URLSearchParams())
}

function selectMovement(movement: Movement) {
  selectedId = movement.id
  if (!railVisible.current) detailOpen = true
}

function openEdit(movement: Movement) {
  detailOpen = false
  editingMovement = movement
  showEditForm = true
}

function goToDebt(movement: Movement) {
  navigate(`/debts?movement=${movement.id}&settled=1`)
}

function openDebt(counterparty: string) {
  navigate(`/debts?person=${encodeURIComponent(counterparty)}`)
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
  const target = financeState.movements.find((movement) => movement.id === id)
  if (!target) return

  const ids = new Set([target.id])
  if (target.kind === 'purchase') {
    const rootId =
      target.links?.find((linkedId) =>
        financeState.movements.some(
          (movement) => movement.id === linkedId && movement.kind === 'purchase',
        ),
      ) ?? target.id
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
  detailOpen = false
}
</script>

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

  <div class="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]">
    <div class="min-w-0 space-y-4">
      <div class="panel p-3 transition-colors focus-within:border-ring">
        <SmartTransactionInput
          onAdd={handleSmartAdd}
          onOpenModal={() => {
            showAddForm = true
          }}
          {knownDescriptions}
          {categoriesForMonth}
        />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <MagnifyingGlassIcon
            class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search description..."
            value={localSearch}
            oninput={(event) => {
              localSearch = event.currentTarget.value
            }}
            class="h-10 pl-8 text-xs sm:h-7"
            aria-label="Search transactions"
          />
        </div>

        {#if wideFilters.current}
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
          {#if hasFilters}
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs text-muted-foreground"
              onclick={clearFilters}
            >
              Clear
            </Button>
          {/if}
        {:else}
          <Button
            variant="outline"
            size="sm"
            class="h-10 shrink-0 text-xs sm:h-7"
            onclick={() => {
              showFilters = true
            }}
          >
            <FunnelIcon class="size-3" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        {/if}
      </div>

      <MovementLedger
        movements={filtered}
        {debtRowsById}
        {installmentsById}
        selectedId={selected?.id ?? null}
        hybrid={hybrid.current}
        {emptyMessage}
        onClear={hasFilters ? clearFilters : null}
        onSelect={selectMovement}
        onRefund={(movement) => {
          refundPurchase = movement
        }}
        onDelete={handleDelete}
      />
    </div>

    <TransactionsRail
      movements={financeState.movements}
      budgets={financeState.budgets}
      {selected}
      month={railMonth}
      onEdit={openEdit}
      onRefund={(movement) => {
        refundPurchase = movement
      }}
      onDelete={handleDelete}
      onGoToDebt={goToDebt}
      onOpenDebt={openDebt}
    />
  </div>
</div>

{#if selected && detailOpen}
  <Dialog bind:open={detailOpen}>
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Entry details</DialogTitle>
      </DialogHeader>
      <MovementDetail
        movement={selected}
        allMovements={financeState.movements}
        onEdit={openEdit}
        onRefund={(movement) => {
          refundPurchase = movement
        }}
        onDelete={handleDelete}
        onGoToDebt={goToDebt}
      />
    </DialogContent>
  </Dialog>
{/if}

{#if showFilters}
  <Dialog bind:open={showFilters}>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Filters</DialogTitle>
      </DialogHeader>
      <div class="max-h-[60dvh] space-y-3 overflow-y-auto">
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
      <Button variant="outline" class="h-10 w-full" onclick={clearFilters}>
        Clear all filters
      </Button>
    </DialogContent>
  </Dialog>
{/if}

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
