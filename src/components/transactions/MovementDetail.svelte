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
const amount = $derived(movement.kind === 'purchase' ? expenseAmount(movement) : amountOf(movement))

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
  <div class="tx-entry-detail-head">
    <div class="min-w-0">
      <div class="tx-entry-detail-amount {amountClass(movement)}">
        {movement.kind === 'income' ? '+' : ''}{formatCurrency(amount)}
      </div>
      <p class="mt-1 text-sm font-semibold">{movement.description}</p>
    </div>
    {#if kindLabelOf(movement)}
      <Badge variant="outline" class="shrink-0 text-[10px]">{kindLabelOf(movement)}</Badge>
    {/if}
  </div>

  <div class="tx-entry-kv">
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
    <div>
      <span>Debt</span>
      {#if debtRows.length > 0}
        <DebtStatusBadge rows={debtRows} />
      {:else}
        <strong>—</strong>
      {/if}
    </div>
  </div>

  {#if detail}
    <p class="tx-entry-detail-note">{detail}</p>
  {/if}

  <div class="mt-3 grid grid-cols-2 gap-2">
    {#if canEdit}
      <button
        type="button"
        class="tx-secondary py-2 text-xs font-semibold"
        onclick={() => onEdit(movement)}
      >
        Edit
      </button>
    {/if}
    {#if refundable > 0.004}
      <button
        type="button"
        class="tx-secondary py-2 text-xs font-semibold"
        onclick={() => onRefund(movement)}
      >
        Reimbursed
      </button>
    {/if}
    {#if hasDebt}
      <button
        type="button"
        class="tx-secondary py-2 text-xs font-semibold"
        onclick={() => onGoToDebt(movement)}
      >
        Go to debt
      </button>
    {/if}
    <button
      type="button"
      class="tx-secondary py-2 text-xs font-semibold text-destructive"
      onclick={() => onDelete(movement.id)}
    >
      Delete
    </button>
  </div>
</div>
