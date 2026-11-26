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
  movement: Movement
  allMovements: Movement[]
  onEdit?: (movement: Movement) => void
}

let { movement, allMovements, onEdit }: Props = $props()

const category = $derived(categoryOf(movement))
const installment = $derived(installmentInfo(movement, allMovements))
const debtRows = $derived.by(() => {
  const rows: OutstandingMovement[] = []
  for (const direction of ['receivable', 'payable'] as const) {
    rows.push(
      ...outstandingMovements(allMovements, direction).filter(
        (row) => row.movementId === movement.id,
      ),
    )
  }
  return rows
})
const detail = $derived(detailOf(movement, debtRows))
const counterparties = $derived([
  ...new Set(
    movement.postings.flatMap((posting) => (posting.counterparty ? [posting.counterparty] : [])),
  ),
])
const amount = $derived(movement.kind === 'purchase' ? expenseAmount(movement) : amountOf(movement))
const isFuture = $derived(monthRelation(movementMonth(movement)) === 'future')

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<div class="lab-entry-detail {isFuture ? 'opacity-70' : ''}">
  <div class="lab-entry-detail-head">
    <div class="min-w-0">
      <div class="lab-entry-detail-amount {amountClass(movement)}">
        {movement.kind === 'income' ? '+' : ''}{formatCurrency(amount)}
      </div>
      <p class="mt-1 text-sm font-semibold">{movement.description}</p>
    </div>
    {#if kindLabelOf(movement)}
      <Badge variant="outline" class="shrink-0 text-[10px]">{kindLabelOf(movement)}</Badge>
    {/if}
  </div>

  <div class="lab-entry-kv">
    <div><span>Date</span><strong>{formatDate(movement.date)}</strong></div>
    <div><span>Payment</span><strong>{paymentLabelOf(movement)}</strong></div>
    <div><span>Category</span><strong>{category ?? '—'}</strong></div>
    {#if installment}
      <div>
        <span>Installment</span>
        <strong>{installment.index + 1} of {installment.total}</strong>
      </div>
    {/if}
    {#if counterparties.length > 0}
      <div><span>Person</span><strong>{counterparties.join(', ')}</strong></div>
    {/if}
    <div><span>Debt</span><DebtStatusBadge rows={debtRows} /></div>
  </div>

  {#if detail}
    <p class="lab-entry-detail-note">{detail}</p>
  {/if}

  {#if onEdit}
    <button
      type="button"
      class="lab-secondary mt-3 w-full py-2 text-xs font-semibold"
      onclick={() => onEdit(movement)}
    >
      Edit entry
    </button>
  {/if}
</div>
