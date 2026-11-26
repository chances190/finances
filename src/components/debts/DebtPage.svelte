<script lang="ts">
import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon'
import PercentIcon from 'phosphor-svelte/lib/PercentIcon'
import UserIcon from 'phosphor-svelte/lib/UserIcon'
import UsersIcon from 'phosphor-svelte/lib/UsersIcon'
import { MediaQuery } from 'svelte/reactivity'
import EmptyState from '@/components/common/EmptyState.svelte'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  buildSettlement,
  counterpartyOf,
  localYMD,
  type Movement,
  type OutstandingMovement,
  outstandingMovements,
} from '@/domain/ledger'
import { addCurrency, formatCurrency } from '@/lib/currency'
import { navigate, router } from '@/lib/router.svelte'
import { finance } from '@/lib/stores/finance.svelte'
import { toast } from '@/lib/stores/toast.svelte'
import { toastUndo } from '@/lib/undo-toast'
import {
  aggregate,
  BADGE_GREEN,
  type DebtSort,
  groupByPurchase,
  groupStatus,
  type PersonData,
  type PurchaseGroup,
  type SettleTarget,
  SORT_LABELS,
  settlementHistory,
  sortPeople,
  type ViewMode,
} from './debt-helpers'
import SettleDebtDialog from './SettleDebtDialog.svelte'

interface SectionData {
  active: OutstandingMovement[]
  total: number
  groups: PurchaseGroup[]
  people: PersonData[]
}

const financeState = $derived(finance.state)
const isDesktop = new MediaQuery('(min-width: 640px)')

const searchParams = $derived(new URLSearchParams(router.search))
const viewMode = $derived<ViewMode>(searchParams.get('view') === 'person' ? 'person' : 'purchase')
const movementParam = $derived(searchParams.get('movement'))
const showSettled = $derived(searchParams.get('settled') === '1')
const sortParam = $derived(searchParams.get('sort'))
const sort = $derived<DebtSort>(sortParam === 'amount' || sortParam === 'name' ? sortParam : 'due')
const search = $derived(searchParams.get('search') ?? '')

let target = $state<SettleTarget | null>(null)

const movementsById = $derived(
  new Map(financeState.movements.map((movement) => [movement.id, movement])),
)
const movementFilter = $derived(
  movementParam && movementsById.has(movementParam) ? movementParam : null,
)

const debts = $derived({
  receivable: outstandingMovements(financeState.movements, 'receivable'),
  payable: outstandingMovements(financeState.movements, 'payable'),
})

const receivableRows = $derived(
  movementFilter
    ? debts.receivable.filter((row) => row.movementId === movementFilter)
    : debts.receivable,
)
const payableRows = $derived(
  movementFilter ? debts.payable.filter((row) => row.movementId === movementFilter) : debts.payable,
)
const filteredMovement = $derived(movementFilter ? movementsById.get(movementFilter) : undefined)

const needle = $derived(search.trim().toLowerCase())

function matchingPurchases(rows: OutstandingMovement[]): OutstandingMovement[] {
  if (!needle) return rows
  const matched = new Set(
    rows
      .filter(
        (row) =>
          row.description.toLowerCase().includes(needle) ||
          row.counterparty.toLowerCase().includes(needle),
      )
      .map((row) => row.movementId),
  )
  return rows.filter((row) => matched.has(row.movementId))
}

const visibleReceivable = $derived(matchingPurchases(receivableRows))
const visiblePayable = $derived(matchingPurchases(payableRows))

const hasAny = $derived(debts.receivable.length > 0 || debts.payable.length > 0)

function sectionOf(rows: OutstandingMovement[]): SectionData {
  const active = showSettled ? rows : rows.filter((row) => row.outstanding > 0.004)
  const groups = groupByPurchase(rows, sort)
    .map((group) => {
      const visible = showSettled ? group.rows : group.rows.filter((row) => row.outstanding > 0.004)
      return {
        ...group,
        rows: visible,
        outstanding: visible.reduce((sum, row) => addCurrency(sum, row.outstanding), 0),
      }
    })
    .filter((group) => group.rows.length > 0)
  return {
    active,
    total: active.reduce((sum, row) => addCurrency(sum, row.outstanding), 0),
    groups,
    people: sortPeople(aggregate(active), sort),
  }
}

const payableData = $derived(sectionOf(visiblePayable))
const receivableData = $derived(sectionOf(visibleReceivable))

function applyParams(next: URLSearchParams) {
  const query = next.toString()
  navigate(query ? `${router.path}?${query}` : router.path, { replace: true })
}

function updateParam(key: string, value: string | null) {
  const next = new URLSearchParams(router.search)
  if (!value) next.delete(key)
  else next.set(key, value)
  applyParams(next)
}

function handleView(item: { counterparty: string; movementId?: string }) {
  if (item.movementId) navigate(`/?movement=${encodeURIComponent(item.movementId)}`)
  else navigate(`/?person=${encodeURIComponent(item.counterparty)}`)
}

function recordSettlements(rows: OutstandingMovement[]) {
  if (rows.length === 0) return
  const movements: Movement[] = []
  let settled = 0
  for (const row of rows) {
    const result = buildSettlement(
      {
        id: crypto.randomUUID(),
        date: localYMD(),
        description: `Settled with ${row.counterparty}`,
        direction: row.direction,
        counterparty: row.counterparty,
        cash: row.outstanding,
        cleared: row.outstanding,
        account: 'checking',
        links: [row.movementId],
      },
      finance.state.movements,
    )
    if (!result.ok) {
      toast(result.reason, 'error')
      return
    }
    movements.push(result.value)
    settled = addCurrency(settled, row.outstanding)
  }

  const auditId = finance.dispatchUndoable({ type: 'ADD_MOVEMENTS', payload: movements })
  toastUndo(`${formatCurrency(settled)} settled`, auditId)
}

function revokeSettlement(row: OutstandingMovement) {
  const ids = finance.state.movements
    .filter(
      (movement) =>
        movement.kind === 'settlement' &&
        movement.links?.includes(row.movementId) &&
        counterpartyOf(movement) === row.counterparty,
    )
    .map((movement) => movement.id)
  if (ids.length === 0) return
  const auditId = finance.dispatchUndoable({ type: 'DELETE_MOVEMENTS', payload: ids })
  toastUndo('Settlement undone', auditId, 'info')
}

function targetFor(person: PersonData, rows: OutstandingMovement[]): SettleTarget {
  return {
    rows: rows.filter((row) => row.counterparty === person.counterparty && row.outstanding > 0.004),
  }
}
</script>

{#snippet purchaseIcon()}
  <UserIcon class="size-3" />
{/snippet}

{#snippet personIcon()}
  <UsersIcon class="size-3" />
{/snippet}

{#snippet personStatus(person: PersonData)}
  {#if person.allSettled}
    <Badge variant="outline" class={BADGE_GREEN}>Paid</Badge>
  {:else if showSettled && person.anySettled}
    <span title="Partially paid">
      <PercentIcon
        class="size-3.5 text-amber-600 dark:text-amber-400"
        aria-label="Partially paid"
      />
    </span>
  {/if}
{/snippet}

{#snippet debtorControls(row: OutstandingMovement, size: string)}
  {#if row.outstanding <= 0.004}
    <Button
      variant="ghost"
      size="icon"
      class="{size} shrink-0"
      title={`Undo settlement for ${row.counterparty}`}
      aria-label={`Undo settlement for ${row.counterparty}`}
      onclick={() => revokeSettlement(row)}
    >
      <CheckCircleIcon class="size-4 text-green-600 dark:text-green-400" />
    </Button>
  {:else}
    <Button
      variant="ghost"
      size="icon"
      class="{size} shrink-0"
      title={`Settle a different amount with ${row.counterparty}`}
      aria-label={`Settle a different amount with ${row.counterparty}`}
      onclick={() => {
        target = { rows: [row] }
      }}
    >
      <PercentIcon class="size-4" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class="{size} shrink-0"
      title={`Settle ${formatCurrency(row.outstanding)} from ${row.counterparty}`}
      aria-label={`Settle ${formatCurrency(row.outstanding)} from ${row.counterparty}`}
      onclick={() => recordSettlements([row])}
    >
      <CheckCircleIcon class="size-4" />
    </Button>
  {/if}
{/snippet}

{#snippet debtorInfo(row: OutstandingMovement, open: boolean)}
  <p class="text-xs leading-tight text-muted-foreground {open ? '' : 'line-through'}">
    <span class="font-medium text-foreground">{row.counterparty}</span>:
    <span class="font-mono">{formatCurrency(open ? row.outstanding : row.total)}</span>
  </p>
  {#if settlementHistory(row)}
    <p class="text-[10px] leading-tight text-muted-foreground">{settlementHistory(row)}</p>
  {/if}
{/snippet}

{#snippet debtorLine(row: OutstandingMovement)}
  <div class="flex min-w-0 items-center gap-2">
    <div class="min-w-0 flex-1">
      <p
        class="truncate text-xs leading-tight text-muted-foreground {row.outstanding > 0.004
          ? ''
          : 'line-through'}"
      >
        <span class="font-medium text-foreground">{row.counterparty}</span>
      </p>
      {#if settlementHistory(row)}
        <p class="truncate text-[10px] leading-tight text-muted-foreground">
          {settlementHistory(row)}
        </p>
      {/if}
    </div>
    <span class="shrink-0 font-mono text-xs">
      {formatCurrency(row.outstanding > 0.004 ? row.outstanding : row.total)}
    </span>
    {@render debtorControls(row, 'size-9')}
  </div>
{/snippet}

{#snippet purchaseCards(groups: PurchaseGroup[])}
  <div class="list-panel">
    {#each groups as group (group.movementId)}
      {@const openRows = group.rows.filter((row) => row.outstanding > 0.004)}
      {@const allSettled = openRows.length === 0}
      {@const status = groupStatus(group, allSettled)}
      <div class="px-3 py-2 {allSettled ? 'opacity-60' : ''}">
        <div class="flex items-start gap-2">
          <button
            type="button"
            class="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            onclick={() =>
              handleView({
                counterparty: group.rows[0].counterparty,
                movementId: group.movementId,
              })}
          >
            <span class="flex items-start gap-2">
              <span class="min-w-0 flex-1 break-words text-sm font-medium">
                {group.description}
              </span>
              <Badge variant="outline" class="shrink-0 {status.color}">{status.label}</Badge>
            </span>
            {#if group.rows.length > 1}
              <span class="mt-1 block text-xs text-muted-foreground">
                {formatCurrency(group.outstanding)} still owed
              </span>
            {/if}
          </button>
          {#if group.rows.length > 1 && openRows.length > 1}
            <Button
              variant="ghost"
              size="icon"
              class="size-10 shrink-0"
              title="Settle all"
              aria-label="Settle all"
              onclick={() => recordSettlements(openRows)}
            >
              <CheckCircleIcon class="size-5" />
            </Button>
          {/if}
        </div>

        <div class="mt-2 space-y-0.5 border-t border-border/60 pt-2">
          {#each group.rows as row (row.counterparty)}
            {@render debtorLine(row)}
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet purchaseTable(groups: PurchaseGroup[])}
  <div class="panel overflow-hidden">
    <Table class="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead class="w-36">Due</TableHead>
          <TableHead class="w-28 text-right">Amount</TableHead>
          <TableHead>Purchase</TableHead>
          <TableHead>Split</TableHead>
          <TableHead class="w-20 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each groups as group (group.movementId)}
          {@const allSettled = group.rows.every((row) => row.outstanding <= 0.004)}
          {@const status = groupStatus(group, allSettled)}
          {#each group.rows as row, index (row.counterparty)}
            <TableRow class={allSettled ? 'opacity-60' : undefined}>
              {#if index === 0}
                <TableCell rowspan={group.rows.length} class="align-top">
                  <Badge variant="outline" class={status.color}>{status.label}</Badge>
                </TableCell>
                <TableCell rowspan={group.rows.length} class="text-right align-top font-mono">
                  {formatCurrency(group.outstanding)}
                </TableCell>
                <TableCell rowspan={group.rows.length} class="align-top">
                  <button
                    type="button"
                    class="min-w-0 text-left font-medium hover:underline"
                    onclick={() =>
                      handleView({
                        counterparty: group.rows[0].counterparty,
                        movementId: group.movementId,
                      })}
                  >
                    {group.description}
                  </button>
                </TableCell>
              {/if}
              <TableCell class="align-top">
                {@render debtorInfo(row, row.outstanding > 0.004)}
              </TableCell>
              <TableCell class="text-right align-top">
                <div class="flex justify-end">
                  {@render debtorControls(row, 'size-7')}
                </div>
              </TableCell>
            </TableRow>
          {/each}
        {/each}
      </TableBody>
    </Table>
  </div>
{/snippet}

{#snippet personList(
  people: PersonData[],
  rows: OutstandingMovement[],
  relation: 'receivable' | 'payable',
)}
  {#if !isDesktop.current}
    <div class="list-panel">
      {#each people as person (person.counterparty)}
        <div class="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            class="min-w-0 flex-1 text-left"
            onclick={() => handleView({ counterparty: person.counterparty })}
          >
            <span class="block truncate text-sm font-medium">{person.counterparty}</span>
            <span
              class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground"
            >
              {@render personStatus(person)}
              <span>{person.count} purchase{person.count !== 1 ? 's' : ''}</span>
            </span>
          </button>
          <span class="shrink-0 font-mono text-sm">
            {formatCurrency(person.allSettled ? person.total : person.outstanding)}
          </span>
          {#if person.outstanding > 0.004}
            <Button
              variant="ghost"
              size="icon"
              class="size-10 shrink-0"
              title={`Settle a different amount with ${person.counterparty}`}
              aria-label={`Settle a different amount with ${person.counterparty}`}
              onclick={() => {
                target = targetFor(person, rows)
              }}
            >
              <PercentIcon class="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-10 shrink-0"
              title={`Settle ${formatCurrency(person.outstanding)} with ${person.counterparty}`}
              aria-label={`Settle ${formatCurrency(person.outstanding)} with ${person.counterparty}`}
              onclick={() => recordSettlements(targetFor(person, rows).rows)}
            >
              <CheckCircleIcon class="size-5" />
            </Button>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="panel overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead class="text-right">
              {relation === 'receivable' ? 'Owed to you' : 'You owe'}
            </TableHead>
            <TableHead class="text-right">Purchases</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each people as person (person.counterparty)}
            <TableRow
              class="cursor-pointer hover:bg-muted/50"
              tabindex={0}
              onclick={() => handleView({ counterparty: person.counterparty })}
              onkeydown={(event) => {
                if (
                  event.target !== event.currentTarget ||
                  (event.key !== 'Enter' && event.key !== ' ')
                ) {
                  return
                }
                event.preventDefault()
                handleView({ counterparty: person.counterparty })
              }}
            >
              <TableCell class="font-medium">
                <span class="flex items-center gap-1">
                  <UserIcon class="size-3" />
                  {person.counterparty}
                  {@render personStatus(person)}
                </span>
              </TableCell>
              <TableCell class="text-right font-mono">
                {formatCurrency(person.outstanding)}
              </TableCell>
              <TableCell class="text-right text-xs text-muted-foreground">
                {person.count}
              </TableCell>
              <TableCell
                class="text-right"
                onclick={(event) => {
                  event.stopPropagation()
                }}
              >
                {#if person.outstanding > 0.004}
                  <div class="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      title={`Settle a different amount with ${person.counterparty}`}
                      aria-label={`Settle a different amount with ${person.counterparty}`}
                      onclick={() => {
                        target = targetFor(person, rows)
                      }}
                    >
                      <PercentIcon class="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      title={`Settle ${formatCurrency(person.outstanding)} with ${person.counterparty}`}
                      aria-label={`Settle ${formatCurrency(person.outstanding)} with ${person.counterparty}`}
                      onclick={() => recordSettlements(targetFor(person, rows).rows)}
                    >
                      <CheckCircleIcon class="size-4" />
                    </Button>
                  </div>
                {/if}
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </div>
  {/if}
{/snippet}

{#snippet relationSection(props: {
  title: string
  description: string
  relation: 'receivable' | 'payable'
  data: SectionData
})}
  <section class="space-y-2">
    <div class="flex items-end justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold text-foreground">{props.title}</h3>
        <p class="text-xs text-muted-foreground">{props.description}</p>
      </div>
      {#if props.data.total > 0.004}
        <p class="text-right">
          <span class="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Outstanding
          </span>
          <span class="font-mono text-sm font-semibold">{formatCurrency(props.data.total)}</span>
        </p>
      {/if}
    </div>

    {#if props.data.active.length === 0}
      <p class="text-xs text-muted-foreground">
        {#if needle}
          No matching debts.
        {:else if props.relation === 'receivable'}
          Nobody owes you right now.
        {:else}
          You do not owe anyone right now.
        {/if}
      </p>
    {:else if viewMode === 'person'}
      {@render personList(props.data.people, props.data.active, props.relation)}
    {:else if isDesktop.current}
      {@render purchaseTable(props.data.groups)}
    {:else}
      {@render purchaseCards(props.data.groups)}
    {/if}
  </section>
{/snippet}

<div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-lg font-semibold text-foreground">Debts</h2>
    <SegmentedControl
      aria-label="Debt view"
      value={viewMode}
      onValueChange={(value) => updateParam('view', value === 'person' ? 'person' : null)}
      options={[
        { value: 'purchase', label: 'By purchase', icon: purchaseIcon },
        { value: 'person', label: 'By person', icon: personIcon },
      ]}
    />
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <Input
      value={search}
      oninput={(event) => updateParam('search', event.currentTarget.value || null)}
      placeholder="Search debts..."
      aria-label="Search debts"
      class="h-10 min-w-0 flex-1 text-xs sm:h-7 sm:w-44 sm:flex-none"
    />
    <Select
      type="single"
      value={sort}
      onValueChange={(value) => updateParam('sort', value === 'due' ? null : value)}
    >
      <SelectTrigger class="h-10 w-24 text-xs sm:h-7" aria-label="Sort debts">
        {SORT_LABELS[sort]}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="due">Due</SelectItem>
        <SelectItem value="amount">Amount</SelectItem>
        <SelectItem value="name">Name</SelectItem>
      </SelectContent>
    </Select>
    <label
      for="show-settled"
      class="flex min-h-10 shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:min-h-7"
    >
      <Checkbox
        id="show-settled"
        checked={showSettled}
        onCheckedChange={(checked) => updateParam('settled', checked === true ? '1' : null)}
      />
      <span>Show settled</span>
    </label>
  </div>

  {#if filteredMovement}
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <span class="min-w-0 truncate">Showing “{filteredMovement.description}”</span>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 shrink-0 text-xs"
        onclick={() => updateParam('movement', null)}
      >
        Show all
      </Button>
    </div>
  {/if}

  {#if !hasAny}
    <EmptyState
      message="No debts yet. Split a purchase or pay with “Someone else” to start one."
      action={{ label: 'Go to Transactions', onClick: () => navigate('/') }}
    />
  {:else}
    <div class={viewMode === 'person' ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
      {@render relationSection({
        title: 'You owe',
        description: 'Purchases someone else covered for you.',
        relation: 'payable',
        data: payableData,
      })}
      {@render relationSection({
        title: 'Owed to you',
        description: 'Purchases you covered for someone else.',
        relation: 'receivable',
        data: receivableData,
      })}
    </div>
  {/if}
</div>

{#if target}
  <SettleDebtDialog
    {target}
    onOpenChange={(open) => {
      if (!open) target = null
    }}
  />
{/if}
