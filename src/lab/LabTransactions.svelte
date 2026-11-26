<script lang="ts">
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
import LabIcon from './LabIcon.svelte'
import LabLedger from './LabLedger.svelte'

interface Props {
  iconPack: 'phosphor' | 'tabler' | 'hugeicons'
  ledgerVariant: 'feed' | 'hybrid' | 'table'
}

let { iconPack, ledgerVariant }: Props = $props()

type Chip = 'all' | 'spending' | 'income' | 'credit' | 'debts'

const financeState = $derived(finance.state)
const allMovements = $derived([...financeState.movements])
const categories = $derived(allCategoryNames(financeState.budgets, financeState.movements))

let localMovements = $state<Movement[]>([])
let raw = $state('')
let search = $state('')
let chip = $state<Chip>('all')
let month = $state('all')
let category = $state('all')
let payment = $state('all')
let person = $state('all')
let showFilters = $state(false)

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

const debtIds = $derived.by(() => {
  const ids = new Set<string>()
  for (const movement of combined) {
    if (movement.postings.some((posting) => posting.counterparty)) ids.add(movement.id)
  }
  return ids
})

const filtered = $derived.by(() => {
  let rows = combined
  if (chip === 'spending') rows = rows.filter((m) => m.kind === 'purchase' || m.kind === 'refund')
  if (chip === 'income') rows = rows.filter((m) => m.kind === 'income')
  if (chip === 'credit') rows = rows.filter((m) => paymentMethodOf(m) === 'Credit')
  if (chip === 'debts') rows = rows.filter((m) => debtIds.has(m.id))
  if (month !== 'all') rows = rows.filter((m) => m.date.startsWith(month))
  if (category !== 'all') {
    rows = rows.filter((m) => m.postings.some((posting) => posting.category === category))
  }
  if (payment !== 'all') rows = rows.filter((m) => paymentMethodOf(m) === payment)
  if (person !== 'all') {
    rows = rows.filter((m) => m.postings.some((posting) => posting.counterparty === person))
  }
  if (search.trim()) {
    const needle = search.trim().toLowerCase()
    rows = rows.filter((m) => m.description.toLowerCase().includes(needle))
  }
  return rows
})

const activeFilters = $derived(
  (month !== 'all' ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (payment !== 'all' ? 1 : 0) +
    (person !== 'all' ? 1 : 0),
)

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

function resetFilters() {
  chip = 'all'
  month = 'all'
  category = 'all'
  payment = 'all'
  person = 'all'
  search = ''
}
</script>

<div class="space-y-4">
  <div class="panel lab-quick-add p-3">
    <div class="flex items-center gap-2.5">
      <span class="lab-quick-add-icon">
        <LabIcon pack={iconPack} name="plus" className="size-4" />
      </span>
      <form
        class="flex min-w-0 flex-1 items-center gap-2"
        onsubmit={(event) => {
          event.preventDefault()
          addFromCommand()
        }}
      >
        <input
          bind:value={raw}
          class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="iFood 34,90 #Food @Debit hoje"
          aria-label="Quick add"
        >
        <button type="submit" class="lab-primary px-3 py-1.5 text-xs font-semibold">Add</button>
      </form>
    </div>
    {#if raw.trim()}
      <div class="lab-command-preview">
        <span class="text-muted-foreground">Parsed</span>
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

  <div class="space-y-2.5">
    <div class="lab-search">
      <LabIcon pack={iconPack} name="search" className="size-4 text-muted-foreground" />
      <input bind:value={search} placeholder="Search description..." aria-label="Search lab ledger">
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      {#each [
        ['all', 'All'],
        ['spending', 'Spending'],
        ['income', 'Income'],
        ['credit', 'Credit'],
        ['debts', 'With debts'],
      ] as [value, label] (value)}
        <button
          type="button"
          class="lab-chip {chip === value ? 'is-active' : ''}"
          onclick={() => {
            chip = value as Chip
          }}
        >
          {label}
        </button>
      {/each}
      <button
        type="button"
        class="lab-chip ml-auto shrink-0 {activeFilters > 0 ? 'is-active' : ''}"
        onclick={() => {
          showFilters = !showFilters
        }}
      >
        <LabIcon pack={iconPack} name="filter" className="size-3" />
        Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
      </button>
    </div>

    {#if showFilters}
      <div class="panel lab-filter-grid p-3">
        <label class="lab-field">
          <span>Month</span>
          <select bind:value={month}>
            <option value="all">All months</option>
            {#each months as value (value)}
              <option {value}>{value}</option>
            {/each}
          </select>
        </label>
        <label class="lab-field">
          <span>Category</span>
          <select bind:value={category}>
            <option value="all">All categories</option>
            {#each categories as value (value)}
              <option {value}>{value}</option>
            {/each}
          </select>
        </label>
        <label class="lab-field">
          <span>Payment</span>
          <select bind:value={payment}>
            <option value="all">All methods</option>
            {#each payments as value (value)}
              <option {value}>{value}</option>
            {/each}
          </select>
        </label>
        <label class="lab-field">
          <span>Person</span>
          <select bind:value={person}>
            <option value="all">Everyone</option>
            {#each people as value (value)}
              <option {value}>{value}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="lab-chip lab-filter-clear" onclick={resetFilters}>
          Clear all filters
        </button>
      </div>
    {/if}
  </div>

  <LabLedger movements={filtered} allMovements={combined} variant={ledgerVariant} />
</div>
