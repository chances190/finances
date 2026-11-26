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
import { Button } from '@/components/ui/button'
import type { InstallmentInfo, Movement, OutstandingMovement } from '@/domain/ledger'
import { categoryOf, monthRelation, movementMonth } from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import DebtStatusBadge from './DebtStatusBadge.svelte'
import MovementActions from './MovementActions.svelte'
import { amountClass, amountOf, detailOf, kindLabelOf, paymentLabelOf } from './movement-display'
import PaymentBadge from './PaymentBadge.svelte'

interface Props {
  movements: Movement[]
  debtRowsById: Map<string, OutstandingMovement[]>
  installmentsById: Map<string, InstallmentInfo>
  selectedId: string | null
  hybrid: boolean
  emptyMessage: string
  onClear: (() => void) | null
  onSelect: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
}

let {
  movements,
  debtRowsById,
  installmentsById,
  selectedId,
  hybrid,
  emptyMessage,
  onClear,
  onSelect,
  onRefund,
  onDelete,
}: Props = $props()

type LedgerRow =
  | { kind: 'date'; date: string; total: number }
  | { kind: 'movement'; movement: Movement }

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

function signedAmount(movement: Movement): number {
  if (movement.kind === 'purchase') return -amountOf(movement)
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

const rows = $derived.by<LedgerRow[]>(() => {
  const groups = new Map<string, Movement[]>()
  for (const movement of [...movements].sort((a, b) => b.date.localeCompare(a.date))) {
    const items = groups.get(movement.date)
    if (items) items.push(movement)
    else groups.set(movement.date, [movement])
  }

  return [...groups.entries()].flatMap(([date, items]) => [
    {
      kind: 'date' as const,
      date,
      total: items.reduce((sum, movement) => sum + signedAmount(movement), 0),
    },
    ...items.map((movement) => ({ kind: 'movement' as const, movement })),
  ])
})

let listEl = $state<HTMLDivElement | null>(null)
let scrollMargin = $state(0)

const virtualizer = createWindowVirtualizer({
  count: 0,
  estimateSize: () => 52,
  overscan: 10,
})

function measureScrollMargin() {
  if (!listEl) return
  scrollMargin = listEl.getBoundingClientRect().top + window.scrollY
}

$effect(() => {
  const list = rows
  const margin = scrollMargin
  const rowHeight = hybrid ? 52 : 112
  untrack(() => {
    $virtualizer.setOptions({
      count: list.length,
      scrollMargin: margin,
      estimateSize: () => rowHeight,
      overscan: 10,
      getItemKey: (index) => {
        const row = list[index]
        if (!row) return index
        return row.kind === 'date' ? `date-${row.date}` : row.movement.id
      },
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
  $virtualizer.getVirtualItems().filter((row) => row.index < rows.length),
)

function measureRow(node: Element) {
  $virtualizer.measureElement(node)
}

function rowKey(index: number): string | number {
  const row = rows[index]
  if (!row) return index
  return row.kind === 'date' ? `date-${row.date}` : row.movement.id
}
</script>

<div class="list-panel surface-solid">
  {#if hybrid}
    <div
      class="grid grid-cols-[28px_minmax(0,1fr)_96px_40px] items-center gap-2.5 border-b border-border bg-muted/50 px-3 py-1.5 text-[9px] font-bold tracking-[0.08em] text-muted-foreground uppercase min-[1050px]:grid-cols-[28px_minmax(0,1fr)_92px_84px_48px_104px_40px]"
    >
      <span></span>
      <span>Entry</span>
      <span class="hidden min-[1050px]:block">Payment</span>
      <span class="hidden min-[1050px]:block">Category</span>
      <span class="hidden min-[1050px]:block">Inst.</span>
      <span class="text-right">Amount</span>
      <span></span>
    </div>
  {/if}

  {#if rows.length === 0}
    <div class="px-4 py-14 text-center">
      <p class="text-sm font-medium">{emptyMessage}</p>
      <p class="mt-1 text-xs text-muted-foreground">Try a different filter or clear the search.</p>
      {#if onClear}
        <Button variant="outline" size="sm" class="mt-3 h-10" onclick={onClear}>
          Clear filters
        </Button>
      {/if}
    </div>
  {:else}
    <div bind:this={listEl} class="relative" style="height: {$virtualizer.getTotalSize()}px;">
      {#each virtualRows as virtualRow (rowKey(virtualRow.index))}
        {@const row = rows[virtualRow.index]}
        {#if row}
          <div
            data-index={virtualRow.index}
            {@attach measureRow}
            class="absolute top-0 left-0 w-full"
            style="transform: translateY({virtualRow.start - scrollMargin}px);"
          >
            {#if row.kind === 'date'}
              <div
                class="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5"
              >
                <span
                  class="text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase"
                >
                  {dateLabel(row.date)}
                </span>
                {#if row.total !== 0}
                  <span class="font-mono text-[11px] font-semibold {totalClass(row.total)}">
                    {sign(row.total)}{formatCurrency(Math.abs(row.total))}
                  </span>
                {/if}
              </div>
            {:else}
              {@const movement = row.movement}
              {@const category = categoryOf(movement)}
              {@const installment = installmentsById.get(movement.id)}
              {@const debtRows = debtRowsById.get(movement.id) ?? []}
              {@const detail = detailOf(movement, debtRows)}
              {@const Icon = categoryIcon(category)}
              <div
                class={cn(
                  'ledger-row relative border-b border-border',
                  isFuture(movement) && 'opacity-50',
                  selectedId === movement.id && 'is-selected',
                )}
              >
                <button
                  type="button"
                  class="absolute inset-0 z-0 w-full cursor-pointer outline-none"
                  aria-label={`Open ${movement.description}`}
                  onclick={() => onSelect(movement)}
                ></button>

                {#if hybrid}
                  <div
                    class="pointer-events-none relative z-0 grid grid-cols-[28px_minmax(0,1fr)_96px_40px] items-center gap-2.5 px-3 py-2 min-[1050px]:grid-cols-[28px_minmax(0,1fr)_92px_84px_48px_104px_40px]"
                  >
                    <span
                      class="grid size-7 place-items-center rounded-full bg-muted text-muted-foreground"
                    >
                      <Icon class="size-3.5" />
                    </span>
                    <span class="flex min-w-0 flex-col gap-0.5">
                      <span class="flex min-w-0 items-center gap-1.5">
                        <span class="truncate text-sm font-medium">{movement.description}</span>
                        {#if kindLabelOf(movement)}
                          <Badge variant="outline" class="shrink-0 text-[10px]">
                            {kindLabelOf(movement)}
                          </Badge>
                        {/if}
                        <DebtStatusBadge rows={debtRows} />
                      </span>
                      {#if detail}
                        <span class="truncate text-[10px] text-muted-foreground">{detail}</span>
                      {/if}
                    </span>
                    <span class="hidden min-[1050px]:block"><PaymentBadge {movement} /></span>
                    <span class="hidden truncate text-xs text-muted-foreground min-[1050px]:block">
                      {category ?? '—'}
                    </span>
                    <span class="hidden text-xs text-muted-foreground min-[1050px]:block">
                      {installment ? `${installment.index + 1}/${installment.total}` : '—'}
                    </span>
                    <span
                      class="text-right font-mono text-xs font-semibold {amountClass(movement)}"
                    >
                      {movement.kind === 'income' || movement.kind === 'refund'
                        ? '+'
                        : ''}{formatCurrency(amountOf(movement))}
                    </span>
                    <span class="pointer-events-auto relative z-10 flex justify-end">
                      <MovementActions
                        {movement}
                        label={`Actions for ${movement.description}`}
                        {onRefund}
                        {onDelete}
                      />
                    </span>
                  </div>
                {:else}
                  <div
                    class="pointer-events-none relative z-0 flex items-start gap-2.5 px-3 py-2.5"
                  >
                    <span
                      class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                    >
                      <Icon class="size-3.5" />
                    </span>
                    <span class="min-w-0 flex-1">
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
                        class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground"
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
                        <span class="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                          {detail}
                        </span>
                      {/if}
                    </span>
                    <span class="flex shrink-0 flex-col items-end gap-1">
                      <span class="font-mono text-sm font-semibold {amountClass(movement)}">
                        {movement.kind === 'income' || movement.kind === 'refund'
                          ? '+'
                          : ''}{formatCurrency(amountOf(movement))}
                      </span>
                      <span class="pointer-events-auto relative z-10">
                        <MovementActions
                          {movement}
                          label={`Actions for ${movement.description}`}
                          {onRefund}
                          {onDelete}
                        />
                      </span>
                    </span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
