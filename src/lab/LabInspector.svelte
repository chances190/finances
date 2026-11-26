<script lang="ts">
import { currentYM, incomeByMonth, paceByMonth, spendingPace } from '@/domain/calculations'
import type { Budget } from '@/domain/entities'
import { type Movement, outstanding } from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import LabEntryDetail from './LabEntryDetail.svelte'

interface Props {
  selected: Movement | null
  movements: Movement[]
  budgets: Budget[]
  onEdit: (movement: Movement) => void
}

let { selected, movements, budgets, onEdit }: Props = $props()

const month = currentYM()
const budget = $derived(budgets.find((candidate) => candidate.referenceMonth === month))
const income = $derived(incomeByMonth(movements, month))
const expenses = $derived(paceByMonth(movements, month))
const net = $derived(income - expenses)
const pace = $derived(spendingPace(movements, budget, 26))
const receivables = $derived(outstanding(movements, 'receivable').slice(0, 3))
const payables = $derived(outstanding(movements, 'payable').slice(0, 3))
const debtCount = $derived(
  outstanding(movements, 'receivable').length + outstanding(movements, 'payable').length,
)
</script>

<aside class="lab-rail">
  <section class="panel lab-rail-card">
    <div class="lab-rail-head">
      <span class="lab-eyebrow">November</span>
      <span class="text-[10px] text-muted-foreground">{month}</span>
    </div>
    <div class="lab-rail-net {net >= 0 ? 'is-positive' : 'is-negative'}">
      {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
    </div>
    <p class="text-[11px] text-muted-foreground">Net this month</p>
    <div class="lab-rail-split">
      <div>
        <span>Income</span>
        <strong class="text-green-600 dark:text-green-400">{formatCurrency(income)}</strong>
      </div>
      <div>
        <span>Spending</span>
        <strong>{formatCurrency(expenses)}</strong>
      </div>
    </div>
    <div class="lab-rail-pace">
      <div class="flex items-baseline justify-between gap-2 text-[10px]">
        <span class="text-muted-foreground">Budget used</span>
        <span class="font-mono">
          {Math.round((pace.spentSoFar / Math.max(pace.limit, 1)) * 100)}%
        </span>
      </div>
      <div class="lab-progress">
        <div
          style="width: {Math.min(100, (pace.spentSoFar / Math.max(pace.limit, 1)) * 100)}%"
        ></div>
      </div>
      <div class="flex justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{formatCurrency(pace.spentSoFar)} spent</span>
        <span>{formatCurrency(pace.remainingBudget)} left</span>
      </div>
    </div>
  </section>

  <section class="panel lab-rail-card">
    <div class="lab-rail-head">
      <span class="lab-eyebrow">Selected entry</span>
    </div>
    {#if selected}
      <LabEntryDetail movement={selected} allMovements={movements} {onEdit} />
    {:else}
      <p class="py-5 text-xs text-muted-foreground">Select an entry.</p>
    {/if}
  </section>

  <section class="panel lab-rail-card">
    <div class="lab-rail-head">
      <span class="lab-eyebrow">Open debts</span>
      <span class="text-[10px] text-muted-foreground">{debtCount} people</span>
    </div>
    {#if receivables.length === 0 && payables.length === 0}
      <p class="text-xs text-muted-foreground">Nothing outstanding.</p>
    {:else}
      <div class="lab-rail-debts">
        {#each receivables as row (row.counterparty)}
          <div>
            <span>{row.counterparty}</span
            ><strong class="text-green-600 dark:text-green-400"
              >owes {formatCurrency(row.amount)}</strong
            >
          </div>
        {/each}
        {#each payables as row (row.counterparty)}
          <div>
            <span>{row.counterparty}</span
            ><strong class="text-red-600 dark:text-red-400"
              >you owe {formatCurrency(row.amount)}</strong
            >
          </div>
        {/each}
      </div>
    {/if}
  </section>
</aside>
