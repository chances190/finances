<script lang="ts">
import { Badge } from '@/components/ui/badge'
import {
  categoryOf,
  type InstallmentInfo,
  type Movement,
  monthRelation,
  movementMonth,
  type OutstandingMovement,
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import DebtStatusBadge from './DebtStatusBadge.svelte'
import MovementActions from './MovementActions.svelte'
import { amountClass, amountOf, detailOf, kindLabelOf } from './movement-display'
import PaymentBadge from './PaymentBadge.svelte'

interface Props {
  movement: Movement
  debtRows: OutstandingMovement[]
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
  installment: InstallmentInfo | null
}

let { movement, debtRows, onOpen, onRefund, onDelete, installment }: Props = $props()

const isFuture = $derived(monthRelation(movementMonth(movement)) === 'future')
const kindLabel = $derived(kindLabelOf(movement))
const detail = $derived(detailOf(movement, debtRows))
const category = $derived(
  movement.kind === 'purchase' || movement.kind === 'refund' ? categoryOf(movement) : undefined,
)
</script>

<div class="relative px-3 py-2 {isFuture ? 'opacity-45' : ''}">
  <button
    type="button"
    onclick={() => onOpen(movement)}
    class="block w-full rounded-lg py-1 text-left hover:bg-muted/30 focus-visible:outline focus-visible:outline-ring"
  >
    <span class="flex items-start gap-2 pr-16">
      <span class="min-w-0 flex-1 break-words text-sm font-medium">{movement.description}</span>
    </span>
    <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pr-10 text-xs">
      {#if kindLabel}
        <Badge variant="outline" class="text-[10px]">{kindLabel}</Badge>
      {/if}
      <PaymentBadge {movement} />
      {#if category}
        <Badge variant="outline" class="text-[10px]">{category}</Badge>
      {/if}
      {#if installment}
        <Badge variant="outline" class="text-[10px]"
          >{installment.index + 1}/{installment.total}</Badge
        >
      {/if}
      <span>{movement.date}</span>
      <DebtStatusBadge rows={debtRows} />
    </span>
    {#if detail}
      <span class="mt-1 block pr-10 text-[10px] text-muted-foreground">{detail}</span>
    {/if}
  </button>
  <span
    class="pointer-events-none absolute top-1.5 right-3 font-mono text-sm font-semibold {amountClass(
      movement,
    )}"
  >
    {formatCurrency(amountOf(movement))}
  </span>
  <div class="absolute right-0 bottom-0">
    <MovementActions {movement} {onRefund} {onDelete} />
  </div>
</div>
