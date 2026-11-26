<script lang="ts">
import CarIcon from 'phosphor-svelte/lib/CarIcon'
import DevicesIcon from 'phosphor-svelte/lib/DevicesIcon'
import FilmStripIcon from 'phosphor-svelte/lib/FilmStripIcon'
import ForkKnifeIcon from 'phosphor-svelte/lib/ForkKnifeIcon'
import HeartbeatIcon from 'phosphor-svelte/lib/HeartbeatIcon'
import HouseIcon from 'phosphor-svelte/lib/HouseIcon'
import TagIcon from 'phosphor-svelte/lib/TagIcon'
import { MediaQuery } from 'svelte/reactivity'
import DebtStatusBadge from '@/components/transactions/DebtStatusBadge.svelte'
import {
  amountClass,
  amountOf,
  detailOf,
  kindLabelOf,
  paymentLabelOf,
} from '@/components/transactions/movement-display'
import PaymentBadge from '@/components/transactions/PaymentBadge.svelte'
import { Badge } from '@/components/ui/badge'
import {
  categoryOf,
  expenseAmount,
  installmentInfo,
  type Movement,
  monthRelation,
  movementMonth,
  type OutstandingMovement,
  outstandingMovements,
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'

interface Props {
  movements: Movement[]
  allMovements: Movement[]
  selectedId: string | null
  onSelect: (movement: Movement) => void
}

let { movements, allMovements, selectedId, onSelect }: Props = $props()

const wide = new MediaQuery('(min-width: 900px)')
const effectiveVariant = $derived(wide.current ? 'hybrid' : 'feed')

const debtRowsById = $derived.by(() => {
  const map = new Map<string, OutstandingMovement[]>()
  for (const direction of ['receivable', 'payable'] as const) {
    for (const row of outstandingMovements(allMovements, direction)) {
      const rows = map.get(row.movementId)
      if (rows) rows.push(row)
      else map.set(row.movementId, [row])
    }
  }
  return map
})

const installmentsById = $derived.by(() => {
  const map = new Map<string, ReturnType<typeof installmentInfo>>()
  for (const movement of allMovements) map.set(movement.id, installmentInfo(movement, allMovements))
  return map
})

const groups = $derived.by(() => {
  const map = new Map<string, Movement[]>()
  for (const movement of [...movements].sort((a, b) => b.date.localeCompare(a.date))) {
    const rows = map.get(movement.date)
    if (rows) rows.push(movement)
    else map.set(movement.date, [movement])
  }
  return [...map.entries()].map(([date, items]) => ({
    date,
    items,
    total: items.reduce((sum, movement) => sum + signedAmount(movement), 0),
  }))
})

const categoryIcons: Record<string, typeof TagIcon> = {
  Food: ForkKnifeIcon,
  Fun: FilmStripIcon,
  Transport: CarIcon,
  Tech: DevicesIcon,
  Home: HouseIcon,
  Health: HeartbeatIcon,
}

function categoryIcon(category: string | undefined) {
  return (category && categoryIcons[category]) || TagIcon
}

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function isFuture(movement: Movement): boolean {
  return monthRelation(movementMonth(movement)) === 'future'
}

function displayAmount(movement: Movement): number {
  return movement.kind === 'purchase' ? expenseAmount(movement) : amountOf(movement)
}

function signedAmount(movement: Movement): number {
  if (movement.kind === 'purchase') return -expenseAmount(movement)
  if (movement.kind === 'income' || movement.kind === 'refund') return displayAmount(movement)
  return 0
}

function sign(value: number): string {
  return value > 0 ? '+' : value < 0 ? '−' : ''
}

function totalClass(value: number): string {
  return value > 0 ? 'text-green-600 dark:text-green-400' : ''
}
</script>

{#if movements.length === 0}
  <div class="panel px-4 py-14 text-center">
    <p class="text-sm font-medium">No transactions match</p>
    <p class="mt-1 text-xs text-muted-foreground">Try a different filter or clear the search.</p>
  </div>
{:else if effectiveVariant === 'feed'}
  <div class="lab-feed-groups">
    {#each groups as group (group.date)}
      <div class="lab-date-header">
        <span>{dateLabel(group.date)}</span>
        {#if group.total !== 0}
          <span class="lab-date-total {totalClass(group.total)}">
            {sign(group.total)}{formatCurrency(Math.abs(group.total))}
          </span>
        {/if}
      </div>
      <div class="panel lab-ledger lab-feed divide-y divide-border overflow-hidden">
        {#each group.items as movement (movement.id)}
          {@const installment = installmentsById.get(movement.id)}
          {@const category = categoryOf(movement)}
          {@const Icon = categoryIcon(category)}
          <button
            type="button"
            class="lab-feed-row {isFuture(movement) ? 'opacity-50' : ''} {selectedId === movement.id
              ? 'is-selected'
              : ''}"
            aria-pressed={selectedId === movement.id}
            onclick={() => onSelect(movement)}
          >
            <div class="lab-feed-icon">
              <Icon class="size-4" />
            </div>
            <div class="min-w-0 flex-1 text-left">
              <div class="flex min-w-0 items-center gap-1.5">
                <span class="truncate text-sm font-semibold">{movement.description}</span>
                {#if kindLabelOf(movement)}
                  <Badge variant="outline" class="shrink-0 text-[10px]"
                    >{kindLabelOf(movement)}</Badge
                  >
                {/if}
                <DebtStatusBadge rows={debtRowsById.get(movement.id) ?? []} />
              </div>
              <div class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span>{paymentLabelOf(movement)}</span>
                {#if category}
                  <span>·</span>
                  <span>{category}</span>
                {/if}
                {#if installment}
                  <span>·</span>
                  <span>{installment.index + 1}/{installment.total}</span>
                {/if}
              </div>
              {#if detailOf(movement, debtRowsById.get(movement.id) ?? [])}
                <p class="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {detailOf(movement, debtRowsById.get(movement.id) ?? [])}
                </p>
              {/if}
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <span class="font-mono text-sm font-semibold {amountClass(movement)}">
                {movement.kind === 'income' ? '+' : ''}{formatCurrency(displayAmount(movement))}
              </span>
              <span class="text-muted-foreground/50">›</span>
            </div>
          </button>
        {/each}
      </div>
    {/each}
  </div>
{:else}
  <div class="panel lab-ledger lab-hybrid overflow-hidden">
    <div class="lab-hybrid-head lab-hybrid-grid">
      <span></span>
      <span>Entry</span>
      <span class="lab-hybrid-payment">Payment</span>
      <span class="lab-hybrid-category">Category</span>
      <span class="lab-hybrid-inst">Inst.</span>
      <span class="lab-hybrid-amount">Amount</span>
      <span></span>
    </div>
    {#each groups as group (group.date)}
      <div class="lab-hybrid-date">
        <span>{dateLabel(group.date)}</span>
        {#if group.total !== 0}
          <span class="lab-date-total {totalClass(group.total)}">
            {sign(group.total)}{formatCurrency(Math.abs(group.total))}
          </span>
        {/if}
      </div>
      {#each group.items as movement (movement.id)}
        {@const installment = installmentsById.get(movement.id)}
        {@const category = categoryOf(movement)}
        {@const Icon = categoryIcon(category)}
        <button
          type="button"
          class="lab-hybrid-row lab-hybrid-grid {isFuture(movement)
            ? 'opacity-50'
            : ''} {selectedId === movement.id ? 'is-selected' : ''}"
          aria-pressed={selectedId === movement.id}
          onclick={() => onSelect(movement)}
        >
          <span class="lab-hybrid-icon"><Icon class="size-4" /></span>
          <span class="lab-hybrid-main">
            <span class="lab-hybrid-title">
              <span class="truncate text-sm font-medium">{movement.description}</span>
              {#if kindLabelOf(movement)}
                <Badge variant="outline" class="shrink-0 text-[10px]"
                  >{kindLabelOf(movement)}</Badge
                >
              {/if}
              <DebtStatusBadge rows={debtRowsById.get(movement.id) ?? []} />
            </span>
            {#if detailOf(movement, debtRowsById.get(movement.id) ?? [])}
              <span class="lab-hybrid-detail">
                {detailOf(movement, debtRowsById.get(movement.id) ?? [])}
              </span>
            {/if}
          </span>
          <span class="lab-hybrid-payment"><PaymentBadge {movement} /></span>
          <span class="lab-hybrid-category">{category ?? '—'}</span>
          <span class="lab-hybrid-inst">
            {installment ? `${installment.index + 1}/${installment.total}` : '—'}
          </span>
          <span class="lab-hybrid-amount {amountClass(movement)}">
            {movement.kind === 'income' ? '+' : ''}{formatCurrency(displayAmount(movement))}
          </span>
          <span class="lab-hybrid-chevron">›</span>
        </button>
      {/each}
    {/each}
  </div>
{/if}
