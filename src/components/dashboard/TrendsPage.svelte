<script lang="ts">
import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDownIcon'
import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUpIcon'
import PiggyBankIcon from 'phosphor-svelte/lib/PiggyBankIcon'
import TrendUpIcon from 'phosphor-svelte/lib/TrendUpIcon'
import EmptyState from '@/components/common/EmptyState.svelte'
import LazyChart from '@/components/common/LazyChart.svelte'
import StatCard from '@/components/common/StatCard.svelte'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  budgetVsActualYear,
  categoryTimeSeries,
  futureCommitments,
  yearRelation,
  yearSummary,
} from '@/domain/calculations'
import { formatCurrency } from '@/lib/currency'
import { navigate, router } from '@/lib/router.svelte'
import { finance } from '@/lib/stores/finance.svelte'
import ChartLegend from './ChartLegend.svelte'
import ChartView from './ChartView.svelte'
import {
  buildBudgetChart,
  buildCategoryTrends,
  buildCommitmentsChart,
  buildMonthlyChart,
  chartPalette,
} from './chart-config'

const financeState = $derived(finance.state)
const palette = $derived(chartPalette())

const years = $derived.by(() => {
  const values = new Set<string>()
  for (const movement of financeState.movements) values.add(movement.date.slice(0, 4))
  for (const budget of financeState.budgets) values.add(budget.referenceMonth.slice(0, 4))
  const currentYear = new Date().getFullYear()
  return Array.from(values)
    .filter((year) => Number(year) <= currentYear)
    .sort()
    .reverse()
})

const defaultYear = String(new Date().getFullYear())
const searchParams = $derived(new URLSearchParams(router.search))
const selectedYear = $derived(searchParams.get('year') ?? defaultYear)

function setSelectedYear(year: string) {
  const next = new URLSearchParams(router.search)
  if (year === defaultYear) next.delete('year')
  else next.set('year', year)
  const query = next.toString()
  navigate(query ? `${router.path}?${query}` : router.path, { replace: true })
}

const yearData = $derived(yearSummary(financeState.movements, Number(selectedYear)))

const timeSeriesMonths = $derived.by(() => {
  const year = Number(selectedYear)
  const elapsed = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12
  return Array.from(
    { length: elapsed },
    (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`,
  )
})

const timeSeriesData = $derived(
  categoryTimeSeries(financeState.movements, timeSeriesMonths) as {
    month: string
    [category: string]: number | string
  }[],
)

const isCurrentYear = $derived(Number(selectedYear) === new Date().getFullYear())
const commitmentsData = $derived(futureCommitments(financeState.movements, 12))

const commitmentsMax = $derived.by(() => {
  const sorted = [...financeState.budgets].sort((a, b) =>
    b.referenceMonth.localeCompare(a.referenceMonth),
  )
  const latest = sorted[0]
  if (!latest) return 0
  const categoryTotal = Object.values(latest.categoryLimits).reduce((sum, value) => sum + value, 0)
  return categoryTotal + latest.plannedMealVoucher
})

const yearlyBudgetVsActual = $derived(
  budgetVsActualYear(financeState.movements, financeState.budgets, Number(selectedYear)),
)

const topCategories = $derived.by(() => {
  if (timeSeriesData.length === 0) return []
  const keys = new Set<string>()
  for (const entry of timeSeriesData) {
    for (const key of Object.keys(entry)) {
      if (key !== 'month') keys.add(key)
    }
  }
  return Array.from(keys).slice(0, 6)
})

const monthlyChart = $derived(buildMonthlyChart(yearData.months, palette))
const categoryChart = $derived(buildCategoryTrends(timeSeriesData, topCategories, palette))
const commitmentsChart = $derived(buildCommitmentsChart(commitmentsData, commitmentsMax, palette))
const yearBudgetChart = $derived(buildBudgetChart(yearlyBudgetVsActual, palette))
</script>

{#snippet incomeIcon()}
  <ArrowUpIcon class="size-3 text-green-500" />
{/snippet}

{#snippet spendingIcon()}
  <ArrowDownIcon class="size-3 text-red-500" />
{/snippet}

{#snippet balanceIcon()}
  <PiggyBankIcon class="size-3 text-muted-foreground" />
{/snippet}

{#snippet savingsIcon()}
  <TrendUpIcon class="size-3 text-cyan-500" />
{/snippet}

{#if years.length === 0}
  <EmptyState
    message="No data available."
    action={{ label: 'Go to Transactions', onClick: () => navigate('/') }}
  />
{:else}
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">Trends</h2>
      <Select
        type="single"
        value={selectedYear}
        onValueChange={(value) => {
          if (value) setSelectedYear(value)
        }}
      >
        <SelectTrigger class="h-10 w-28 text-xs sm:h-7" aria-label="Trends year">
          {selectedYear}
        </SelectTrigger>
        <SelectContent>
          {#each years as year (year)}
            {@const relation = yearRelation(year)}
            <SelectItem
              value={year}
              class={relation === 'future'
                ? 'text-muted-foreground/60'
                : relation === 'current'
                  ? 'font-medium text-primary'
                  : ''}
            >
              {year}
            </SelectItem>
          {/each}
        </SelectContent>
      </Select>
    </div>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Total Income"
        icon={incomeIcon}
        value={formatCurrency(yearData.totalIncome)}
        valueClass="font-mono"
      />
      <StatCard
        label="Total Spending"
        icon={spendingIcon}
        value={formatCurrency(yearData.totalExpenses)}
        valueClass="font-mono"
      />
      <StatCard
        label="Income − spending"
        icon={balanceIcon}
        value={formatCurrency(yearData.totalBalance)}
        valueClass="font-mono {yearData.totalBalance >= 0
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-600 dark:text-red-400'}"
      />
      <StatCard
        label="Savings Rate"
        icon={savingsIcon}
        value={yearData.totalIncome > 0
          ? `${((yearData.totalBalance / yearData.totalIncome) * 100).toFixed(1)}%`
          : '—'}
      />
    </div>

    <div class="panel space-y-3 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Monthly Income vs Spending</h3>
        <ChartLegend
          items={[
            { label: 'Income', color: palette.series.income },
            { label: 'Spending', color: palette.series.expense },
          ]}
        />
      </div>
      <LazyChart class="h-64">
        <ChartView type="bar" data={monthlyChart.data} options={monthlyChart.options} />
      </LazyChart>
    </div>

    <div class="grid grid-cols-1 gap-4 {isCurrentYear ? 'lg:grid-cols-2' : ''}">
      <div class="panel space-y-3 p-4">
        <h3 class="text-sm font-semibold">Category Trends · {selectedYear}</h3>
        {#if timeSeriesData.length === 0 || topCategories.length === 0}
          <div class="flex h-48 items-center justify-center text-xs text-muted-foreground">
            Not enough data.
          </div>
        {:else}
          <LazyChart class="h-64">
            <ChartView type="line" data={categoryChart.data} options={categoryChart.options} />
          </LazyChart>
        {/if}
      </div>

      {#if isCurrentYear}
        <div class="panel space-y-3 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">Upcoming Spending</h3>
            <ChartLegend items={[{ label: 'Total', color: palette.series.actual }]} />
          </div>
          {#if commitmentsData.length === 0}
            <div class="flex h-48 items-center justify-center text-xs text-muted-foreground">
              No upcoming spending.
            </div>
          {:else}
            <LazyChart class="h-64">
              <ChartView
                type="bar"
                data={commitmentsChart.data}
                options={commitmentsChart.options}
              />
            </LazyChart>
          {/if}
        </div>
      {/if}
    </div>

    <div class="panel space-y-3 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Year Budget vs Actual</h3>
        <ChartLegend
          items={[
            { label: 'Budgeted', color: palette.series.budgeted },
            { label: 'Actual', color: palette.series.actual },
          ]}
        />
      </div>
      {#if yearlyBudgetVsActual.length === 0}
        <div class="flex h-48 items-center justify-center text-xs text-muted-foreground">
          No budgets set for this year.
        </div>
      {:else}
        <LazyChart class="h-64">
          <ChartView type="bar" data={yearBudgetChart.data} options={yearBudgetChart.options} />
        </LazyChart>
      {/if}
    </div>
  </div>
{/if}
