<script lang="ts">
import { Badge } from '@/components/ui/badge'
import { TableCell } from '@/components/ui/table'
import {
  categoryOf,
  type InstallmentInfo,
  type Movement,
  type OutstandingMovement,
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import DebtStatusBadge from './DebtStatusBadge.svelte'
import MovementActions from './MovementActions.svelte'
import { amountClass, amountOf, detailOf, kindLabelOf } from './movement-display'
import PaymentBadge from './PaymentBadge.svelte'

interface Props {
  movement: Movement
  debtRows: OutstandingMovement[]
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
  installment: InstallmentInfo | null
}

let { movement, debtRows, onRefund, onDelete, installment }: Props = $props()

const kindLabel = $derived(kindLabelOf(movement))
const detail = $derived(detailOf(movement, debtRows))
const category = $derived(
  movement.kind === 'purchase' || movement.kind === 'refund' ? categoryOf(movement) : undefined,
)
</script>

<TableCell>
  <PaymentBadge {movement} />
</TableCell>
<TableCell class={cn('text-right font-mono text-xs', amountClass(movement))}>
  {formatCurrency(amountOf(movement))}
</TableCell>
<TableCell>
  <div class="flex items-center gap-1.5">
    <div class="min-w-0 shrink truncate">{movement.description}</div>
    {#if kindLabel}
      <Badge variant="outline" class="shrink-0 text-[10px]">{kindLabel}</Badge>
    {/if}
    <DebtStatusBadge rows={debtRows} />
  </div>
  {#if detail}
    <div class="truncate text-[10px] text-muted-foreground">{detail}</div>
  {/if}
</TableCell>
<TableCell class="text-xs">{category ?? '—'}</TableCell>
<TableCell class="text-xs">{movement.date}</TableCell>
<TableCell class="text-center text-xs">
  {installment ? `${installment.index + 1}/${installment.total}` : '—'}
</TableCell>
<TableCell class="text-right" onclick={(event) => event.stopPropagation()}>
  <MovementActions {movement} {onRefund} {onDelete} />
</TableCell>
