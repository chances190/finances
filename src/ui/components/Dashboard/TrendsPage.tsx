import { ArrowDown, ArrowUp, PiggyBank, TrendUp } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useLocation, useSearchParams } from 'wouter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  budgetVsActualYear,
  categoryTimeSeries,
  futureCommitments,
  yearRelation,
  yearSummary,
} from '@/domain/calculations'
import { formatCurrency } from '@/lib/currency'
import EmptyState from '@/ui/components/Common/EmptyState'
import LazyChart from '@/ui/components/Common/LazyChart'
import StatCard from '@/ui/components/Common/StatCard'
import { useFinance } from '@/ui/context'
import {
  CategoryTrendsChart,
  FutureCommitmentsChart,
  MonthlyIncomeExpenseChart,
  YearBudgetVsActualChart,
} from './TrendsCharts'

export default function TrendsPage() {
  const { state } = useFinance()
  const [, navigate] = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const years = useMemo(() => {
    const y = new Set<string>()
    for (const movement of state.movements) {
      y.add(movement.date.slice(0, 4))
    }
    for (const b of state.budgets) {
      y.add(b.referenceMonth.slice(0, 4))
    }
    const currentYear = new Date().getFullYear()
    return Array.from(y)
      .filter((yearStr) => Number(yearStr) <= currentYear)
      .sort()
      .reverse()
  }, [state.movements, state.budgets])

  const defaultYear = String(new Date().getFullYear())
  const selectedYear = searchParams.get('year') ?? defaultYear

  function setSelectedYear(year: string) {
    setSearchParams((prev) => {
      if (year === defaultYear) {
        prev.delete('year')
      } else {
        prev.set('year', year)
      }
      return prev
    })
  }

  const yearData = useMemo(
    () => yearSummary(state.movements, Number(selectedYear)),
    [state.movements, selectedYear],
  )

  const timeSeriesMonths = useMemo(() => {
    const year = Number(selectedYear)
    const elapsed = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12
    return Array.from({ length: elapsed }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  }, [selectedYear])

  const timeSeriesData = useMemo(
    () =>
      categoryTimeSeries(state.movements, timeSeriesMonths) as {
        month: string
        [cat: string]: number | string
      }[],
    [state.movements, timeSeriesMonths],
  )

  const isCurrentYear = Number(selectedYear) === new Date().getFullYear()

  const commitmentsData = useMemo(() => futureCommitments(state.movements, 12), [state.movements])

  const commitmentsMax = useMemo(() => {
    const sorted = [...state.budgets].sort((a, b) =>
      b.referenceMonth.localeCompare(a.referenceMonth),
    )
    const latest = sorted[0]
    if (!latest) return 0
    const catTotal = Object.values(latest.categoryLimits).reduce((s, v) => s + v, 0)
    return catTotal + latest.plannedMealVoucher
  }, [state.budgets])

  const yearlyBudgetVsActual = useMemo(
    () => budgetVsActualYear(state.movements, state.budgets, Number(selectedYear)),
    [state.movements, state.budgets, selectedYear],
  )

  const topCategories = useMemo(() => {
    if (timeSeriesData.length === 0) return []
    const keys = new Set<string>()
    for (const entry of timeSeriesData) {
      for (const key of Object.keys(entry)) {
        if (key !== 'month') keys.add(key)
      }
    }
    return Array.from(keys).slice(0, 6)
  }, [timeSeriesData])

  if (years.length === 0) {
    return (
      <EmptyState
        message="No data available."
        action={{ label: 'Go to Transactions', onClick: () => navigate('/') }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Trends</h2>
        <Select value={selectedYear} onValueChange={(v) => v && setSelectedYear(v)}>
          <SelectTrigger className="h-10 w-28 text-xs data-[size=default]:h-10 sm:h-7 sm:data-[size=default]:h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => {
              const rel = yearRelation(y)
              return (
                <SelectItem
                  key={y}
                  value={y}
                  className={
                    rel === 'future'
                      ? 'text-muted-foreground/60'
                      : rel === 'current'
                        ? 'text-primary font-medium'
                        : ''
                  }
                >
                  {y}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Income"
          icon={<ArrowUp className="size-3 text-green-500" />}
          value={formatCurrency(yearData.totalIncome)}
          valueClassName="font-mono"
        />
        <StatCard
          label="Total Spending"
          icon={<ArrowDown className="size-3 text-red-500" />}
          value={formatCurrency(yearData.totalExpenses)}
          valueClassName="font-mono"
        />
        <StatCard
          label="Income − spending"
          icon={<PiggyBank className="size-3 text-muted-foreground" />}
          value={formatCurrency(yearData.totalBalance)}
          valueClassName={`font-mono ${yearData.totalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}
        />
        <StatCard
          label="Savings Rate"
          icon={<TrendUp className="size-3 text-cyan-500" />}
          value={
            yearData.totalIncome > 0
              ? `${((yearData.totalBalance / yearData.totalIncome) * 100).toFixed(1)}%`
              : '—'
          }
        />
      </div>

      <div className="border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Monthly Income vs Spending</h3>
        <LazyChart className="h-64">
          <MonthlyIncomeExpenseChart data={yearData.months} />
        </LazyChart>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${isCurrentYear ? 'lg:grid-cols-2' : ''}`}>
        <div className="border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Category Trends · {selectedYear}</h3>
          {timeSeriesData.length === 0 || topCategories.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
              Not enough data.
            </div>
          ) : (
            <LazyChart className="h-64">
              <CategoryTrendsChart data={timeSeriesData} categories={topCategories} />
            </LazyChart>
          )}
        </div>

        {isCurrentYear && (
          <div className="border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Upcoming Spending</h3>
            {commitmentsData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
                No upcoming spending.
              </div>
            ) : (
              <LazyChart className="h-64">
                <FutureCommitmentsChart data={commitmentsData} max={commitmentsMax} />
              </LazyChart>
            )}
          </div>
        )}
      </div>

      <div className="border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Year Budget vs Actual</h3>
        {yearlyBudgetVsActual.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
            No budgets set for this year.
          </div>
        ) : (
          <LazyChart className="h-64">
            <YearBudgetVsActualChart data={yearlyBudgetVsActual} />
          </LazyChart>
        )}
      </div>
    </div>
  )
}
