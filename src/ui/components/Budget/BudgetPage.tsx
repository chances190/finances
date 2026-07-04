import { CopyIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { addMonths } from '@/domain/calculations'
import { DEFAULT_CATEGORIES } from '@/domain/constants'
import type { Budget as BudgetType } from '@/domain/entities'
import { useFinance } from '@/ui/context'

interface BudgetFormData {
  referenceMonth: string
  plannedIncome: string
  plannedMealVoucher: string
  categoryLimits: Record<string, string>
}

function emptyBudget(refMonth: string): BudgetFormData {
  return {
    referenceMonth: refMonth,
    plannedIncome: '',
    plannedMealVoucher: '',
    categoryLimits: Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c, ''])),
  }
}

function toBudget(data: BudgetFormData): BudgetType {
  const limits: Record<string, number> = {}
  for (const [cat, val] of Object.entries(data.categoryLimits)) {
    const n = parseFloat(val)
    if (n > 0) limits[cat] = n
  }
  return {
    referenceMonth: data.referenceMonth,
    plannedIncome: parseFloat(data.plannedIncome) || 0,
    plannedMealVoucher: parseFloat(data.plannedMealVoucher) || 0,
    categoryLimits: limits,
  }
}

function formatCurrency(n: number): string {
  return `R$ ${n.toFixed(2)}`
}

export default function BudgetPage() {
  const { state, dispatch } = useFinance()
  const [showForm, setShowForm] = useState(false)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...state.budgets].sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth)),
    [state.budgets],
  )

  const existingBudget = editingMonth
    ? state.budgets.find((b) => b.referenceMonth === editingMonth)
    : null

  const initialFormData = (): BudgetFormData => {
    if (existingBudget) {
      return {
        referenceMonth: existingBudget.referenceMonth,
        plannedIncome: String(existingBudget.plannedIncome),
        plannedMealVoucher: String(existingBudget.plannedMealVoucher),
        categoryLimits: Object.fromEntries(
          Object.entries(existingBudget.categoryLimits).map(([k, v]) => [k, String(v)]),
        ),
      }
    }
    return emptyBudget(editingMonth ?? new Date().toISOString().slice(0, 7))
  }

  const [form, setForm] = useState<BudgetFormData>(initialFormData)

  function openNew() {
    const nextMonth =
      sorted.length > 0
        ? addMonths(sorted[0].referenceMonth, 1)
        : new Date().toISOString().slice(0, 7)
    setEditingMonth(null)
    setForm(emptyBudget(nextMonth))
    setShowForm(true)
  }

  function openEdit(month: string) {
    setEditingMonth(month)
    const budget = state.budgets.find((b) => b.referenceMonth === month)
    if (budget) {
      setForm({
        referenceMonth: budget.referenceMonth,
        plannedIncome: String(budget.plannedIncome),
        plannedMealVoucher: String(budget.plannedMealVoucher),
        categoryLimits: Object.fromEntries(
          Object.entries(budget.categoryLimits).map(([k, v]) => [k, String(v)]),
        ),
      })
    }
    setShowForm(true)
  }

  function handleClone() {
    const sourceMonth = editingMonth
      ? addMonths(editingMonth, -1)
      : addMonths(form.referenceMonth, -1)
    const source = state.budgets.find((b) => b.referenceMonth === sourceMonth)
    if (!source) {
      alert(`No budget found for ${sourceMonth}`)
      return
    }
    setForm({
      referenceMonth: editingMonth ?? form.referenceMonth,
      plannedIncome: String(source.plannedIncome),
      plannedMealVoucher: String(source.plannedMealVoucher),
      categoryLimits: Object.fromEntries(
        Object.entries(source.categoryLimits).map(([k, v]) => [k, String(v)]),
      ),
    })
  }

  function handleSave() {
    const budget = toBudget(form)
    dispatch({ type: 'UPSERT_BUDGET', payload: budget })
    setShowForm(false)
    setEditingMonth(null)
  }

  function handleDelete(month: string) {
    if (confirm(`Delete budget for ${month}?`)) {
      dispatch({ type: 'DELETE_BUDGET', payload: month })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Budgets</h2>
        <Button size="sm" onClick={openNew}>
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
              <TableRow key={b.referenceMonth} className="cursor-pointer" onClick={() => openEdit(b.referenceMonth)}>
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
                      onClick={(e) => { e.stopPropagation(); openEdit(b.referenceMonth) }}
                    >
                      <PencilSimpleIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => { e.stopPropagation(); handleDelete(b.referenceMonth) }}
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMonth ? `Edit Budget: ${editingMonth}` : 'New Budget'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Reference Month</Label>
                <Input
                  type="month"
                  value={form.referenceMonth}
                  onChange={(e) => setForm({ ...form, referenceMonth: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={handleClone}>
                  <CopyIcon /> Clone from prev
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Planned Income (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.plannedIncome}
                  onChange={(e) => setForm({ ...form, plannedIncome: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meal Voucher (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.plannedMealVoucher}
                  onChange={(e) => setForm({ ...form, plannedMealVoucher: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Category Limits</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {Object.keys(form.categoryLimits).map((cat) => (
                  <div key={cat} className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">{cat}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={form.categoryLimits[cat]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          categoryLimits: { ...form.categoryLimits, [cat]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Budget</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
