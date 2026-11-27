<script lang="ts">
import { createWindowVirtualizer } from '@tanstack/svelte-virtual'
import CarIcon from 'phosphor-svelte/lib/CarIcon'
import DevicesIcon from 'phosphor-svelte/lib/DevicesIcon'
import FilmStripIcon from 'phosphor-svelte/lib/FilmStripIcon'
import ForkKnifeIcon from 'phosphor-svelte/lib/ForkKnifeIcon'
import HeartbeatIcon from 'phosphor-svelte/lib/HeartbeatIcon'
import HouseIcon from 'phosphor-svelte/lib/HouseIcon'
import TagIcon from 'phosphor-svelte/lib/TagIcon'
import { untrack } from 'svelte'
import { Badge } from '@/components/ui/badge'
import type { InstallmentInfo, Movement, OutstandingMovement } from '@/domain/ledger'
import { categoryOf, expenseAmount, monthRelation, movementMonth } from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import DebtStatusBadge from './DebtStatusBadge.svelte'
import { amountClass, amountOf, detailOf, kindLabelOf, paymentLabelOf } from './movement-display'
import PaymentBadge from './PaymentBadge.svelte'

interface Props {
  movements: Movement[]
  debtRowsById: Map<string, OutstandingMovement[]>
  installmentsById: Map<string, InstallmentInfo>
  selectedId: string | null
  hybrid: boolean
  emptyMessage: string
  onSelect: (movement: Movement) => void
}

let {
  movements,
  debtRowsById,
  installmentsById,
  selectedId,
  hybrid,
  emptyMessage,
  onSelect,
}: Props = $props()

interface Group {
  date: string
  items: Movement[]
  total: number
}

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
  if (movement.kind === 'income' || movement.kind === 'refund') return amountOf(movement)
  return 0
}

function sign(value: number): string {
  return value > 0 ? '+' : value < 0 ? '−' : ''
}

function totalClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return ''
}

const groups = $derived.by<Group[]>(() => {
  const map = new Map<string, Movement[]>()
  for (const movement of [...movements].sort((a, b) => b.date.localeCompare(a.date))) {
    const items = map.get(movement.date)
    if (items) items.push(movement)
    else map.set(movement.date, [movement])
  }

  return [...map.entries()].map(([date, items]) => ({
    date,
    items,
    total: items.reduce((sum, movement) => sum + signedAmount(movement), 0),
  }))
})

let listEl = $state<HTMLDivElement | null>(null)
let scrollMargin = $state(0)

const virtualizer = createWindowVirtualizer({
  count: 0,
  estimateSize: () => 120,
  overscan: 8,
})

function measureScrollMargin() {
  if (!listEl) return
  scrollMargin = listEl.getBoundingClientRect().top + window.scrollY
}

$effect(() => {
  const list = groups
  const margin = scrollMargin
  const mode = hybrid
  untrack(() => {
    $virtualizer.setOptions({
      count: list.length,
      scrollMargin: margin,
      estimateSize: (index) => {
        const group = list[index]
        const rows = group?.items.length ?? 1
        return mode ? 28 + rows * 46 : 39 + rows * 72
      },
      overscan: 8,
      getItemKey: (index) => list[index]?.date ?? index,
    })
    measureScrollMargin()
  })
})

$effect(() => {
  if (!listEl) return
  const measure = () => measureScrollMargin()
  measure()
  window.addEventListener('resize', measure)
  return () => window.removeEventListener('resize', measure)
})

const virtualRows = $derived(
  $virtualizer.getVirtualItems().filter((row) => row.index < groups.length),
)

function measureRow(node: Element) {
  $virtualizer.measureElement(node)
}

function groupKey(index: number): string | number {
  return groups[index]?.date ?? index
}
</script>

{#if groups.length === 0}
  <div class="panel px-4 py-14 text-center">
    <p class="text-sm font-medium">{emptyMessage}</p>
    <p class="mt-1 text-xs text-muted-foreground">Try a different filter or clear the search.</p>
  </div>
{:else if hybrid}
  <div class="panel surface-solid overflow-hidden">
    <div class="tx-hybrid-head tx-hybrid-grid">
      <span></span>
      <span>Entry</span>
      <span class="tx-hybrid-payment">Payment</span>
      <span class="tx-hybrid-category">Category</span>
      <span class="tx-hybrid-inst">Inst.</span>
      <span class="tx-hybrid-amount">Amount</span>
      <span></span>
    </div>

    <div bind:this={listEl} class="relative" style="height: {$virtualizer.getTotalSize()}px;">
      {#each virtualRows as virtualRow (groupKey(virtualRow.index))}
        {@const group = groups[virtualRow.index]}
        {#if group}
          <div
            data-index={virtualRow.index}
            {@attach measureRow}
            class="absolute top-0 left-0 w-full"
            style="transform: translateY({virtualRow.start - scrollMargin}px);"
          >
            <div class="tx-hybrid-date">
              <span>{dateLabel(group.date)}</span>
              {#if group.total !== 0}
                <span class="tx-date-total {totalClass(group.total)}">
                  {sign(group.total)}{formatCurrency(Math.abs(group.total))}
                </span>
              {/if}
            </div>

            {#each group.items as movement (movement.id)}
              {@const category = categoryOf(movement)}
              {@const installment = installmentsById.get(movement.id)}
              {@const debtRows = debtRowsById.get(movement.id) ?? []}
              {@const detail = detailOf(movement, debtRows)}
              {@const Icon = categoryIcon(category)}
              <button
                type="button"
                class={cn(
                  'tx-hybrid-row tx-hybrid-grid',
                  isFuture(movement) && 'opacity-50',
                  selectedId === movement.id && 'is-selected',
                )}
                aria-pressed={selectedId === movement.id}
                onclick={() => onSelect(movement)}
              >
                <span class="tx-hybrid-icon"><Icon class="size-4" /></span>
                <span class="tx-hybrid-main">
                  <span class="tx-hybrid-title">
                    <span class="truncate text-sm font-medium">{movement.description}</span>
                    {#if kindLabelOf(movement)}
                      <Badge variant="outline" class="shrink-0 text-[10px]">
                        {kindLabelOf(movement)}
                      </Badge>
                    {/if}
                    <DebtStatusBadge rows={debtRows} />
                  </span>
                  {#if detail}
                    <span class="tx-hybrid-detail">{detail}</span>
                  {/if}
                </span>
                <span class="tx-hybrid-payment"><PaymentBadge {movement} /></span>
                <span class="tx-hybrid-category">{category ?? '—'}</span>
                <span class="tx-hybrid-inst">
                  {installment ? `${installment.index + 1}/${installment.total}` : '—'}
                </span>
                <span class="tx-hybrid-amount {amountClass(movement)}">
                  {movement.kind === 'income' ? '+' : ''}{formatCurrency(displayAmount(movement))}
                </span>
                <span class="tx-hybrid-chevron">›</span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{:else}
  <div bind:this={listEl} class="relative" style="height: {$virtualizer.getTotalSize()}px;">
    {#each virtualRows as virtualRow (groupKey(virtualRow.index))}
      {@const group = groups[virtualRow.index]}
      {#if group}
        <div
          data-index={virtualRow.index}
          {@attach measureRow}
          class="absolute top-0 left-0 w-full tx-feed-group"
          style="transform: translateY({virtualRow.start - scrollMargin}px);"
        >
          <div class="tx-date-header">
            <span>{dateLabel(group.date)}</span>
            {#if group.total !== 0}
              <span class="tx-date-total {totalClass(group.total)}">
                {sign(group.total)}{formatCurrency(Math.abs(group.total))}
              </span>
            {/if}
          </div>

          <div class="panel surface-solid divide-y divide-border overflow-hidden">
            {#each group.items as movement (movement.id)}
              {@const category = categoryOf(movement)}
              {@const installment = installmentsById.get(movement.id)}
              {@const debtRows = debtRowsById.get(movement.id) ?? []}
              {@const detail = detailOf(movement, debtRows)}
              {@const Icon = categoryIcon(category)}
              <button
                type="button"
                class={cn(
                  'tx-feed-row',
                  isFuture(movement) && 'opacity-50',
                  selectedId === movement.id && 'is-selected',
                )}
                aria-pressed={selectedId === movement.id}
                onclick={() => onSelect(movement)}
              >
                <span class="tx-feed-icon"><Icon class="size-4" /></span>
                <span class="min-w-0 flex-1 text-left">
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-sm font-semibold">{movement.description}</span>
                    {#if kindLabelOf(movement)}
                      <Badge variant="outline" class="shrink-0 text-[10px]">
                        {kindLabelOf(movement)}
                      </Badge>
                    {/if}
                    <DebtStatusBadge rows={debtRows} />
                  </span>
                  <span
                    class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span>{paymentLabelOf(movement)}</span>
                    {#if category}
                      <span>·</span>
                      <span>{category}</span>
                    {/if}
                    {#if installment}
                      <span>·</span>
                      <span>{installment.index + 1}/{installment.total}</span>
                    {/if}
                  </span>
                  {#if detail}
                    <span class="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {detail}
                    </span>
                  {/if}
                </span>
                <span class="flex shrink-0 items-center gap-1.5">
                  <span class="font-mono text-sm font-semibold {amountClass(movement)}">
                    {movement.kind === 'income' ? '+' : ''}{formatCurrency(displayAmount(movement))}
                  </span>
                  <span class="text-muted-foreground/50">›</span>
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </div>
{/if}
