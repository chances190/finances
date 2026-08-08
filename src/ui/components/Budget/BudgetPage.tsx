import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
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
import { useFinance } from '@/ui/context'
import BudgetFormDialog from './BudgetFormDialog'

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

  const existingBudget = editingMonth
    ? state.budgets.find((b) => b.referenceMonth === editingMonth)
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

      <div className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Planned Income</TableHead>
              <TableHead className="text-right">Meal Voucher</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranges.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No budgets yet. Create one to start planning.
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
                  className="cursor-pointer"
                  onClick={() => openEdit(range)}
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
                      {Object.entries(range.budget.categoryLimits).map(([cat, val]) => (
                        <span key={cat} className="text-xs bg-muted px-1.5 py-0.5">
                          {cat}: {formatCurrency(val)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(range)
                        }}
                        aria-label="Edit budget"
                      >
                        <PencilSimpleIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(range)
                        }}
                        aria-label="Delete budget"
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

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
          }
        }}
      />
    </div>
  )
}
