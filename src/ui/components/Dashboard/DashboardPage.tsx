import { ForkKnifeIcon, PiggyBank, TrendDownIcon, TrendUp } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useLocation, useSearchParams } from 'wouter'
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
  currentYM,
  daysInMonth,
  expensesByMonth,
  groupedByPaymentMethod,
  incomeByPaymentMethod,
  mealVoucherBalance,
  monthRelation,
  type PaceStatus,
  spendingPace,
  totalByMonth,
} from '@/domain/calculations'
import { PAYMENT_METHOD_CHART_COLORS } from '@/domain/constants'
import type { PaymentMethod } from '@/domain/entities'
import { formatCurrency } from '@/lib/currency'
import EmptyState from '@/ui/components/Common/EmptyState'
import LazyChart from '@/ui/components/Common/LazyChart'
import StatCard from '@/ui/components/Common/StatCard'
import { useFinance } from '@/ui/context'
import {
  BudgetVsActualChart,
  CumulativePaceChart,
  DailyPaceChart,
  PaymentMethodPie,
} from './DashboardCharts'

const PACE_STATUS: Record<PaceStatus, { label: string; color: string }> = {
  'on-track': { label: 'On track', color: 'text-green-600' },
  caution: { label: 'Caution', color: 'text-amber-600' },
  ahead: { label: 'Ahead of pace', color: 'text-amber-600' },
  over: { label: 'Over budget', color: 'text-red-600' },
}

export default function DashboardPage() {
  const { state } = useFinance()
  const [, navigate] = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const months = useMemo(() => availableMonths(state.transactions), [state.transactions])

  const nowYM = currentYM()
  const defaultMonth = months.includes(nowYM) ? nowYM : (months[0] ?? '')
  const selectedMonth = searchParams.get('month') ?? defaultMonth

  function setSelectedMonth(month: string) {
    setSearchParams((prev) => {
      if (month === defaultMonth) {
        prev.delete('month')
      } else {
        prev.set('month', month)
      }
      return prev
    })
  }

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
      mealVoucher: mealVoucherBalance(state.transactions, selectedMonth),
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
        name: method,
        value: amount,
        color: PAYMENT_METHOD_CHART_COLORS[method as PaymentMethod],
      }))
  }, [state.transactions, selectedMonth])

  const today = new Date()
  const currentMonth = currentYM(today)
  const monthDays = daysInMonth(selectedMonth || currentMonth)
  const currentDay =
    selectedMonth === currentMonth
      ? Math.min(today.getDate(), monthDays)
      : selectedMonth < currentMonth
        ? monthDays
        : 0

  const pace = useMemo(
    () => spendingPace(state.transactions, budget, currentDay),
    [state.transactions, budget, currentDay],
  )

  const dailyQuota = monthDays > 0 ? pace.limit / monthDays : 0
  const dailyAvg = currentDay > 0 ? pace.spentSoFar / currentDay : 0
  const invested = budget ? budget.plannedIncome * budget.investmentRate : 0
  const paceStatus = PACE_STATUS[pace.status]

  if (!monthData) {
    return (
      <EmptyState
        message="No transaction data available."
        action={{ label: 'Go to Transactions', onClick: () => navigate('/') }}
      />
    )
  }

  return (
    <div className="space-y-4">
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
          valueClassName="font-mono"
        />
        <StatCard
          label="Expenses"
          icon={<TrendDownIcon className="size-3 text-red-500" />}
          value={formatCurrency(monthData.expenses)}
          valueClassName="font-mono"
        />
        <StatCard
          label="Balance"
          icon={<PiggyBank className="size-3 text-muted-foreground" />}
          value={formatCurrency(monthData.balance)}
          valueClassName={`font-mono ${monthData.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}
        />
        <StatCard
          label="Voucher balance"
          icon={<ForkKnifeIcon className="size-3 text-pink-500" />}
          value={formatCurrency(monthData.mealVoucher)}
          valueClassName={`font-mono ${monthData.mealVoucher >= 0 ? 'text-green-500' : 'text-red-500'}`}
        />
      </div>

      {currentDay > 0 && dailyQuota === 0 && (
        <div className="border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendDownIcon className="size-4" />
            <span>
              {budget
                ? 'Add planned income to this budget to see your spending pace.'
                : 'Set a budget to see your spending pace.'}
            </span>
          </div>
        </div>
      )}

      {currentDay > 0 && dailyQuota > 0 && (
        <div className="border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendDownIcon className="size-4" />
              Spending Pace
            </h3>
            <Badge variant="outline" className={paceStatus.color}>
              {paceStatus.label}
            </Badge>
          </div>

          <div>
            <p
              className={`font-mono text-2xl font-bold ${pace.remainingBudget < 0 ? 'text-red-600' : 'text-foreground'}`}
            >
              {formatCurrency(pace.remainingBudget)}
            </p>
            <p className="text-xs text-muted-foreground">Remaining budget</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="font-mono text-base text-violet-500">
                {formatCurrency(pace.suggestionPerDay)}
              </p>
              <p className="text-xs text-muted-foreground">Recommended per day</p>
            </div>
            <div>
              <p className="font-mono text-base text-orange-500">{formatCurrency(dailyAvg)}</p>
              <p className="text-xs text-muted-foreground">Average per day</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-2 w-full bg-muted">
              <div
                className={`h-full ${pace.spentSoFar > pace.limit ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, (pace.spentSoFar / pace.limit) * 100)}%` }}
              />
            </div>
            <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Spent{' '}
                <span className="font-mono text-foreground">{formatCurrency(pace.spentSoFar)}</span>{' '}
                of <span className="font-mono text-foreground">{formatCurrency(pace.limit)}</span>
              </span>
              <span>
                {currentDay}/{monthDays} days
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              (Planned {formatCurrency(pace.totalSalary)} − investments {formatCurrency(invested)})
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Daily (R$)</h4>
            <LazyChart className="h-56">
              <DailyPaceChart data={pace.daily} currentDay={currentDay} />
            </LazyChart>
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Cumulative (R$)</h4>
            <LazyChart className="h-56">
              <CumulativePaceChart data={pace.cumulative} currentDay={currentDay} />
            </LazyChart>
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
            <LazyChart className="h-64">
              <BudgetVsActualChart data={budgetVsActualData} />
            </LazyChart>
          )}
        </div>

        <div className="border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Expense payment methods</h3>
          {paymentMethodData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
              No expenses this month.
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <LazyChart className="h-48 w-full">
                <PaymentMethodPie data={paymentMethodData} />
              </LazyChart>
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
                    {entry.name}: <span className="font-mono">{formatCurrency(entry.value)}</span>
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
