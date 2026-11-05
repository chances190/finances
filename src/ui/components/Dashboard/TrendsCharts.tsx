import { memo } from 'react'
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
import type { FutureCommitment } from '@/domain/calculations'
import { CATEGORY_COLORS, CHART_COLORS } from '@/domain/constants'
import {
  CHART_AXIS_TICK,
  CHART_LEGEND_STYLE,
  CHART_TOOLTIP_STYLE,
  formatChartAxis,
  formatChartCurrency,
  formatMonthTick,
} from './chartTheme'

type MonthlyIncomeExpenseChartProps = {
  data: { referenceMonth: string; income: number; expenses: number; balance: number }[]
}

export const MonthlyIncomeExpenseChart = memo(function MonthlyIncomeExpenseChart({
  data,
}: MonthlyIncomeExpenseChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="referenceMonth"
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatMonthTick}
        />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatChartAxis}
        />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatChartCurrency} />
        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
        <Bar dataKey="income" name="Income" fill={CHART_COLORS.income} radius={[2, 2, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.expense} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})

type CategoryTrendsChartProps = {
  data: { month: string; [category: string]: number | string }[]
  categories: string[]
}

export const CategoryTrendsChart = memo(function CategoryTrendsChart({
  data,
  categories,
}: CategoryTrendsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatChartAxis}
        />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatChartCurrency} />
        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
        {categories.map((category, index) => (
          <Line
            key={category}
            type="monotone"
            dataKey={category}
            name={category}
            stroke={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
})

type FutureCommitmentsChartProps = {
  data: FutureCommitment[]
  max: number
}

export const FutureCommitmentsChart = memo(function FutureCommitmentsChart({
  data,
  max,
}: FutureCommitmentsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="referenceMonth" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatChartAxis}
          domain={max > 0 ? [0, max] : undefined}
          allowDataOverflow
        />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatChartCurrency} />
        <Bar dataKey="total" name="Total" fill={CHART_COLORS.expense} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})

type YearBudgetVsActualChartProps = {
  data: { category: string; budgeted: number; actual: number }[]
}

export const YearBudgetVsActualChart = memo(function YearBudgetVsActualChart({
  data,
}: YearBudgetVsActualChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="category" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatChartAxis}
        />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatChartCurrency} />
        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
        <Bar
          dataKey="budgeted"
          name="Budgeted"
          fill={CHART_COLORS.budgeted}
          radius={[2, 2, 0, 0]}
        />
        <Bar dataKey="actual" name="Actual" fill={CHART_COLORS.actual} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})
