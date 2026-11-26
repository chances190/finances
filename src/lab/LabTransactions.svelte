<script lang="ts">
import { MediaQuery } from 'svelte/reactivity'
import TransactionFilters from '@/components/transactions/TransactionFilters.svelte'
import TransactionForm from '@/components/transactions/TransactionForm.svelte'
import { localYMD } from '@/domain/calculations'
import { allCategoryNames } from '@/domain/categories'
import {
  accountForPaymentMethod,
  buildIncome,
  buildPurchase,
  type IncomePaymentMethod,
  type Movement,
  PAYMENT_METHODS,
  type PaymentMethod,
  paymentMethodOf,
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import { parseSmartInput } from '@/lib/parseSmartInput'
import { finance } from '@/lib/stores/finance.svelte'
import LabEntryDetail from './LabEntryDetail.svelte'
import LabIcon from './LabIcon.svelte'
import LabInspector from './LabInspector.svelte'
import LabLedger from './LabLedger.svelte'

const financeState = $derived(finance.state)
const allMovements = $derived([...financeState.movements])
const categories = $derived(allCategoryNames(financeState.budgets, financeState.movements))

let localMovements = $state<Movement[]>([])
let raw = $state('')
let search = $state('')
let filterType = $state('all')
let filterMonth = $state('all')
let filterCategories = $state<string[]>([])
let filterPayments = $state<string[]>([])
let filterCounterparties = $state<string[]>([])
let showFilterSheet = $state(false)
let showForm = $state(false)
let editingMovement = $state<Movement | null>(null)
let selectedId = $state<string | null>(null)
let detailOpen = $state(false)

const filterWide = new MediaQuery('(min-width: 1040px)')
const parsed = $derived(parseSmartInput(raw, categories))
const months = $derived(
  [...new Set(allMovements.map((movement) => movement.date.slice(0, 7)))].sort().reverse(),
)
const payments = $derived([...new Set([...PAYMENT_METHODS, 'Someone else'])].sort())
const people = $derived(
  [
    ...new Set(
      allMovements.flatMap((movement) =>
        movement.postings.flatMap((posting) =>
          posting.counterparty ? [posting.counterparty] : [],
        ),
      ),
    ),
  ].sort(),
)

const combined = $derived([...localMovements, ...allMovements])

const filtered = $derived.by(() => {
  let rows = combined
  if (filterType === 'Expense') {
    rows = rows.filter((m) => m.kind === 'purchase' || m.kind === 'refund')
  }
  if (filterType === 'Income') rows = rows.filter((m) => m.kind === 'income')
  if (filterType === 'Other') {
    rows = rows.filter(
      (m) => m.kind === 'transfer' || m.kind === 'settlement' || m.kind === 'adjustment',
    )
  }
  if (filterMonth !== 'all') rows = rows.filter((m) => m.date.startsWith(filterMonth))
  if (filterCategories.length > 0) {
    rows = rows.filter((m) =>
      m.postings.some((posting) => posting.category && filterCategories.includes(posting.category)),
    )
  }
  if (filterPayments.length > 0) {
    rows = rows.filter((m) => {
      const method = paymentMethodOf(m)
      return method ? filterPayments.includes(method) : false
    })
  }
  if (filterCounterparties.length > 0) {
    rows = rows.filter((m) =>
      m.postings.some(
        (posting) => posting.counterparty && filterCounterparties.includes(posting.counterparty),
      ),
    )
  }
  if (search.trim()) {
    const needle = search.trim().toLowerCase()
    rows = rows.filter((m) => m.description.toLowerCase().includes(needle))
  }
  return rows
})

const selected = $derived(
  selectedId ? (filtered.find((movement) => movement.id === selectedId) ?? null) : null,
)

const activeFilters = $derived(
  (filterType !== 'all' ? 1 : 0) +
    (filterMonth !== 'all' ? 1 : 0) +
    filterCategories.length +
    filterPayments.length +
    filterCounterparties.length,
)

function selectMovement(movement: Movement) {
  selectedId = movement.id
  detailOpen = true
}

function openAdd() {
  editingMovement = null
  showForm = true
}

function openEdit(movement: Movement) {
  selectedId = movement.id
  detailOpen = false
  editingMovement = movement
  showForm = true
}

function addFromCommand() {
  if (parsed.error || parsed.amount === null) return
  const method: PaymentMethod =
    parsed.paymentMethod ?? (parsed.kind === 'income' ? 'Transfer' : 'Debit/PIX')
  const date = parsed.date ?? localYMD()
  const description = parsed.description || 'New transaction'
  let movement: Movement | undefined

  if (parsed.kind === 'income') {
    const incomeMethod: IncomePaymentMethod =
      method === 'Salary' || method === 'Voucher Income' ? method : 'Transfer'
    const account = accountForPaymentMethod(incomeMethod)
    const result = buildIncome({
      id: crypto.randomUUID(),
      date,
      description,
      amount: parsed.amount,
      account: account === 'voucher' || account === 'cash' ? account : 'checking',
      method: incomeMethod,
      category: 'Income',
    })
    if (result.ok) movement = result.value
  } else {
    const result = buildPurchase({
      id: crypto.randomUUID(),
      date,
      description,
      amount: parsed.amount,
      category: parsed.category ?? 'Other',
      account: accountForPaymentMethod(method),
    })
    if (result.ok) movement = result.value[0]
  }

  if (movement) {
    localMovements = [movement, ...localMovements]
    raw = ''
  }
}

function updateFilterParam(key: string, value: string | string[] | null) {
  if (key === 'type') filterType = typeof value === 'string' ? value : 'all'
  if (key === 'month') filterMonth = typeof value === 'string' ? value : 'all'
  if (key === 'category') filterCategories = Array.isArray(value) ? value : []
  if (key === 'payment') filterPayments = Array.isArray(value) ? value : []
  if (key === 'person') filterCounterparties = Array.isArray(value) ? value : []
}

function clearFilters() {
  filterType = 'all'
  filterMonth = 'all'
  filterCategories = []
  filterPayments = []
  filterCounterparties = []
  search = ''
}
</script>

<div class="lab-workspace">
  <div class="lab-workspace-main space-y-4">
    <div class="panel lab-quick-add p-3">
      <form
        class="flex min-w-0 items-center gap-2"
        onsubmit={(event) => {
          event.preventDefault()
          addFromCommand()
        }}
      >
        <button type="submit" class="lab-quick-add-icon" aria-label="Add from input">
          <LabIcon name="plus" className="size-4" />
        </button>
        <input
          bind:value={raw}
          class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="iFood 34,90 #Food @Debit hoje"
          aria-label="Quick add"
        >
        <button
          type="button"
          class="lab-primary px-3 py-1.5 text-xs font-semibold"
          onclick={openAdd}
        >
          Add
        </button>
      </form>
      {#if raw.trim()}
        <div class="lab-command-preview">
          <span>{parsed.description || 'New transaction'}</span>
          <span class="font-mono">{formatCurrency(parsed.amount ?? 0)}</span>
          <span>{parsed.category ? `#${parsed.category}` : '#Other'}</span>
          <span
            >{parsed.paymentMethod ?? (parsed.kind === 'income' ? '@Transfer' : '@Debit/PIX')}</span
          >
          <span>{parsed.date ?? localYMD()}</span>
          {#if parsed.error}
            <span class="text-destructive">{parsed.error}</span>
          {/if}
        </div>
      {/if}
    </div>

    <div class="lab-filter-bar">
      <div class="lab-search">
        <LabIcon name="search" className="size-4 text-muted-foreground" />
        <input
          bind:value={search}
          placeholder="Search description..."
          aria-label="Search lab ledger"
        >
      </div>
      {#if filterWide.current}
        <div class="lab-filter-inline">
          <TransactionFilters
            {filterType}
            {filterMonth}
            {filterCategories}
            {filterPayments}
            {filterCounterparties}
            {months}
            allCategories={categories}
            allPaymentMethods={payments}
            allCounterparties={people}
            showOtherType
            updateParam={updateFilterParam}
          />
        </div>
        {#if activeFilters > 0}
          <button type="button" class="lab-filter-clear" onclick={clearFilters}>Clear</button>
        {/if}
      {:else}
        <button
          type="button"
          class="lab-secondary lab-filter-button"
          onclick={() => (showFilterSheet = true)}
        >
          <LabIcon name="filter" className="size-3" />
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>
      {/if}
    </div>

    <LabLedger
      movements={filtered}
      allMovements={combined}
      selectedId={selected?.id ?? null}
      onSelect={selectMovement}
    />
  </div>

  <LabInspector {selected} movements={combined} budgets={financeState.budgets} onEdit={openEdit} />
</div>

{#if showFilterSheet}
  <div class="lab-detail-overlay">
    <button
      type="button"
      class="lab-detail-backdrop"
      aria-label="Close filters"
      onclick={() => (showFilterSheet = false)}
    ></button>
    <div class="lab-detail-panel">
      <div class="lab-sheet-head">
        <span>Filters</span>
        <button type="button" onclick={() => (showFilterSheet = false)} aria-label="Close filters">
          ×
        </button>
      </div>
      <div class="lab-filter-sheet">
        <TransactionFilters
          {filterType}
          {filterMonth}
          {filterCategories}
          {filterPayments}
          {filterCounterparties}
          {months}
          allCategories={categories}
          allPaymentMethods={payments}
          allCounterparties={people}
          showOtherType
          updateParam={updateFilterParam}
          wide
        />
      </div>
      <button type="button" class="lab-secondary mt-3 w-full py-2 text-xs" onclick={clearFilters}>
        Clear all filters
      </button>
    </div>
  </div>
{/if}

{#if selected && detailOpen}
  <div class="lab-detail-overlay">
    <button
      type="button"
      class="lab-detail-backdrop"
      aria-label="Close entry details"
      onclick={() => (detailOpen = false)}
    ></button>
    <div class="lab-detail-panel">
      <div class="lab-sheet-head">
        <span>Entry details</span>
        <button type="button" onclick={() => (detailOpen = false)} aria-label="Close entry details">
          ×
        </button>
      </div>
      <LabEntryDetail movement={selected} allMovements={combined} onEdit={openEdit} />
    </div>
  </div>
{/if}

{#if showForm}
  <TransactionForm
    open
    editMovement={editingMovement}
    onOpenChange={(open) => {
      showForm = open
      if (!open) editingMovement = null
    }}
  />
{/if}
