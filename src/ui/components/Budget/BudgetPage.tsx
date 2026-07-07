import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { addMonths } from '@/domain/calculations'
import { formatCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import { useFinance } from '@/ui/context'
import BudgetFormDialog from './BudgetFormDialog'

export default function BudgetPage() {
  const { state, dispatch } = useFinance()
  const [showForm, setShowForm] = useState(false)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...state.budgets].sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth)),
    [state.budgets],
  )

  const existingBudget = editingMonth
    ? state.budgets.find((b) => b.referenceMonth === editingMonth)
    : undefined

  const nextMonth =
    sorted.length > 0
      ? addMonths(sorted[0].referenceMonth, 1)
      : new Date().toISOString().slice(0, 7)

  function handleDelete(month: string) {
    setConfirmDeleteMonth(month)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Budgets</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingMonth(null)
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
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Planned Income</TableHead>
              <TableHead className="text-right">Meal Voucher</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No budgets yet. Create one to start planning.
                </TableCell>
              </TableRow>
            )}
            {sorted.map((b) => (
              <TableRow
                key={b.referenceMonth}
                className="cursor-pointer"
                onClick={() => {
                  setEditingMonth(b.referenceMonth)
                  setShowForm(true)
                }}
              >
                <TableCell className="font-medium">{b.referenceMonth}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(b.plannedIncome)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(b.plannedMealVoucher)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(b.categoryLimits).map(([cat, val]) => (
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
                        setEditingMonth(b.referenceMonth)
                        setShowForm(true)
                      }}
                    >
                      <PencilSimpleIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(b.referenceMonth)
                      }}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BudgetFormDialog
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o)
          if (!o) setEditingMonth(null)
        }}
        editingMonth={editingMonth}
        existingBudget={existingBudget}
        nextMonth={nextMonth}
      />

      <ConfirmDialog
        open={confirmDeleteMonth !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDeleteMonth(null)
        }}
        title="Delete Budget"
        message={confirmDeleteMonth ? `Delete budget for ${confirmDeleteMonth}?` : ''}
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDeleteMonth) {
            dispatch({ type: 'DELETE_BUDGET', payload: confirmDeleteMonth })
            setConfirmDeleteMonth(null)
          }
        }}
      />
    </div>
  )
}
