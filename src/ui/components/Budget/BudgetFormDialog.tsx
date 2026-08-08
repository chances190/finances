import { CopyIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { addMonths } from '@/domain/calculations'
import { DEFAULT_CATEGORIES } from '@/domain/constants'
import type { Budget, Budget as BudgetType } from '@/domain/entities'
import { parseCurrency } from '@/lib/currency'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'

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
    const n = parseCurrency(val)
    if (n > 0) limits[cat] = n
  }
  return {
    referenceMonth: data.referenceMonth,
    plannedIncome: parseCurrency(data.plannedIncome),
    plannedMealVoucher: parseCurrency(data.plannedMealVoucher),
    categoryLimits: limits,
  }
}

function formFromBudget(b: Budget): BudgetFormData {
  const limits: Record<string, string> = {}
  for (const cat of DEFAULT_CATEGORIES) {
    limits[cat] = b.categoryLimits[cat] !== undefined ? String(b.categoryLimits[cat]) : ''
  }
  for (const [k, v] of Object.entries(b.categoryLimits)) {
    if (!(DEFAULT_CATEGORIES as readonly string[]).includes(k)) {
      limits[k] = String(v)
    }
  }
  return {
    referenceMonth: b.referenceMonth,
    plannedIncome: String(b.plannedIncome),
    plannedMealVoucher: String(b.plannedMealVoucher),
    categoryLimits: limits,
  }
}

function monthsBetween(start: string, end: string): string[] {
  const result: string[] = []
  let current = start
  while (current <= end) {
    result.push(current)
    current = addMonths(current, 1)
  }
  return result
}

interface PendingConflict {
  title: string
  message: string
  newMonths: string[]
  toDelete: string[]
  budget: BudgetType
}

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingMonth: string | null
  editingRange: { startMonth: string; endMonth: string } | null
  existingBudget: Budget | undefined
  nextMonth: string
}

export default function BudgetFormDialog({
  open,
  onOpenChange,
  editingMonth,
  editingRange,
  existingBudget,
  nextMonth,
}: BudgetFormDialogProps) {
  const { dispatch, state } = useFinance()
  const { toast } = useToast()

  const [form, setForm] = useState<BudgetFormData>(
    existingBudget ? formFromBudget(existingBudget) : emptyBudget(nextMonth),
  )
  const [rangeEnd, setRangeEnd] = useState(nextMonth)
  const [isRange, setIsRange] = useState(false)
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(existingBudget ? formFromBudget(existingBudget) : emptyBudget(nextMonth))
      if (editingRange) {
        setRangeEnd(editingRange.endMonth)
        setIsRange(editingRange.endMonth > editingRange.startMonth)
      } else {
        setRangeEnd(nextMonth)
        setIsRange(false)
      }
      setPendingConflict(null)
    }
  }, [open, existingBudget, nextMonth, editingRange])

  function handleClone() {
    const sourceMonth = editingMonth
      ? addMonths(editingMonth, -1)
      : addMonths(form.referenceMonth, -1)
    const source = state.budgets.find((b) => b.referenceMonth === sourceMonth)
    if (!source) {
      toast(`No budget found for ${sourceMonth}`, 'error')
      return
    }
    const targetMonth = editingMonth ?? form.referenceMonth
    setForm({ ...formFromBudget(source), referenceMonth: targetMonth })
  }

  function commitSave(months: string[], toDelete: string[], budget: BudgetType) {
    for (const month of months) {
      dispatch({ type: 'UPSERT_BUDGET', payload: { ...budget, referenceMonth: month } })
    }
    for (const month of toDelete) {
      dispatch({ type: 'DELETE_BUDGET', payload: month })
    }
    onOpenChange(false)
  }

  function handleSave() {
    if (!form.referenceMonth) {
      toast('Choose a month first.', 'error')
      return
    }
    const budget = toBudget(form)
    if (
      budget.plannedIncome === 0 &&
      budget.plannedMealVoucher === 0 &&
      Object.keys(budget.categoryLimits).length === 0
    ) {
      toast('Budget has no values — set at least one limit or income.', 'error')
      return
    }
    const newMonths = isRange ? monthsBetween(form.referenceMonth, rangeEnd) : [form.referenceMonth]
    const oldRangeMonths = editingMonth
      ? editingRange
        ? monthsBetween(editingRange.startMonth, editingRange.endMonth)
        : [editingMonth]
      : []
    const removed = isRange ? oldRangeMonths.filter((m) => !newMonths.includes(m)) : []
    const overwritten = newMonths.filter(
      (m) => state.budgets.some((b) => b.referenceMonth === m) && !oldRangeMonths.includes(m),
    )
    const toDelete = [
      ...new Set([
        ...removed,
        ...(editingMonth && !newMonths.includes(editingMonth) ? [editingMonth] : []),
      ]),
    ]

    if (overwritten.length > 0 || toDelete.length > 0) {
      const parts: string[] = []
      if (overwritten.length > 0) {
        parts.push(`overwrite the existing budget for ${overwritten.join(', ')}`)
      }
      if (toDelete.length > 0) {
        parts.push(`remove the budget for ${toDelete.join(', ')}`)
      }
      const title =
        overwritten.length > 0 && toDelete.length > 0
          ? 'Overwrite and remove budgets?'
          : overwritten.length > 0
            ? 'Overwrite budgets?'
            : 'Remove budgets?'
      setPendingConflict({
        title,
        message: `This will ${parts.join(' and ')}. Continue?`,
        newMonths,
        toDelete,
        budget,
      })
      return
    }

    commitSave(newMonths, toDelete, budget)
  }

  function handleAddCategory() {
    if (!newCategoryName.trim()) return
    if (form.categoryLimits[newCategoryName]) {
      toast('Category already exists', 'error')
      return
    }
    setForm((f) => ({
      ...f,
      categoryLimits: { ...f.categoryLimits, [newCategoryName]: '' },
    }))
    setNewCategoryName('')
    setShowAddCategory(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {pendingConflict ? (
          <>
            <DialogHeader>
              <DialogTitle>{pendingConflict.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{pendingConflict.message}</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setPendingConflict(null)}>
                Back
              </Button>
              <Button
                onClick={() => {
                  commitSave(
                    pendingConflict.newMonths,
                    pendingConflict.toDelete,
                    pendingConflict.budget,
                  )
                  setPendingConflict(null)
                }}
              >
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {editingMonth
                  ? editingRange && editingRange.endMonth > editingRange.startMonth
                    ? `Edit Budget: ${editingRange.startMonth} – ${editingRange.endMonth}`
                    : `Edit Budget: ${editingMonth}`
                  : 'New Budget'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Period</Label>
                <SegmentedControl
                  aria-label="Budget period"
                  className="w-full"
                  value={isRange ? 'range' : 'single'}
                  onValueChange={(v) => {
                    const next = v === 'range'
                    setIsRange(next)
                    setRangeEnd((prev) =>
                      next && prev <= form.referenceMonth
                        ? addMonths(form.referenceMonth, 1)
                        : prev,
                    )
                  }}
                  options={[
                    { value: 'single', label: 'Single month' },
                    { value: 'range', label: 'Range of months' },
                  ]}
                />
                {!isRange ? (
                  <div className="space-y-1">
                    <Label htmlFor="budget-month-from" className="text-xs">
                      Reference Month
                    </Label>
                    <Input
                      id="budget-month-from"
                      type="month"
                      value={form.referenceMonth}
                      onChange={(e) => setForm((f) => ({ ...f, referenceMonth: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="budget-month-from" className="text-xs">
                        From
                      </Label>
                      <Input
                        id="budget-month-from"
                        type="month"
                        value={form.referenceMonth}
                        onChange={(e) => setForm((f) => ({ ...f, referenceMonth: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="budget-month-to" className="text-xs">
                        To
                      </Label>
                      <Input
                        id="budget-month-to"
                        type="month"
                        value={rangeEnd}
                        min={form.referenceMonth}
                        onChange={(e) => setRangeEnd(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {isRange && (
                  <div className="text-xs text-muted-foreground">
                    {rangeEnd > form.referenceMonth ? (
                      <span>
                        {editingMonth ? 'Editing' : 'Creating'} budget for{' '}
                        <span className="font-medium text-foreground">
                          {monthsBetween(form.referenceMonth, rangeEnd).length} months
                        </span>{' '}
                        ({form.referenceMonth} – {rangeEnd})
                      </span>
                    ) : (
                      'Set To a later month to create budgets for a range.'
                    )}
                  </div>
                )}
                <div className="flex">
                  <Button variant="outline" size="sm" onClick={handleClone}>
                    <CopyIcon /> Clone from prev
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="budget-income" className="text-xs">
                    Planned Income (R$)
                  </Label>
                  <Input
                    id="budget-income"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.plannedIncome}
                    onChange={(e) => setForm((f) => ({ ...f, plannedIncome: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="budget-mealvoucher" className="text-xs">
                    Meal Voucher (R$)
                  </Label>
                  <Input
                    id="budget-mealvoucher"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.plannedMealVoucher}
                    onChange={(e) => setForm((f) => ({ ...f, plannedMealVoucher: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium">Category Limits</Label>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowAllCategories((s) => !s)}
                    >
                      {showAllCategories ? 'Hide empty' : 'Show all'}
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => setShowAddCategory(true)}>
                      <PlusIcon className="size-3" /> Add Category
                    </Button>
                  </div>
                </div>

                {showAddCategory && (
                  <div className="flex gap-1 mb-2">
                    <Input
                      placeholder="Category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                      autoFocus
                      className="flex-1"
                    />
                    <Button size="sm" onClick={handleAddCategory}>
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddCategory(false)
                        setNewCategoryName('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {Object.keys(form.categoryLimits)
                    .filter((cat) => showAllCategories || form.categoryLimits[cat] !== '')
                    .map((cat) => {
                      const catId = `budget-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`
                      return (
                        <div key={cat} className="space-y-0.5 flex items-end gap-1">
                          <div className="flex-1">
                            <Label htmlFor={catId} className="text-[10px] text-muted-foreground">
                              {cat}
                            </Label>
                            <Input
                              id={catId}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              value={form.categoryLimits[cat]}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  categoryLimits: { ...f.categoryLimits, [cat]: e.target.value },
                                }))
                              }
                            />
                          </div>
                          {!(DEFAULT_CATEGORIES as readonly string[]).includes(cat) && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                const { [cat]: _, ...rest } = form.categoryLimits
                                setForm((f) => ({ ...f, categoryLimits: rest }))
                              }}
                              aria-label={`Remove category ${cat}`}
                            >
                              <TrashIcon className="size-3" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Budget</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
