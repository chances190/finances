import { PlusIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  addMonths,
  type BudgetRange,
  currentYM,
  groupBudgetsByRange,
  monthRelation,
} from '@/domain/calculations'
import { formatCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import EmptyState from '@/ui/components/Common/EmptyState'
import { useFinance } from '@/ui/context'
import { useIsDesktop } from '@/ui/hooks/useIsDesktop'
import BudgetFormDialog from './BudgetFormDialog'

function BudgetCard({
  range,
  currentMonth,
  onEdit,
}: {
  range: BudgetRange
  currentMonth: string
  onEdit: () => void
}) {
  const label =
    range.months.length > 1 ? `${range.startMonth} – ${range.endMonth}` : range.startMonth
  const rel = range.months.includes(currentMonth) ? 'current' : monthRelation(range.startMonth)

  return (
    <button
      type="button"
      onClick={onEdit}
      className="block w-full px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${rel === 'current' ? 'text-primary' : ''}`}>
            {label}
          </p>
          {range.months.length > 1 && (
            <p className="text-[10px] text-muted-foreground">{range.months.length} months</p>
          )}
        </div>
        {rel === 'current' && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Current
          </Badge>
        )}
        {rel === 'future' && (
          <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
            Future
          </Badge>
        )}
      </div>

      <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Planned Income</span>
          <span className="font-mono">{formatCurrency(range.budget.plannedIncome)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Meal Voucher</span>
          <span className="font-mono">{formatCurrency(range.budget.plannedMealVoucher)}</span>
        </div>
      </div>

      {Object.entries(range.budget.categoryLimits).some(([, val]) => val > 0) && (
        <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2">
          {Object.entries(range.budget.categoryLimits)
            .filter(([, val]) => val > 0)
            .map(([cat, val]) => (
              <div key={cat} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">{cat}</span>
                <span className="font-mono">{formatCurrency(val)}</span>
              </div>
            ))}
        </div>
      )}
    </button>
  )
}

export default function BudgetPage() {
  const { state, dispatch } = useFinance()
  const [showForm, setShowForm] = useState(false)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [editingRange, setEditingRange] = useState<{ startMonth: string; endMonth: string } | null>(
    null,
  )
  const [confirmDeleteRange, setConfirmDeleteRange] = useState<BudgetRange | null>(null)

  const sorted = useMemo(
    () => [...state.budgets].sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth)),
    [state.budgets],
  )

  const currentMonth = currentYM()
  const ranges = useMemo(() => groupBudgetsByRange(state.budgets).reverse(), [state.budgets])
  const isDesktop = useIsDesktop()

  const existingBudget = editingMonth
    ? state.budgets.find((b) => b.referenceMonth === editingMonth)
    : undefined
  const editingBudgetRange = editingRange
    ? ranges.find((range) => range.startMonth === editingRange.startMonth)
    : undefined

  const nextMonth = sorted.length > 0 ? addMonths(sorted[0].referenceMonth, 1) : currentYM()

  function handleDelete(range: BudgetRange) {
    setConfirmDeleteRange(range)
  }

  function openEdit(range: BudgetRange) {
    setEditingMonth(range.startMonth)
    setEditingRange({ startMonth: range.startMonth, endMonth: range.endMonth })
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Budgets</h2>
        <Button
          size="sm"
          className="h-10 text-xs sm:h-7"
          onClick={() => {
            setEditingMonth(null)
            setEditingRange(null)
            setShowForm(true)
          }}
        >
          <PlusIcon /> New Budget
        </Button>
      </div>

      {isDesktop && (
        <div className="border border-border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-72">Period</TableHead>
                <TableHead className="w-48 text-right">Planned Income</TableHead>
                <TableHead className="w-48 text-right">Meal Voucher</TableHead>
                <TableHead className="pl-6">Categories</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      variant="cell"
                      message="No budgets yet. Create one to start planning."
                    />
                  </TableCell>
                </TableRow>
              )}
              {ranges.map((range) => {
                const label =
                  range.months.length > 1
                    ? `${range.startMonth} – ${range.endMonth}`
                    : range.startMonth
                const rel = range.months.includes(currentMonth)
                  ? 'current'
                  : monthRelation(range.startMonth)
                return (
                  <TableRow
                    key={range.startMonth}
                    className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    tabIndex={0}
                    onClick={() => openEdit(range)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' '))
                        return
                      e.preventDefault()
                      openEdit(range)
                    }}
                  >
                    <TableCell className={`font-medium ${rel === 'current' ? 'text-primary' : ''}`}>
                      {label}
                      {range.months.length > 1 && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          · {range.months.length} months
                        </span>
                      )}
                      {rel === 'current' && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Current
                        </Badge>
                      )}
                      {rel === 'future' && (
                        <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">
                          Future
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(range.budget.plannedIncome)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(range.budget.plannedMealVoucher)}
                    </TableCell>
                    <TableCell className="pl-6">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(range.budget.categoryLimits)
                          .filter(([, val]) => val > 0)
                          .map(([cat, val]) => (
                            <span key={cat} className="text-xs bg-muted px-1.5 py-0.5">
                              {cat}: {formatCurrency(val)}
                            </span>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!isDesktop && (
        <div className="divide-y divide-border border border-border">
          {ranges.length === 0 ? (
            <EmptyState message="No budgets yet. Create one to start planning." />
          ) : (
            ranges.map((range) => (
              <BudgetCard
                key={range.startMonth}
                range={range}
                currentMonth={currentMonth}
                onEdit={() => openEdit(range)}
              />
            ))
          )}
        </div>
      )}

      {showForm && (
        <BudgetFormDialog
          open
          onOpenChange={(o) => {
            setShowForm(o)
            if (!o) {
              setEditingMonth(null)
              setEditingRange(null)
            }
          }}
          editingMonth={editingMonth}
          editingRange={editingRange}
          existingBudget={existingBudget}
          nextMonth={nextMonth}
          onDelete={() => editingBudgetRange && handleDelete(editingBudgetRange)}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteRange !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDeleteRange(null)
        }}
        title="Delete Budget"
        message={
          confirmDeleteRange
            ? confirmDeleteRange.months.length > 1
              ? `Delete budget for ${confirmDeleteRange.startMonth} – ${confirmDeleteRange.endMonth}? This will remove the budget for ${confirmDeleteRange.months.length} months.`
              : `Delete budget for ${confirmDeleteRange.startMonth}?`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDeleteRange) {
            for (const month of confirmDeleteRange.months) {
              dispatch({ type: 'DELETE_BUDGET', payload: month })
            }
            setConfirmDeleteRange(null)
            setShowForm(false)
            setEditingMonth(null)
            setEditingRange(null)
          }
        }}
      />
    </div>
  )
}
