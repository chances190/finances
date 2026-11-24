<script lang="ts">
import { createWindowVirtualizer } from '@tanstack/svelte-virtual'
import SortAscendingIcon from 'phosphor-svelte/lib/SortAscendingIcon'
import SortDescendingIcon from 'phosphor-svelte/lib/SortDescendingIcon'
import { untrack } from 'svelte'
import EmptyState from '@/components/common/EmptyState.svelte'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { InstallmentInfo, Movement, OutstandingMovement } from '@/domain/ledger'
import { monthRelation, movementMonth } from '@/domain/ledger'
import { cn } from '@/lib/utils'
import MovementRowCells from './MovementRowCells.svelte'

interface Props {
  movements: Movement[]
  debtRowsById: Map<string, OutstandingMovement[]>
  emptyMessage: string
  installmentsById: Map<string, InstallmentInfo>
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
  onSort: (key: string) => void
  sortKey: string | null
  sortDir: 'asc' | 'desc'
}

let {
  movements,
  debtRowsById,
  emptyMessage,
  installmentsById,
  onOpen,
  onRefund,
  onDelete,
  onSort,
  sortKey,
  sortDir,
}: Props = $props()

let bodyEl = $state<HTMLTableSectionElement | null>(null)
let scrollMargin = $state(0)

const virtualizer = createWindowVirtualizer({
  count: 0,
  estimateSize: () => 41,
  overscan: 8,
})

$effect(() => {
  const count = movements.length
  const margin = scrollMargin
  untrack(() =>
    $virtualizer.setOptions({
      count,
      scrollMargin: margin,
      getItemKey: (index: number) => movements[index]?.id ?? index,
    }),
  )
})

$effect(() => {
  const element = bodyEl
  if (!element) return
  const measure = () => {
    scrollMargin = element.getBoundingClientRect().top + window.scrollY
  }
  measure()
  window.addEventListener('resize', measure)
  return () => window.removeEventListener('resize', measure)
})

const virtualRows = $derived(
  $virtualizer.getVirtualItems().filter((row) => row.index < movements.length),
)
const paddingTop = $derived(virtualRows.length > 0 ? virtualRows[0].start - scrollMargin : 0)
const paddingBottom = $derived(
  virtualRows.length > 0
    ? $virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - scrollMargin)
    : 0,
)

function measureRow(node: Element) {
  $virtualizer.measureElement(node)
}
</script>

<div class="border border-border">
  <Table class="table-fixed">
    <TableHeader>
      <TableRow>
        <TableHead class="w-28">
          <button
            type="button"
            onclick={() => onSort('payment')}
            class="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
          >
            Payment{#if sortKey === 'payment'}
              {#if sortDir === 'asc'}
                <SortAscendingIcon class="ml-0.5 inline size-3" />
              {:else}
                <SortDescendingIcon class="ml-0.5 inline size-3" />
              {/if}
            {/if}
          </button>
        </TableHead>
        <TableHead class="w-28 text-right">
          <button
            type="button"
            onclick={() => onSort('amount')}
            class="flex w-full cursor-pointer select-none items-center justify-end gap-0.5 text-right font-medium"
          >
            Amount{#if sortKey === 'amount'}
              {#if sortDir === 'asc'}
                <SortAscendingIcon class="ml-0.5 inline size-3" />
              {:else}
                <SortDescendingIcon class="ml-0.5 inline size-3" />
              {/if}
            {/if}
          </button>
        </TableHead>
        <TableHead class="flex-1">
          <button
            type="button"
            onclick={() => onSort('description')}
            class="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
          >
            Description{#if sortKey === 'description'}
              {#if sortDir === 'asc'}
                <SortAscendingIcon class="ml-0.5 inline size-3" />
              {:else}
                <SortDescendingIcon class="ml-0.5 inline size-3" />
              {/if}
            {/if}
          </button>
        </TableHead>
        <TableHead class="w-20">
          <button
            type="button"
            onclick={() => onSort('category')}
            class="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
          >
            Category{#if sortKey === 'category'}
              {#if sortDir === 'asc'}
                <SortAscendingIcon class="ml-0.5 inline size-3" />
              {:else}
                <SortDescendingIcon class="ml-0.5 inline size-3" />
              {/if}
            {/if}
          </button>
        </TableHead>
        <TableHead class="w-20">
          <button
            type="button"
            onclick={() => onSort('date')}
            class="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
          >
            Date{#if sortKey === 'date'}
              {#if sortDir === 'asc'}
                <SortAscendingIcon class="ml-0.5 inline size-3" />
              {:else}
                <SortDescendingIcon class="ml-0.5 inline size-3" />
              {/if}
            {/if}
          </button>
        </TableHead>
        <TableHead class="w-28 text-center">Installments</TableHead>
        <TableHead class="w-16 text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <tbody bind:this={bodyEl} class="[&_tr:last-child]:border-0">
      {#if movements.length === 0}
        <TableRow>
          <TableCell colspan={7}>
            <EmptyState variant="cell" message={emptyMessage} />
          </TableCell>
        </TableRow>
      {/if}

      {#if paddingTop > 0}
        <tr aria-hidden="true">
          <td colspan={7} style="height: {paddingTop}px"></td>
        </tr>
      {/if}

      {#each virtualRows as virtualRow (movements[virtualRow.index]?.id ?? virtualRow.index)}
        {@const movement = movements[virtualRow.index]}
        {@const isFuture = monthRelation(movementMonth(movement)) === 'future'}
        <tr
          data-index={virtualRow.index}
          {@attach measureRow}
          class={cn(
            'cursor-pointer border-b transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
            isFuture && 'opacity-45',
          )}
          tabindex={0}
          onclick={() => onOpen(movement)}
          onkeydown={(event) => {
            if (event.target !== event.currentTarget) return
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onOpen(movement)
          }}
        >
          <MovementRowCells
            {movement}
            debtRows={debtRowsById.get(movement.id) ?? []}
            installment={installmentsById.get(movement.id) ?? null}
            {onRefund}
            {onDelete}
          />
        </tr>
      {/each}

      {#if paddingBottom > 0}
        <tr aria-hidden="true">
          <td colspan={7} style="height: {paddingBottom}px"></td>
        </tr>
      {/if}
    </tbody>
  </Table>
</div>
