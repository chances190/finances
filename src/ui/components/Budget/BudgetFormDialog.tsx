import { CopyIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  return {
    referenceMonth: b.referenceMonth,
    plannedIncome: String(b.plannedIncome),
    plannedMealVoucher: String(b.plannedMealVoucher),
    categoryLimits: Object.fromEntries(
      Object.entries(b.categoryLimits).map(([k, v]) => [k, String(v)]),
    ),
  }
}

interface BudgetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingMonth: string | null
  existingBudget: Budget | undefined
  nextMonth: string
}

export default function BudgetFormDialog({
  open,
  onOpenChange,
  editingMonth,
  existingBudget,
  nextMonth,
}: BudgetFormDialogProps) {
  const { dispatch } = useFinance()
  const { toast } = useToast()

  const [form, setForm] = useState<BudgetFormData>(
    existingBudget ? formFromBudget(existingBudget) : emptyBudget(nextMonth),
  )
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(existingBudget ? formFromBudget(existingBudget) : emptyBudget(nextMonth))
    }
  }, [open, existingBudget, nextMonth])

  function handleClone() {
    const sourceMonth = editingMonth
      ? addMonths(editingMonth, -1)
      : addMonths(form.referenceMonth, -1)
    const budgets = existingBudget ? [existingBudget] : []
    const source = budgets.find((b) => b.referenceMonth === sourceMonth)
    if (!source) {
      toast(`No budget found for ${sourceMonth}`, 'error')
      return
    }
    setForm(formFromBudget(source))
  }

  function handleSave() {
    dispatch({ type: 'UPSERT_BUDGET', payload: toBudget(form) })
    onOpenChange(false)
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
        <DialogHeader>
          <DialogTitle>{editingMonth ? `Edit Budget: ${editingMonth}` : 'New Budget'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="budget-month" className="text-xs">
                Reference Month
              </Label>
              <Input
                id="budget-month"
                type="month"
                value={form.referenceMonth}
                onChange={(e) => setForm((f) => ({ ...f, referenceMonth: e.target.value }))}
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
              <Button variant="ghost" size="xs" onClick={() => setShowAddCategory(true)}>
                <PlusIcon className="size-3" /> Add Category
              </Button>
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
              {Object.keys(form.categoryLimits).map((cat) => {
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
      </DialogContent>
    </Dialog>
  )
}
