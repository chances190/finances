import {
  CreditCard,
  CurrencyDollar,
  ForkKnife,
  PiggyBank,
  TrendDown,
  TrendUp,
} from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  availableMonths,
  budgetVsActual,
  cashExpenses,
  creditInvoice,
  currentYM,
  expensesByMonth,
  groupedByPaymentMethod,
  incomeByMonth,
  incomeByPaymentMethod,
  mealVoucherBalance,
  monthRelation,
  spendingPace,
  totalByMonth,
} from '@/domain/calculations'
import {
  CHART_COLORS,
  DAYS_IN_MONTH,
  PAYMENT_METHOD_CHART_COLORS,
  PAYMENT_METHOD_LABELS,
} from '@/domain/constants'
import { monthlyFlows } from '@/domain/entities'
import { formatCurrency } from '@/lib/currency'
import EmptyState from '@/ui/components/Common/EmptyState'
import StatCard from '@/ui/components/Common/StatCard'
import { useFinance } from '@/ui/context'

export default function DashboardPage() {
  const { state } = useFinance()

  const months = useMemo(() => availableMonths(state.transactions), [state.transactions])

  const nowYM = currentYM()
  const [selectedMonth, setSelectedMonth] = useState(
    months.includes(nowYM) ? nowYM : (months[0] ?? ''),
  )

  const budget = useMemo(
    () => state.budgets.find((b) => b.referenceMonth === selectedMonth),
    [state.budgets, selectedMonth],
  )

  const monthData = useMemo(() => {
    if (!selectedMonth) return null
    const income = totalByMonth(state.transactions, selectedMonth)
    const expenses = expensesByMonth(state.transactions, selectedMonth)
    return {
      income,
      expenses,
      balance: income - expenses,
      creditInvoice: creditInvoice(state.transactions, selectedMonth),
      cashExpenses: cashExpenses(state.transactions, selectedMonth),
      mealVoucher: mealVoucherBalance(state.transactions, selectedMonth),
      incomeTransactions: incomeByMonth(state.transactions, selectedMonth),
      incomeByMethod: incomeByPaymentMethod(state.transactions, selectedMonth),
    }
  }, [state.transactions, selectedMonth])

  const budgetVsActualData = useMemo(
    () => budgetVsActual(state.transactions, budget),
    [state.transactions, budget],
  )

  const paymentMethodData = useMemo(() => {
    if (!selectedMonth) return []
    const grouped = groupedByPaymentMethod(state.transactions, selectedMonth)
    return Object.entries(grouped)
      .filter(([, v]) => v > 0)
      .map(([method, amount]) => ({
        name: PAYMENT_METHOD_LABELS[method] ?? method,
        value: amount,
        color: PAYMENT_METHOD_CHART_COLORS[method] ?? '#6b7280',
      }))
  }, [state.transactions, selectedMonth])

  const today = new Date()
  const currentMonth = currentYM(today)
  const currentDay =
    selectedMonth === currentMonth
      ? Math.min(today.getDate(), DAYS_IN_MONTH)
      : selectedMonth < currentMonth
        ? DAYS_IN_MONTH
        : 0

  const pace = useMemo(
    () => spendingPace(state.transactions, budget, currentDay),
    [state.transactions, budget, currentDay],
  )

  const dailyQuota = pace.totalSalary > 0 ? pace.limit / DAYS_IN_MONTH : 0

  const spentSoFar = useMemo(() => {
    if (!selectedMonth) return 0
    return state.transactions
      .filter((t) => {
        if (t.type !== 'EXPENSE') return false
        const hasUnsettledDebt = t.debts?.some((d) => !d.settled) ?? false
        const flows = monthlyFlows(t)
        return flows.some((f) => f.referenceMonth === selectedMonth) && !hasUnsettledDebt
      })
      .reduce((s, t) => s + t.amount, 0)
  }, [state.transactions, selectedMonth])

  const paceStatus = useMemo(() => {
    if (currentDay === 0) return { label: 'No data', color: 'text-muted-foreground' }
    const avgDay = spentSoFar / currentDay
    if (dailyQuota === 0) return { label: 'No budget set', color: 'text-muted-foreground' }
    if (avgDay <= dailyQuota * 1.05) return { label: 'On track', color: 'text-green-500' }
    if (avgDay <= dailyQuota * 1.2) return { label: 'Caution', color: 'text-yellow-500' }
    return { label: 'Over budget', color: 'text-red-500' }
  }, [currentDay, spentSoFar, dailyQuota])

  const dailyAvg = currentDay > 0 ? spentSoFar / currentDay : 0

  if (!monthData) {
    return <EmptyState message="No transaction data available." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Monthly Dashboard</h2>
        <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => {
              const rel = monthRelation(m)
              return (
                <SelectItem
                  key={m}
                  value={m}
                  className={
                    rel === 'future'
                      ? 'text-muted-foreground/60'
                      : rel === 'current'
                        ? 'text-primary font-medium'
                        : ''
                  }
                >
                  {m}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Income"
          icon={<TrendUp className="size-3 text-green-500" />}
          value={formatCurrency(monthData.income)}
        />
        <StatCard
          label="Expenses"
          icon={<TrendDown className="size-3 text-red-500" />}
          value={formatCurrency(monthData.expenses)}
        />
        <StatCard
          label="Balance"
          icon={<PiggyBank className="size-3 text-blue-500" />}
          value={formatCurrency(monthData.balance)}
          valueClassName={monthData.balance >= 0 ? 'text-green-500' : 'text-red-500'}
        />
        <StatCard
          label="Credit card"
          icon={<CreditCard className="size-3 text-orange-500" />}
          value={formatCurrency(monthData.creditInvoice)}
        />
        <StatCard
          label="Meal Voucher"
          icon={<ForkKnife className="size-3 text-purple-500" />}
          value={formatCurrency(monthData.mealVoucher)}
          valueClassName={monthData.mealVoucher >= 0 ? 'text-green-500' : 'text-red-500'}
        />
        <StatCard
          label="Cash spent"
          icon={<CurrencyDollar className="size-3 text-cyan-500" />}
          value={formatCurrency(monthData.cashExpenses)}
        />
      </div>

      {monthData.income > 0 && Object.keys(monthData.incomeByMethod).length > 0 && (
        <div className="border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">Income by Account</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(monthData.incomeByMethod).map(([method, amount]) => (
              <div key={method} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: PAYMENT_METHOD_CHART_COLORS[method] ?? '#6b7280' }}
                />
                <span className="text-muted-foreground text-xs">
                  {PAYMENT_METHOD_LABELS[method] ?? method}:
                </span>
                <span className="font-mono text-xs font-medium">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentDay > 0 && dailyQuota === 0 && (
        <div className="border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendDown className="size-4" />
            <span>Set a budget to see your spending pace.</span>
          </div>
        </div>
      )}

      {currentDay > 0 && dailyQuota > 0 && (
        <div className="border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendDown className="size-4" />
              Spending Pace — Day {currentDay}/{DAYS_IN_MONTH}
            </h3>
            <Badge variant="outline" className={paceStatus.color}>
              {paceStatus.label}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <StatCard
              label="Daily quota"
              value={formatCurrency(dailyQuota)}
              valueClassName="text-lg text-blue-500"
              className="p-3"
            />
            <StatCard
              label="Avg / day"
              value={formatCurrency(dailyAvg)}
              valueClassName={
                dailyAvg <= dailyQuota * 1.05 ? 'text-lg text-green-500' : 'text-lg text-red-500'
              }
              className="p-3"
            />
            <StatCard
              label="Remaining"
              value={formatCurrency(pace.limit - spentSoFar)}
              valueClassName="text-lg text-blue-500"
              className="p-3"
            />
            <StatCard
              label="Suggestion"
              value={formatCurrency(pace.suggestionPerDay)}
              valueClassName="text-lg text-green-500"
              className="p-3"
            />
            <StatCard
              label="Total limit"
              value={formatCurrency(pace.limit)}
              valueClassName="text-lg text-muted-foreground"
              className="p-3"
            />
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Daily (R$)</h4>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pace.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `R$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--foreground)' }} />
                  <Bar
                    dataKey="actual"
                    name="Actual"
                    fill="var(--primary)"
                    opacity={0.6}
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="reference"
                    name="Reference"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="sesProjection"
                    name="Projection (SES)"
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
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Cumulative (R$)</h4>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pace.cumulative}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `R$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--foreground)' }} />
                  <Bar
                    dataKey="actual"
                    name="Actual"
                    fill="var(--primary)"
                    opacity={0.6}
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="reference"
                    name="Reference"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="sesProjection"
                    name="Projection (SES)"
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
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Budget vs Actual</h3>
          {budgetVsActualData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
              No budget set for this month.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetVsActualData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `R$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--foreground)' }} />
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

        <div className="border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Payment Methods</h3>
          {paymentMethodData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
              No expenses this month.
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {paymentMethodData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        color: 'var(--foreground)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {paymentMethodData.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ background: entry.color }}
                    />
                    {entry.name}: {formatCurrency(entry.value)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
