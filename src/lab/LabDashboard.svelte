<script lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  currentYM,
  expensesByAccount,
  incomeByMonth,
  paceByMonth,
  spendingPace,
} from '@/domain/calculations'
import { formatCurrency } from '@/lib/currency'
import { finance } from '@/lib/stores/finance.svelte'
import LabIcon from './LabIcon.svelte'

interface Props {
  iconPack: 'phosphor' | 'tabler' | 'hugeicons'
}

let { iconPack }: Props = $props()

const financeState = $derived(finance.state)
const month = currentYM()
const budget = $derived(
  financeState.budgets.find((candidate) => candidate.referenceMonth === month),
)
const income = $derived(incomeByMonth(financeState.movements, month))
const expenses = $derived(paceByMonth(financeState.movements, month))
const voucher = $derived(expensesByAccount(financeState.movements, month).voucher ?? 0)
const pace = $derived(spendingPace(financeState.movements, budget, 26))
const maxDay = $derived(Math.max(...pace.daily.map((day) => day.actual), 1))
</script>

<div class="space-y-4">
  <div class="lab-page-heading">
    <div>
      <h1>Monthly dashboard</h1>
      <p>Spending pace and cash flow · {month}</p>
    </div>
    <Button variant="outline" size="sm">November 2026</Button>
  </div>

  <div class="lab-stat-grid">
    <div class="panel lab-stat p-4">
      <div class="lab-stat-label">
        <LabIcon pack={iconPack} name="trends" className="size-3.5" />
        Income
      </div>
      <div class="lab-stat-value text-green-600 dark:text-green-400">
        {formatCurrency(income)}
      </div>
    </div>
    <div class="panel lab-stat p-4">
      <div class="lab-stat-label">
        <LabIcon pack={iconPack} name="transactions" className="size-3.5" />
        Spending
      </div>
      <div class="lab-stat-value">{formatCurrency(expenses)}</div>
    </div>
    <div class="panel lab-stat p-4">
      <div class="lab-stat-label">
        <LabIcon pack={iconPack} name="dashboard" className="size-3.5" />
        Net
      </div>
      <div class="lab-stat-value text-green-600 dark:text-green-400">
        {formatCurrency(income - expenses)}
      </div>
    </div>
    <div class="panel lab-stat p-4">
      <div class="lab-stat-label">
        <LabIcon pack={iconPack} name="budgets" className="size-3.5" />
        Voucher spent
      </div>
      <div class="lab-stat-value">{formatCurrency(voucher)}</div>
    </div>
  </div>

  <div class="panel lab-pace p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <span class="lab-eyebrow">Spending pace</span>
        <div
          class="lab-pace-value {pace.remainingBudget < 0 ? 'text-red-600 dark:text-red-400' : ''}"
        >
          {formatCurrency(pace.remainingBudget)}
        </div>
        <p class="text-xs text-muted-foreground">Remaining budget</p>
      </div>
      <Badge
        variant="outline"
        class="text-green-700 bg-green-50 border-green-200 dark:text-green-200 dark:bg-green-500/15 dark:border-green-400/30"
      >
        {pace.status === 'on-track' ? 'On track' : pace.status}
      </Badge>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <div class="lab-pace-mini text-[var(--lab-accent)]">
          {formatCurrency(pace.suggestionPerDay)}
        </div>
        <p class="text-xs text-muted-foreground">Recommended per day</p>
      </div>
      <div>
        <div class="lab-pace-mini">R$ 90,46</div>
        <p class="text-xs text-muted-foreground">Average per day</p>
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="lab-progress">
        <div
          style="width: {Math.min(100, (pace.spentSoFar / Math.max(pace.limit, 1)) * 100)}%"
        ></div>
      </div>
      <div class="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Spent <span class="font-mono text-foreground">{formatCurrency(pace.spentSoFar)}</span> of
          <span class="font-mono text-foreground">{formatCurrency(pace.limit)}</span>
        </span>
        <span>26/30 days</span>
      </div>
    </div>

    <div class="lab-bars" role="img" aria-label="Daily spending preview">
      {#each pace.daily as day (day.day)}
        <div
          class="lab-bar {day.actual > 0 ? 'has-value' : ''}"
          style="height: {Math.max(3, (day.actual / maxDay) * 100)}%"
          title={`Day ${day.day}: ${formatCurrency(day.actual)}`}
        ></div>
      {/each}
    </div>
  </div>

  <div class="panel lab-sampler p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <span class="lab-eyebrow">Component sampler</span>
        <p class="text-xs text-muted-foreground">Controls, tags and surfaces in this preset.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button size="sm">Primary action</Button>
        <Button size="sm" variant="outline">Secondary</Button>
        <Button size="sm" variant="ghost">Ghost</Button>
      </div>
    </div>
    <div class="lab-sampler-grid">
      <div class="space-y-2">
        <label class="lab-field" for="lab-sampler-search">
          <span>Search</span>
          <Input id="lab-sampler-search" placeholder="Search transactions..." />
        </label>
        <div class="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            class="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:border-teal-400/30"
            >Debit/PIX</Badge
          >
          <Badge
            variant="outline"
            class="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-200 dark:border-purple-400/30"
            >Credit</Badge
          >
          <Badge
            variant="outline"
            class="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30"
            >Partial</Badge
          >
          <Badge
            variant="outline"
            class="bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-200 dark:border-green-400/30"
            >Paid</Badge
          >
        </div>
      </div>
      <div class="lab-mini-list">
        <div><span>Groceries</span><span>−R$ 300,00</span></div>
        <div><span>Ana owes</span><span>R$ 30,00</span></div>
        <div>
          <span>Salary</span><span class="text-green-600 dark:text-green-400">+R$ 5.000,00</span>
        </div>
      </div>
    </div>
  </div>
</div>
