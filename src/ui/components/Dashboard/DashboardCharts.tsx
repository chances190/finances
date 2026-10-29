import { memo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SpendingPaceResult } from '@/domain/calculations'
import { CHART_COLORS } from '@/domain/constants'
import {
  CHART_AXIS_TICK,
  CHART_LEGEND_STYLE,
  CHART_TOOLTIP_STYLE,
  formatChartAxis,
  formatChartCurrency,
  TODAY_LABEL,
} from './chartTheme'

type PaceChartProps = {
  data: SpendingPaceResult['daily']
  currentDay: number
}

const PaceChart = memo(function PaceChart({ data, currentDay }: PaceChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <ComposedChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" />
        <ReferenceLine
          x={currentDay}
          stroke="var(--muted-foreground)"
          strokeDasharray="2 2"
          label={TODAY_LABEL}
        />
        <XAxis
          dataKey="day"
          minTickGap={24}
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatChartAxis}
        />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatChartCurrency} />
        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
        <Bar dataKey="actual" name="Actual" fill="var(--primary)" opacity={0.45} radius={0} />
        <Line
          type="monotone"
          dataKey="reference"
          name="Daily quota"
          stroke={CHART_COLORS.primary}
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 4"
        />
        <Line
          type="monotone"
          dataKey="trend"
          name="Trend"
          stroke={CHART_COLORS.projection}
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="5 3"
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="suggestion"
          name="Suggestion"
          stroke={CHART_COLORS.suggestion}
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="2 3"
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
})

export const DailyPaceChart = PaceChart
export const CumulativePaceChart = PaceChart

type BudgetVsActualChartProps = {
  data: { category: string; budgeted: number; actual: number }[]
}

export const BudgetVsActualChart = memo(function BudgetVsActualChart({
  data,
}: BudgetVsActualChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" />
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

type PaymentMethodPieProps = {
  data: { name: string; value: number; color: string }[]
}

export const PaymentMethodPie = memo(function PaymentMethodPie({ data }: PaymentMethodPieProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatChartCurrency} />
      </PieChart>
    </ResponsiveContainer>
  )
})
