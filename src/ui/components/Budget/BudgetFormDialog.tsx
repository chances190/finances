import { CopyIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { addMonths } from '@/domain/calculations'
import { budgetCategoryNames, budgetForMonth } from '@/domain/categories'
import { DEFAULT_INVESTMENT_RATE } from '@/domain/constants'
import type { Budget, Budget as BudgetType } from '@/domain/entities'
import { addCurrency, formatCurrency, formatPlainCurrency, parseCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'

interface BudgetFormData {
  referenceMonth: string
  plannedIncome: string
  plannedMealVoucher: string
  investmentRate: string
  categoryLimits: Record<string, string>
}

function formatPercent(rate: number): string {
  return String(Math.round(rate * 1000) / 10)
}

function parsePercent(value: string): number {
  return Math.min(100, Math.max(0, parseCurrency(value))) / 100
}

function emptyBudget(refMonth: string, budgets: Budget[]): BudgetFormData {
  const source = budgetForMonth(refMonth, budgets)
  const categoryLimits: Record<string, string> = {}
  if (source) {
    for (const name of budgetCategoryNames(source)) categoryLimits[name] = ''
  }
  return {
    referenceMonth: refMonth,
    plannedIncome: '',
    plannedMealVoucher: '',
    investmentRate: formatPercent(DEFAULT_INVESTMENT_RATE),
    categoryLimits,
  }
}

function toBudget(data: BudgetFormData): BudgetType {
  const limits: Record<string, number> = {}
  for (const [category, value] of Object.entries(data.categoryLimits)) {
    limits[category] = parseCurrency(value)
  }
  return {
    referenceMonth: data.referenceMonth,
    plannedIncome: parseCurrency(data.plannedIncome),
    plannedMealVoucher: parseCurrency(data.plannedMealVoucher),
    investmentRate: parsePercent(data.investmentRate),
    categoryLimits: limits,
  }
}

function formFromBudget(b: Budget): BudgetFormData {
  const limits: Record<string, string> = {}
  for (const [cat, value] of Object.entries(b.categoryLimits)) {
    limits[cat] = value === 0 ? '' : formatPlainCurrency(value)
  }
  return {
    referenceMonth: b.referenceMonth,
    plannedIncome: formatPlainCurrency(b.plannedIncome),
    plannedMealVoucher: formatPlainCurrency(b.plannedMealVoucher),
    investmentRate: formatPercent(b.investmentRate),
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
  onDelete: () => void
  editingMonth: string | null
  editingRange: { startMonth: string; endMonth: string } | null
  existingBudget: Budget | undefined
  nextMonth: string
}

export default function BudgetFormDialog({
  open,
  onOpenChange,
  onDelete,
  editingMonth,
  editingRange,
  existingBudget,
  nextMonth,
}: BudgetFormDialogProps) {
  const { dispatch, state } = useFinance()
  const { toast } = useToast()

  const [form, setForm] = useState<BudgetFormData>(() =>
    existingBudget ? formFromBudget(existingBudget) : emptyBudget(nextMonth, state.budgets),
  )
  const [rangeEnd, setRangeEnd] = useState(nextMonth)
  const [isRange, setIsRange] = useState(false)
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)

  const categoryRows = Object.keys(form.categoryLimits)

  const draftBudget = toBudget(form)
  const categoryTotal = Object.values(draftBudget.categoryLimits).reduce(addCurrency, 0)
  const plannedTotal = addCurrency(
    draftBudget.plannedIncome * (1 - draftBudget.investmentRate),
    draftBudget.plannedMealVoucher,
  )
  const budgetOverage = Math.max(0, addCurrency(categoryTotal, -plannedTotal))
  const investedAmount = draftBudget.plannedIncome * draftBudget.investmentRate

  useEffect(() => {
    if (open) {
      setForm(
        existingBudget ? formFromBudget(existingBudget) : emptyBudget(nextMonth, state.budgets),
      )
      if (editingRange) {
        setRangeEnd(editingRange.endMonth)
        setIsRange(editingRange.endMonth > editingRange.startMonth)
      } else {
        setRangeEnd(nextMonth)
        setIsRange(false)
      }
      setPendingConflict(null)
      setShowAddCategory(false)
      setNewCategoryName('')
    }
  }, [open, existingBudget, nextMonth, editingRange, state.budgets])

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

  function handleAddCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    if (name in form.categoryLimits) {
      toast('Category already exists', 'error')
      return
    }
    setForm((f) => ({ ...f, categoryLimits: { ...f.categoryLimits, [name]: '' } }))
    setNewCategoryName('')
    setShowAddCategory(false)
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
      Object.values(budget.categoryLimits).every((value) => value === 0)
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
    const removed = oldRangeMonths.filter((m) => !newMonths.includes(m))
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
        message: `This will ${parts.join(' and ')}.`,
        newMonths,
        toDelete,
        budget,
      })
      return
    }

    commitSave(newMonths, toDelete, budget)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
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
                    next && prev <= form.referenceMonth ? addMonths(form.referenceMonth, 1) : prev,
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
                    type="date"
                    value={form.referenceMonth ? `${form.referenceMonth}-01` : ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, referenceMonth: e.target.value.slice(0, 7) }))
                    }
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
                      type="date"
                      value={form.referenceMonth ? `${form.referenceMonth}-01` : ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, referenceMonth: e.target.value.slice(0, 7) }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="budget-month-to" className="text-xs">
                      To
                    </Label>
                    <Input
                      id="budget-month-to"
                      type="date"
                      value={rangeEnd ? `${rangeEnd}-01` : ''}
                      min={form.referenceMonth ? `${form.referenceMonth}-01` : undefined}
                      onChange={(e) => setRangeEnd(e.target.value.slice(0, 7))}
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
                      </span>
                    </span>
                  ) : (
                    'Choose an end month after the start month.'
                  )}
                </div>
              )}
              <div className="flex">
                <Button variant="outline" size="sm" onClick={handleClone}>
                  <CopyIcon /> Copy previous budget
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="budget-income" className="text-xs">
                  Planned Income (R$)
                </Label>
                <MoneyInput
                  id="budget-income"
                  value={form.plannedIncome}
                  onValueChange={(plannedIncome) => setForm((f) => ({ ...f, plannedIncome }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budget-mealvoucher" className="text-xs">
                  Meal Voucher (R$)
                </Label>
                <MoneyInput
                  id="budget-mealvoucher"
                  value={form.plannedMealVoucher}
                  onValueChange={(plannedMealVoucher) =>
                    setForm((f) => ({ ...f, plannedMealVoucher }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="budget-investment" className="text-xs">
                  Investments (%)
                </Label>
                <Input
                  id="budget-investment"
                  type="text"
                  inputMode="decimal"
                  value={form.investmentRate}
                  onChange={(e) => setForm((f) => ({ ...f, investmentRate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invested</Label>
                <div className="flex h-10 items-center border border-border bg-muted/30 px-2.5 font-mono text-xs sm:h-8">
                  {formatCurrency(investedAmount)}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2">
                <Label className="text-xs font-medium">Category Limits</Label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {categoryRows.map((cat) => {
                  const catId = `budget-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`
                  return (
                    <div key={cat} className="space-y-0.5 flex items-end gap-1">
                      <div className="flex-1">
                        <Label htmlFor={catId} className="text-[10px] text-muted-foreground">
                          {cat}
                        </Label>
                        <MoneyInput
                          id={catId}
                          placeholder="0"
                          value={form.categoryLimits[cat] ?? ''}
                          onValueChange={(limit) =>
                            setForm((f) => ({
                              ...f,
                              categoryLimits: { ...f.categoryLimits, [cat]: limit },
                            }))
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          const { [cat]: _, ...rest } = form.categoryLimits
                          setForm((f) => ({ ...f, categoryLimits: rest }))
                        }}
                        aria-label={`Remove category ${cat}`}
                      >
                        <TrashIcon className="size-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              {budgetOverage > 0 && (
                <p className="mt-2 border border-red-200 p-2 text-xs text-red-700" role="alert">
                  Monthly category limits exceed the amount available to spend (planned income after
                  investments + meal voucher) by {formatCurrency(budgetOverage)}.
                </p>
              )}

              {showAddCategory ? (
                <div className="mt-2 flex gap-1">
                  <Input
                    placeholder="Category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCategory()
                      }
                    }}
                    autoFocus
                    className="flex-1"
                  />
                  <Button onClick={handleAddCategory}>Add</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddCategory(false)
                      setNewCategoryName('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setShowAddCategory(true)}
                >
                  <PlusIcon className="size-3" /> Add Category
                </Button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {editingMonth && (
                <Button
                  variant="ghost"
                  className="mr-auto h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onDelete}
                >
                  Delete budget
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Budget</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingConflict !== null}
        title={pendingConflict?.title ?? ''}
        message={pendingConflict?.message ?? ''}
        confirmLabel="Continue"
        onConfirm={() => {
          if (pendingConflict) {
            commitSave(pendingConflict.newMonths, pendingConflict.toDelete, pendingConflict.budget)
          }
        }}
        onOpenChange={(o) => {
          if (!o) setPendingConflict(null)
        }}
      />
    </>
  )
}
