<script lang="ts">
import ForkKnifeIcon from 'phosphor-svelte/lib/ForkKnifeIcon'
import PiggyBankIcon from 'phosphor-svelte/lib/PiggyBankIcon'
import TrendDownIcon from 'phosphor-svelte/lib/TrendDownIcon'
import TrendUpIcon from 'phosphor-svelte/lib/TrendUpIcon'
import EmptyState from '@/components/common/EmptyState.svelte'
import LazyChart from '@/components/common/LazyChart.svelte'
import StatCard from '@/components/common/StatCard.svelte'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  availableMonths,
  budgetVsActual,
  currentYM,
  daysInMonth,
  expensesByAccount,
  incomeByAccount,
  incomeByMonth,
  monthRelation,
  type PaceStatus,
  paceByMonth,
  spendingPace,
} from '@/domain/calculations'
import { type DisplayPaymentMethod, expensesByPaymentMethod } from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import { navigate, router } from '@/lib/router.svelte'
import { finance } from '@/lib/stores/finance.svelte'
import ChartLegend from './ChartLegend.svelte'
import ChartView from './ChartView.svelte'
import {
  buildBudgetChart,
  buildPaceChart,
  buildPaymentPie,
  chartPalette,
  paymentMethodChartColor,
} from './chart-config'

const PACE_STATUS: Record<PaceStatus, { label: string; color: string }> = {
  'on-track': { label: 'On track', color: 'text-green-600 dark:text-green-400' },
  caution: { label: 'Caution', color: 'text-amber-600 dark:text-amber-400' },
  ahead: { label: 'Ahead of pace', color: 'text-amber-600 dark:text-amber-400' },
  over: { label: 'Over budget', color: 'text-red-600 dark:text-red-400' },
}

const financeState = $derived(finance.state)
const palette = $derived(chartPalette())

const months = $derived(availableMonths(financeState.movements))
const monthOptions = $derived(months.length > 0 ? months : [currentYM()])
const nowYM = currentYM()
const defaultMonth = $derived(months.includes(nowYM) ? nowYM : monthOptions[0])

const searchParams = $derived(new URLSearchParams(router.search))
const selectedMonth = $derived(searchParams.get('month') ?? defaultMonth)

function setSelectedMonth(month: string) {
  const next = new URLSearchParams(router.search)
  if (month === defaultMonth) next.delete('month')
  else next.set('month', month)
  const query = next.toString()
  navigate(query ? `${router.path}?${query}` : router.path, { replace: true })
}

const budget = $derived(
  financeState.budgets.find((candidate) => candidate.referenceMonth === selectedMonth),
)

const monthData = $derived.by(() => {
  const income = incomeByMonth(financeState.movements, selectedMonth)
  const expenses = paceByMonth(financeState.movements, selectedMonth)
  const voucherIncome = incomeByAccount(financeState.movements, selectedMonth).voucher ?? 0
  const voucherSpent = expensesByAccount(financeState.movements, selectedMonth).voucher ?? 0
  return {
    income,
    expenses,
    balance: income - expenses,
    mealVoucher: voucherIncome - voucherSpent,
  }
})

const budgetVsActualData = $derived(budgetVsActual(financeState.movements, budget))

const paymentMethodData = $derived.by(() => {
  const grouped = expensesByPaymentMethod(financeState.movements, selectedMonth)
  return Object.entries(grouped)
    .filter(([, value]) => value > 0)
    .map(([method, value]) => ({
      name: method as DisplayPaymentMethod,
      value: value as number,
      color: paymentMethodChartColor(method as DisplayPaymentMethod, palette),
    }))
    .sort((a, b) => b.value - a.value)
})

const today = new Date()
const currentMonth = currentYM(today)
const monthDays = $derived(daysInMonth(selectedMonth || currentMonth))
const currentDay = $derived(
  selectedMonth === currentMonth
    ? Math.min(today.getDate(), monthDays)
    : selectedMonth < currentMonth
      ? monthDays
      : 0,
)

const pace = $derived(spendingPace(financeState.movements, budget, currentDay))
const dailyQuota = $derived(monthDays > 0 ? pace.limit / monthDays : 0)
const dailyAvg = $derived(currentDay > 0 ? pace.spentSoFar / currentDay : 0)
const invested = $derived(budget ? budget.plannedIncome * budget.investmentRate : 0)
const paceStatus = $derived(PACE_STATUS[pace.status])

const dailyChart = $derived(buildPaceChart(pace.daily, currentDay, palette, 'daily'))
const cumulativeChart = $derived(buildPaceChart(pace.cumulative, currentDay, palette, 'cumulative'))
const budgetChart = $derived(buildBudgetChart(budgetVsActualData, palette))
const paymentPie = $derived(buildPaymentPie(paymentMethodData, palette))
</script>

{#snippet incomeIcon()}
  <TrendUpIcon class="size-3 text-green-500" />
{/snippet}

{#snippet expenseIcon()}
  <TrendDownIcon class="size-3 text-red-500" />
{/snippet}

{#snippet balanceIcon()}
  <PiggyBankIcon class="size-3 text-muted-foreground" />
{/snippet}

{#snippet voucherIcon()}
  <ForkKnifeIcon class="size-3 text-pink-500" />
{/snippet}

{#if financeState.movements.length === 0}
  <EmptyState
    message="No transaction data available."
    action={{ label: 'Go to Transactions', onClick: () => navigate('/') }}
  />
{:else}
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">Monthly Dashboard</h2>
      <Select
        type="single"
        value={selectedMonth}
        onValueChange={(value) => {
          if (value) setSelectedMonth(value)
        }}
      >
        <SelectTrigger class="h-10 w-36 text-xs sm:h-7" aria-label="Dashboard month">
          {selectedMonth}
        </SelectTrigger>
        <SelectContent>
          {#each monthOptions as month (month)}
            {@const relation = monthRelation(month)}
            <SelectItem
              value={month}
              class={relation === 'future'
                ? 'text-muted-foreground/60'
                : relation === 'current'
                  ? 'font-medium text-primary'
                  : ''}
            >
              {month}
            </SelectItem>
          {/each}
        </SelectContent>
      </Select>
    </div>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Income"
        icon={incomeIcon}
        value={formatCurrency(monthData.income)}
        valueClass="font-mono"
      />
      <StatCard
        label="Spending"
        icon={expenseIcon}
        value={formatCurrency(monthData.expenses)}
        valueClass="font-mono"
      />
      <StatCard
        label="Net Spending"
        icon={balanceIcon}
        value={formatCurrency(monthData.balance)}
        valueClass="font-mono {monthData.balance >= 0 ? 'text-primary' : 'text-destructive'}"
      />
      <StatCard
        label="Net Voucher"
        icon={voucherIcon}
        value={formatCurrency(monthData.mealVoucher)}
        valueClass="font-mono {monthData.mealVoucher >= 0 ? 'text-primary' : 'text-destructive'}"
      />
    </div>

    {#if currentDay > 0 && dailyQuota === 0}
      <div class="panel p-4">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendDownIcon class="size-4" />
          <span>
            {budget
              ? 'Add planned income to this budget to see your spending pace.'
              : 'Set a budget to see your spending pace.'}
          </span>
        </div>
      </div>
    {/if}

    {#if currentDay > 0 && dailyQuota > 0}
      <div class="panel space-y-4 p-4">
        <div class="flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-sm font-semibold">
            <TrendDownIcon class="size-4" />
            Spending Pace
          </h3>
          <Badge variant="outline" class={paceStatus.color}>{paceStatus.label}</Badge>
        </div>

        <div>
          <p
            class="font-mono text-2xl font-bold {pace.remainingBudget < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-foreground'}"
          >
            {formatCurrency(pace.remainingBudget)}
          </p>
          <p class="text-xs text-muted-foreground">Remaining budget</p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <p class="font-mono text-base text-primary">
              {formatCurrency(pace.suggestionPerDay)}
            </p>
            <p class="text-xs text-muted-foreground">Recommended per day</p>
          </div>
          <div>
            <p class="font-mono text-base text-foreground">{formatCurrency(dailyAvg)}</p>
            <p class="text-xs text-muted-foreground">Average per day</p>
          </div>
        </div>

        <div class="space-y-1">
          <div class="h-2 w-full bg-muted">
            <div
              class="h-full {pace.spentSoFar > pace.limit ? 'bg-destructive' : 'bg-primary'}"
              style="width: {Math.min(100, (pace.spentSoFar / pace.limit) * 100)}%"
            ></div>
          </div>
          <div class="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Spent
              <span class="font-mono text-foreground">{formatCurrency(pace.spentSoFar)}</span>
              of
              <span class="font-mono text-foreground">{formatCurrency(pace.limit)}</span>
            </span>
            <span>{currentDay}/{monthDays} days</span>
          </div>
          <p class="text-[10px] text-muted-foreground">
            (Planned {formatCurrency(pace.totalSalary)} − investments {formatCurrency(invested)})
          </p>
        </div>

        <div>
          <h4 class="mb-1 text-xs font-medium text-muted-foreground">Daily (R$)</h4>
          <ChartLegend
            class="mb-2"
            items={[
              { label: 'Actual', color: palette.series.actual },
              { label: 'Daily quota', color: palette.series.primary, dashed: true },
              { label: 'Trend', color: palette.series.projection },
            ]}
          />
          <LazyChart class="h-56">
            <ChartView type="bar" data={dailyChart.data} options={dailyChart.options} />
          </LazyChart>
        </div>

        <div>
          <h4 class="mb-1 text-xs font-medium text-muted-foreground">Cumulative (R$)</h4>
          <ChartLegend
            class="mb-2"
            items={[
              { label: 'Actual', color: palette.series.actual },
              { label: 'Daily quota', color: palette.series.primary, dashed: true },
              { label: 'Projection', color: palette.series.projection, dashed: true },
            ]}
          />
          <LazyChart class="h-56">
            <ChartView type="bar" data={cumulativeChart.data} options={cumulativeChart.options} />
          </LazyChart>
        </div>
      </div>
    {/if}

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="panel space-y-3 p-4 lg:col-span-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Budget vs Actual</h3>
          <ChartLegend
            items={[
              { label: 'Budgeted', color: palette.series.budgeted },
              { label: 'Actual', color: palette.series.actual },
            ]}
          />
        </div>
        {#if budgetVsActualData.length === 0}
          <div class="flex h-48 items-center justify-center text-xs text-muted-foreground">
            No budget set for this month.
          </div>
        {:else}
          <LazyChart class="h-64">
            <ChartView type="bar" data={budgetChart.data} options={budgetChart.options} />
          </LazyChart>
        {/if}
      </div>

      <div class="panel space-y-3 p-4">
        <h3 class="text-sm font-semibold">Spending by payment method</h3>
        {#if paymentMethodData.length === 0}
          <div class="flex h-48 items-center justify-center text-xs text-muted-foreground">
            No spending this month.
          </div>
        {:else}
          <div class="flex flex-col items-center">
            <LazyChart class="h-48 w-full">
              <ChartView type="pie" data={paymentPie.data} options={paymentPie.options} />
            </LazyChart>
            <div class="mt-2 flex flex-wrap justify-center gap-3">
              {#each paymentMethodData as entry (entry.name)}
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    class="inline-block size-2.5 rounded-full"
                    style="background: {entry.color}"
                  ></span>
                  {entry.name}: <span class="font-mono">{formatCurrency(entry.value)}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
