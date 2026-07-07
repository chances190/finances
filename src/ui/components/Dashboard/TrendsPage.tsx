import { ArrowDown, ArrowUp, PiggyBank, TrendUp } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
import { CATEGORY_COLORS, CHART_COLORS } from '@/domain/constants'
import { formatCurrency } from '@/lib/currency'
import { useFinance } from '@/ui/context'

export default function TrendsPage() {
  const { state } = useFinance()

  const years = useMemo(() => {
    const y = new Set<string>()
    for (const t of state.transactions) {
      y.add(t.referenceMonth.slice(0, 4))
    }
    for (const b of state.budgets) {
      y.add(b.referenceMonth.slice(0, 4))
    }
    const currentYear = new Date().getFullYear()
    return Array.from(y)
      .filter((yearStr) => Number(yearStr) <= currentYear)
      .sort()
      .reverse()
  }, [state.transactions, state.budgets])

  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))

  const yearData = useMemo(
    () => yearSummary(state.transactions, Number(selectedYear)),
    [state.transactions, selectedYear],
  )

  const timeSeriesData = useMemo(
    () =>
      categoryTimeSeries(state.transactions, 6) as {
        month: string
        [cat: string]: number | string
      }[],
    [state.transactions],
  )

  const commitmentsData = useMemo(
    () => futureCommitments(state.transactions, 12),
    [state.transactions],
  )

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
    () => budgetVsActualYear(state.transactions, state.budgets, Number(selectedYear)),
    [state.transactions, state.budgets, selectedYear],
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
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data available.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Yearly Trends</h2>
        <Select value={selectedYear} onValueChange={(v) => v && setSelectedYear(v)}>
          <SelectTrigger className="w-28">
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
        <div className="border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowUp className="size-3 text-green-500" />
            Total Income
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(yearData.totalIncome)}
          </div>
        </div>
        <div className="border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowDown className="size-3 text-red-500" />
            Total Expenses
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(yearData.totalExpenses)}
          </div>
        </div>
        <div className="border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PiggyBank className="size-3 text-blue-500" />
            Net Balance
          </div>
          <div
            className={`text-xl font-bold ${yearData.totalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}
          >
            {formatCurrency(yearData.totalBalance)}
          </div>
        </div>
        <div className="border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendUp className="size-3 text-cyan-500" />
            Savings Rate
          </div>
          <div className="text-xl font-bold text-foreground">
            {yearData.totalIncome > 0
              ? `${((yearData.totalBalance / yearData.totalIncome) * 100).toFixed(1)}%`
              : '—'}
          </div>
        </div>
      </div>

      <div className="border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Monthly Income vs Expenses</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearData.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="referenceMonth"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `R$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label: string) => label}
              />
              <Legend wrapperStyle={{ fontSize: '10px', color: 'hsl(var(--foreground))' }} />
              <Bar
                dataKey="income"
                name="Income"
                fill={CHART_COLORS.income}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="expense"
                name="Expenses"
                fill={CHART_COLORS.expense}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Category Trends (6 months)</h3>
          {timeSeriesData.length === 0 || topCategories.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
              Not enough data.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `R$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', color: 'hsl(var(--foreground))' }} />
                  {topCategories.map((cat, i) => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      name={cat}
                      stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Future Credit Commitments</h3>
          {commitmentsData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
              No upcoming credit commitments.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commitmentsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="referenceMonth"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `R$${v}`}
                    domain={commitmentsMax > 0 ? [0, commitmentsMax] : undefined}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar
                    dataKey="total"
                    name="Total"
                    fill={CHART_COLORS.expense}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Year Budget vs Actual</h3>
        {yearlyBudgetVsActual.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
            No budgets set for this year.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyBudgetVsActual}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `R$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ fontSize: '10px', color: 'hsl(var(--foreground))' }} />
                <Bar
                  dataKey="budgeted"
                  name="Budgeted"
                  fill={CHART_COLORS.budgeted}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name="Actual"
                  fill={CHART_COLORS.actual}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
