<script lang="ts">
import { createWindowVirtualizer } from '@tanstack/svelte-virtual'
import { untrack } from 'svelte'
import EmptyState from '@/components/common/EmptyState.svelte'
import type { InstallmentInfo, Movement, OutstandingMovement } from '@/domain/ledger'
import MovementCard from './MovementCard.svelte'

interface Props {
  movements: Movement[]
  debtRowsById: Map<string, OutstandingMovement[]>
  emptyMessage: string
  installmentsById: Map<string, InstallmentInfo>
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
}

let { movements, debtRowsById, emptyMessage, installmentsById, onOpen, onRefund, onDelete }: Props =
  $props()

let listEl = $state<HTMLDivElement | null>(null)
let scrollMargin = $state(0)

const virtualizer = createWindowVirtualizer({
  count: 0,
  estimateSize: () => 120,
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
  const element = listEl
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

function measureRow(node: Element) {
  $virtualizer.measureElement(node)
}
</script>

<div
  bind:this={listEl}
  class={movements.length > 0 ? 'border-t border-border' : undefined}
  style={movements.length > 0
    ? `height: ${$virtualizer.getTotalSize()}px; position: relative;`
    : undefined}
>
  {#if movements.length === 0}
    <EmptyState message={emptyMessage} />
  {:else}
    {#each virtualRows as virtualRow (movements[virtualRow.index]?.id ?? virtualRow.index)}
      {@const movement = movements[virtualRow.index]}
      <div
        data-index={virtualRow.index}
        {@attach measureRow}
        class="border-r border-b border-l border-border"
        style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({virtualRow.start -
          scrollMargin}px);"
      >
        <MovementCard
          {movement}
          debtRows={debtRowsById.get(movement.id) ?? []}
          installment={installmentsById.get(movement.id) ?? null}
          {onOpen}
          {onRefund}
          {onDelete}
        />
      </div>
    {/each}
  {/if}
</div>
