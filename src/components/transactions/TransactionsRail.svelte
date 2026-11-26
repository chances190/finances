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

const monthName = $derived(
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long' }),
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

<aside class="tx-rail">
  <section class="panel tx-rail-card">
    <div class="tx-rail-head">
      <span class="tx-eyebrow">{monthName}</span>
      <span class="text-[10px] text-muted-foreground">{month}</span>
    </div>

    <div class="tx-rail-net {net >= 0 ? 'is-positive' : 'is-negative'}">
      {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
    </div>
    <p class="text-[11px] text-muted-foreground">Net this month</p>

    <div class="tx-rail-split">
      <div>
        <span>Income</span>
        <strong class="text-green-600 dark:text-green-400">{formatCurrency(income)}</strong>
      </div>
      <div>
        <span>Spending</span>
        <strong class="text-red-600 dark:text-red-400">{formatCurrency(spent)}</strong>
      </div>
    </div>

    {#if budget && currentDay > 0}
      <div class="tx-rail-pace">
        <div class="flex items-baseline justify-between gap-2 text-[10px]">
          <span class="text-muted-foreground">Budget used</span>
          <span class="font-mono">{Math.round(used)}%</span>
        </div>
        <div class="tx-progress">
          <div style="width: {used}%"></div>
        </div>
        <div class="flex justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{formatCurrency(pace.spentSoFar)} spent</span>
          <span>{formatCurrency(pace.remainingBudget)} left</span>
        </div>
      </div>
    {:else if !budget}
      <p class="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
        No budget for this month.
      </p>
    {:else}
      <p class="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
        This month has not started yet.
      </p>
    {/if}
  </section>

  <section class="panel tx-rail-card">
    <div class="tx-rail-head">
      <span class="tx-eyebrow">Selected entry</span>
    </div>
    {#if selected}
      <MovementDetail
        movement={selected}
        allMovements={movements}
        {onEdit}
        {onRefund}
        {onDelete}
        {onGoToDebt}
      />
    {:else}
      <p class="py-5 text-xs text-muted-foreground">Select an entry.</p>
    {/if}
  </section>

  <section class="panel tx-rail-card">
    <div class="tx-rail-head">
      <span class="tx-eyebrow">Open debts</span>
      <span class="text-[10px] text-muted-foreground">{debtCount} people</span>
    </div>

    {#if receivables.length === 0 && payables.length === 0}
      <p class="text-xs text-muted-foreground">Nothing outstanding.</p>
    {:else}
      <div class="tx-rail-debts">
        {#each receivables as row (row.counterparty)}
          <button type="button" onclick={() => onOpenDebt(row.counterparty)}>
            <span>{row.counterparty}</span>
            <strong class="text-green-600 dark:text-green-400">
              owes {formatCurrency(row.amount)}
            </strong>
          </button>
        {/each}
        {#each payables as row (row.counterparty)}
          <button type="button" onclick={() => onOpenDebt(row.counterparty)}>
            <span>{row.counterparty}</span>
            <strong class="text-red-600 dark:text-red-400">
              you owe {formatCurrency(row.amount)}
            </strong>
          </button>
        {/each}
      </div>
    {/if}
  </section>
</aside>
