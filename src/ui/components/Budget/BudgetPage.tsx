import { PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react'
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
      className="block w-full p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-center gap-2">
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${rel === 'current' ? 'text-primary' : ''}`}
        >
          {label}
        </span>
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
        <PencilSimpleIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      {range.months.length > 1 && (
        <p className="mt-1 text-[10px] text-muted-foreground">· {range.months.length} months</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Planned Income</p>
          <p className="text-right font-mono text-sm">
            {formatCurrency(range.budget.plannedIncome)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Meal Voucher</p>
          <p className="text-right font-mono text-sm">
            {formatCurrency(range.budget.plannedMealVoucher)}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1">
        {Object.entries(range.budget.categoryLimits)
          .filter(([, val]) => val > 0)
          .map(([cat, val]) => (
            <span
              key={cat}
              className="flex items-baseline justify-between gap-1 bg-muted px-1.5 py-0.5 text-xs"
            >
              <span className="truncate">{cat}</span>
              <span className="font-mono">{formatCurrency(val)}</span>
            </span>
          ))}
      </div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Planned Income</TableHead>
                <TableHead className="text-right">Meal Voucher</TableHead>
                <TableHead>Categories</TableHead>
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
                    <TableCell>
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
        <div className="space-y-2">
          {ranges.length === 0 ? (
            <EmptyState message="No budgets yet. Create one to start planning." />
          ) : (
            ranges.map((range) => (
              <div key={range.startMonth} className="border border-border">
                <BudgetCard
                  range={range}
                  currentMonth={currentMonth}
                  onEdit={() => openEdit(range)}
                />
              </div>
            ))
          )}
        </div>
      )}

      <BudgetFormDialog
        open={showForm}
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
