<script lang="ts">
import DebtStatusBadge from '@/components/transactions/DebtStatusBadge.svelte'
import {
  amountClass,
  amountOf,
  detailOf,
  kindLabelOf,
  paymentLabelOf,
} from '@/components/transactions/movement-display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  categoryOf,
  installmentInfo,
  type Movement,
  outstandingMovements,
  refundableAmount,
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'

interface Props {
  movement: Movement
  allMovements: Movement[]
  onEdit: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
  onGoToDebt: (movement: Movement) => void
}

let { movement, allMovements, onEdit, onRefund, onDelete, onGoToDebt }: Props = $props()

const category = $derived(categoryOf(movement))
const installment = $derived(installmentInfo(movement, allMovements))
const debtRows = $derived(
  (['receivable', 'payable'] as const).flatMap((direction) =>
    outstandingMovements(allMovements, direction).filter((row) => row.movementId === movement.id),
  ),
)
const detail = $derived(detailOf(movement, debtRows))
const counterparties = $derived([
  ...new Set(
    movement.postings.flatMap((posting) => (posting.counterparty ? [posting.counterparty] : [])),
  ),
])
const canEdit = $derived(movement.kind === 'purchase' || movement.kind === 'income')
const refundable = $derived(
  movement.kind === 'purchase' ? refundableAmount(movement, allMovements) : 0,
)
const hasDebt = $derived(
  movement.kind === 'purchase' &&
    movement.postings.some(
      (posting) => posting.account === 'receivable' || posting.account === 'payable',
    ),
)

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<div>
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0">
      <div class="font-mono text-2xl font-bold tracking-tight {amountClass(movement)}">
        {movement.kind === 'income' || movement.kind === 'refund' ? '+' : ''}{formatCurrency(
          amountOf(movement),
        )}
      </div>
      <p class="mt-1 text-sm font-semibold">{movement.description}</p>
    </div>
    {#if kindLabelOf(movement)}
      <Badge variant="outline" class="shrink-0 text-[10px]">{kindLabelOf(movement)}</Badge>
    {/if}
  </div>

  <div class="mt-3 space-y-1.5 border-t border-border pt-2 text-[11px]">
    <div class="flex items-center justify-between gap-3">
      <span class="text-muted-foreground">Date</span>
      <span class="text-right font-medium">{formatDate(movement.date)}</span>
    </div>
    <div class="flex items-center justify-between gap-3">
      <span class="text-muted-foreground">Payment</span>
      <span class="text-right font-medium">{paymentLabelOf(movement)}</span>
    </div>
    <div class="flex items-center justify-between gap-3">
      <span class="text-muted-foreground">Category</span>
      <span class="text-right font-medium">{category ?? '—'}</span>
    </div>
    {#if installment}
      <div class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">Installment</span>
        <span class="text-right font-medium"> {installment.index + 1} of {installment.total} </span>
      </div>
    {/if}
    {#if counterparties.length > 0}
      <div class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">Person</span>
        <span class="text-right font-medium">{counterparties.join(', ')}</span>
      </div>
    {/if}
    <div class="flex items-center justify-between gap-3">
      <span class="text-muted-foreground">Debt</span>
      {#if debtRows.length > 0}
        <DebtStatusBadge rows={debtRows} />
      {:else}
        <span class="text-right font-medium">—</span>
      {/if}
    </div>
  </div>

  {#if detail}
    <p
      class="mt-2 rounded-[3px] bg-muted px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground"
    >
      {detail}
    </p>
  {/if}

  <div class="mt-3 flex flex-wrap gap-2">
    {#if canEdit}
      <Button variant="outline" size="sm" class="h-10 flex-1" onclick={() => onEdit(movement)}>
        Edit
      </Button>
    {/if}
    {#if refundable > 0.004}
      <Button variant="outline" size="sm" class="h-10 flex-1" onclick={() => onRefund(movement)}>
        Reimbursed
      </Button>
    {/if}
    {#if hasDebt}
      <Button variant="outline" size="sm" class="h-10 flex-1" onclick={() => onGoToDebt(movement)}>
        Go to debt
      </Button>
    {/if}
    <Button
      variant="destructive"
      size="sm"
      class="h-10 flex-1"
      onclick={() => onDelete(movement.id)}
    >
      Delete
    </Button>
  </div>
</div>
