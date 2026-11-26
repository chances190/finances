<script lang="ts">
import {
  currentYM,
  daysInMonth,
  incomeByMonth,
  paceByMonth,
  spendingPace,
} from '@/domain/calculations'
import type { Budget } from '@/domain/entities'
import { type Movement, outstanding } from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import MovementDetail from './MovementDetail.svelte'

interface Props {
  movements: Movement[]
  budgets: Budget[]
  selected: Movement | null
  month: string
  onEdit: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
  onGoToDebt: (movement: Movement) => void
  onOpenDebt: (counterparty: string) => void
}

let {
  movements,
  budgets,
  selected,
  month,
  onEdit,
  onRefund,
  onDelete,
  onGoToDebt,
  onOpenDebt,
}: Props = $props()

const monthLabel = $derived(
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  }),
)
const budget = $derived(budgets.find((candidate) => candidate.referenceMonth === month))
const income = $derived(incomeByMonth(movements, month))
const spent = $derived(paceByMonth(movements, month))
const net = $derived(income - spent)
const monthDays = $derived(daysInMonth(month))
const today = new Date()
const todayMonth = currentYM(today)
const currentDay = $derived(
  month < todayMonth ? monthDays : month === todayMonth ? Math.min(today.getDate(), monthDays) : 0,
)
const pace = $derived(spendingPace(movements, budget, currentDay))
const used = $derived(pace.limit > 0 ? Math.min(100, (pace.spentSoFar / pace.limit) * 100) : 0)
const receivables = $derived(outstanding(movements, 'receivable').slice(0, 3))
const payables = $derived(outstanding(movements, 'payable').slice(0, 3))
const debtCount = $derived(
  outstanding(movements, 'receivable').length + outstanding(movements, 'payable').length,
)
</script>

<aside
  class="hidden min-[1100px]:sticky min-[1100px]:top-20 min-[1100px]:grid min-[1100px]:gap-2.5 min-[1100px]:self-start"
>
  <section class="panel space-y-3 p-3">
    <div class="flex items-center justify-between gap-2">
      <span class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {monthLabel}
      </span>
      <span class="text-[10px] text-muted-foreground">{month}</span>
    </div>

    <div>
      <div
        class="font-mono text-2xl font-bold tracking-tight {net >= 0
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-600 dark:text-red-400'}"
      >
        {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
      </div>
      <p class="text-[11px] text-muted-foreground">Net this month</p>
    </div>

    <div class="grid grid-cols-2 gap-2 border-t border-border pt-2">
      <div>
        <span class="block text-[10px] text-muted-foreground">Income</span>
        <strong class="font-mono text-xs text-green-600 dark:text-green-400">
          {formatCurrency(income)}
        </strong>
      </div>
      <div>
        <span class="block text-[10px] text-muted-foreground">Spending</span>
        <strong class="font-mono text-xs text-red-600 dark:text-red-400">
          {formatCurrency(spent)}
        </strong>
      </div>
    </div>

    {#if budget && currentDay > 0}
      <div class="space-y-1.5 border-t border-border pt-2">
        <div class="flex items-baseline justify-between gap-2 text-[10px]">
          <span class="text-muted-foreground">Budget used</span>
          <span class="font-mono">{Math.round(used)}%</span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            class="h-full {pace.spentSoFar > pace.limit ? 'bg-destructive' : 'bg-primary'}"
            style="width: {used}%"
          ></div>
        </div>
        <div class="flex justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{formatCurrency(pace.spentSoFar)} spent</span>
          <span>{formatCurrency(pace.remainingBudget)} left</span>
        </div>
      </div>
    {:else if !budget}
      <p class="border-t border-border pt-2 text-[10px] text-muted-foreground">
        No budget for this month.
      </p>
    {:else}
      <p class="border-t border-border pt-2 text-[10px] text-muted-foreground">
        This month has not started yet.
      </p>
    {/if}
  </section>

  <section class="panel p-3">
    <span class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
      Selected entry
    </span>
    {#if selected}
      <div class="mt-2">
        <MovementDetail
          movement={selected}
          allMovements={movements}
          {onEdit}
          {onRefund}
          {onDelete}
          {onGoToDebt}
        />
      </div>
    {:else}
      <p class="py-4 text-xs text-muted-foreground">Select an entry.</p>
    {/if}
  </section>

  <section class="panel p-3">
    <div class="flex items-center justify-between gap-2">
      <span class="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        Open debts
      </span>
      <span class="text-[10px] text-muted-foreground">{debtCount} people</span>
    </div>

    {#if receivables.length === 0 && payables.length === 0}
      <p class="py-3 text-xs text-muted-foreground">Nothing outstanding.</p>
    {:else}
      <div class="mt-1 grid">
        {#each receivables as row (row.counterparty)}
          <button
            type="button"
            class="flex items-center justify-between gap-2 border-b border-border py-1.5 text-left text-[11px] last:border-0"
            onclick={() => onOpenDebt(row.counterparty)}
          >
            <span>{row.counterparty}</span>
            <strong class="font-medium text-green-600 dark:text-green-400">
              owes {formatCurrency(row.amount)}
            </strong>
          </button>
        {/each}
        {#each payables as row (row.counterparty)}
          <button
            type="button"
            class="flex items-center justify-between gap-2 border-b border-border py-1.5 text-left text-[11px] last:border-0"
            onclick={() => onOpenDebt(row.counterparty)}
          >
            <span>{row.counterparty}</span>
            <strong class="font-medium text-red-600 dark:text-red-400">
              you owe {formatCurrency(row.amount)}
            </strong>
          </button>
        {/each}
      </div>
    {/if}
  </section>
</aside>
