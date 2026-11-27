<script lang="ts">
import { Copy01Icon, Delete02Icon, PlusSignIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/svelte'
import { untrack } from 'svelte'
import ConfirmDialog from '@/components/common/ConfirmDialog.svelte'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { Budget } from '@/domain/entities'
import { addMonths } from '@/domain/ledger'
import type { CategoryIconName } from '@/lib/category-icons'
import { addCurrency, formatCurrency } from '@/lib/currency'
import { finance } from '@/lib/stores/finance.svelte'
import { toast } from '@/lib/stores/toast.svelte'
import {
  type BudgetFormData,
  emptyBudget,
  formFromBudget,
  monthsBetween,
  toBudget,
} from './budget-form'
import CategoryIconPicker from './CategoryIconPicker.svelte'

interface PendingConflict {
  title: string
  message: string
  newMonths: string[]
  toDelete: string[]
  budget: Budget
}

interface Props {
  onOpenChange: (open: boolean) => void
  onDelete: () => void
  editingMonth: string | null
  editingRange: { startMonth: string; endMonth: string } | null
  existingBudget: Budget | undefined
  nextMonth: string
}

let { onOpenChange, onDelete, editingMonth, editingRange, existingBudget, nextMonth }: Props =
  $props()

const initial = untrack(() => ({
  form: existingBudget
    ? formFromBudget(existingBudget)
    : emptyBudget(nextMonth, finance.state.budgets),
  rangeEnd: editingRange?.endMonth ?? nextMonth,
  isRange: editingRange ? editingRange.endMonth > editingRange.startMonth : false,
}))

let form = $state<BudgetFormData>(initial.form)
let rangeEnd = $state(initial.rangeEnd)
let isRange = $state(initial.isRange)
let pendingConflict = $state<PendingConflict | null>(null)
let newCategoryName = $state('')
let showAddCategory = $state(false)

const categoryRows = $derived(Object.keys(form.categoryLimits))
const draftBudget = $derived(toBudget(form))
const categoryTotal = $derived(
  Object.values(draftBudget.categoryLimits).reduce((sum, value) => addCurrency(sum, value), 0),
)
const plannedTotal = $derived(
  addCurrency(
    draftBudget.plannedIncome * (1 - draftBudget.investmentRate),
    draftBudget.plannedMealVoucher,
  ),
)
const budgetOverage = $derived(Math.max(0, addCurrency(categoryTotal, -plannedTotal)))
const investedAmount = $derived(draftBudget.plannedIncome * draftBudget.investmentRate)

function handleClone() {
  const sourceMonth = editingMonth
    ? addMonths(editingMonth, -1)
    : addMonths(form.referenceMonth, -1)
  const source = finance.state.budgets.find((budget) => budget.referenceMonth === sourceMonth)
  if (!source) {
    toast(`No budget found for ${sourceMonth}`, 'error')
    return
  }
  const targetMonth = editingMonth ?? form.referenceMonth
  form = { ...formFromBudget(source), referenceMonth: targetMonth }
}

function handleAddCategory() {
  const name = newCategoryName.trim()
  if (!name) return
  if (name in form.categoryLimits) {
    toast('Category already exists', 'error')
    return
  }
  form = { ...form, categoryLimits: { ...form.categoryLimits, [name]: '' } }
  newCategoryName = ''
  showAddCategory = false
}

function removeCategory(category: string) {
  const next = { ...form.categoryLimits }
  const icons = { ...form.categoryIcons }
  delete next[category]
  delete icons[category]
  form = { ...form, categoryLimits: next, categoryIcons: icons }
}

function setCategoryIcon(category: string, name: CategoryIconName) {
  form = { ...form, categoryIcons: { ...form.categoryIcons, [category]: name } }
}

function commitSave(months: string[], toDelete: string[], budget: Budget) {
  for (const month of months) {
    finance.dispatch({ type: 'UPSERT_BUDGET', payload: { ...budget, referenceMonth: month } })
  }
  for (const month of toDelete) {
    finance.dispatch({ type: 'DELETE_BUDGET', payload: month })
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
  const removed = oldRangeMonths.filter((month) => !newMonths.includes(month))
  const overwritten = newMonths.filter(
    (month) =>
      finance.state.budgets.some((budget) => budget.referenceMonth === month) &&
      !oldRangeMonths.includes(month),
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
    pendingConflict = {
      title,
      message: `This will ${parts.join(' and ')}.`,
      newMonths,
      toDelete,
      budget,
    }
    return
  }

  commitSave(newMonths, toDelete, budget)
}
</script>

<Dialog open {onOpenChange}>
  <DialogContent class="sm:max-h-[calc(100dvh-2rem)] sm:overflow-y-auto sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>
        {#if editingMonth}
          {editingRange && editingRange.endMonth > editingRange.startMonth
            ? `Edit Budget: ${editingRange.startMonth} – ${editingRange.endMonth}`
            : `Edit Budget: ${editingMonth}`}
        {:else}
          New Budget
        {/if}
      </DialogTitle>
    </DialogHeader>

    <div class="space-y-3">
      <div class="space-y-2">
        <Label class="text-xs font-medium">Period</Label>
        <SegmentedControl
          aria-label="Budget period"
          class="w-full"
          value={isRange ? 'range' : 'single'}
          onValueChange={(value) => {
            const next = value === 'range'
            isRange = next
            if (next && rangeEnd <= form.referenceMonth) {
              rangeEnd = addMonths(form.referenceMonth, 1)
            }
          }}
          options={[
            { value: 'single', label: 'Single month' },
            { value: 'range', label: 'Range of months' },
          ]}
        />
        {#if !isRange}
          <div class="space-y-1">
            <Label for="budget-month-from" class="text-xs">Reference Month</Label>
            <Input
              id="budget-month-from"
              type="date"
              value={form.referenceMonth ? `${form.referenceMonth}-01` : ''}
              oninput={(event) => {
                form = { ...form, referenceMonth: event.currentTarget.value.slice(0, 7) }
              }}
            />
          </div>
        {:else}
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <Label for="budget-month-from" class="text-xs">From</Label>
              <Input
                id="budget-month-from"
                type="date"
                value={form.referenceMonth ? `${form.referenceMonth}-01` : ''}
                oninput={(event) => {
                  form = { ...form, referenceMonth: event.currentTarget.value.slice(0, 7) }
                }}
              />
            </div>
            <div class="space-y-1">
              <Label for="budget-month-to" class="text-xs">To</Label>
              <Input
                id="budget-month-to"
                type="date"
                value={rangeEnd ? `${rangeEnd}-01` : ''}
                min={form.referenceMonth ? `${form.referenceMonth}-01` : undefined}
                oninput={(event) => {
                  rangeEnd = event.currentTarget.value.slice(0, 7)
                }}
              />
            </div>
          </div>
        {/if}
        {#if isRange}
          <div class="text-xs text-muted-foreground">
            {#if rangeEnd > form.referenceMonth}
              <span>
                {editingMonth ? 'Editing' : 'Creating'} budget for
                <span class="font-medium text-foreground">
                  {monthsBetween(form.referenceMonth, rangeEnd).length} months
                </span>
              </span>
            {:else}
              Choose an end month after the start month.
            {/if}
          </div>
        {/if}
        <div class="flex">
          <Button variant="outline" size="sm" onclick={handleClone}>
            <HugeiconsIcon icon={Copy01Icon} size={16} /> Copy previous budget
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="budget-income" class="text-xs">Planned Income (R$)</Label>
          <MoneyInput
            id="budget-income"
            value={form.plannedIncome}
            onValueChange={(plannedIncome) => {
              form = { ...form, plannedIncome }
            }}
          />
        </div>
        <div class="space-y-1">
          <Label for="budget-mealvoucher" class="text-xs">Meal Voucher (R$)</Label>
          <MoneyInput
            id="budget-mealvoucher"
            value={form.plannedMealVoucher}
            onValueChange={(plannedMealVoucher) => {
              form = { ...form, plannedMealVoucher }
            }}
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="budget-investment" class="text-xs">Investments (%)</Label>
          <Input
            id="budget-investment"
            type="text"
            inputmode="decimal"
            value={form.investmentRate}
            oninput={(event) => {
              form = { ...form, investmentRate: event.currentTarget.value }
            }}
          />
        </div>
        <div class="space-y-1">
          <Label class="text-xs">Invested</Label>
          <div
            class="flex h-10 items-center rounded-lg border border-border bg-muted/30 px-2.5 font-mono text-xs sm:h-8"
          >
            {formatCurrency(investedAmount)}
          </div>
        </div>
      </div>

      <div>
        <div class="mb-2">
          <Label class="text-xs font-medium">Category Limits</Label>
        </div>

        <div class="grid grid-cols-2 gap-2">
          {#each categoryRows as cat (cat)}
            {@const catId = `budget-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
            <div class="space-y-1">
              <div class="flex items-center gap-1.5">
                <CategoryIconPicker
                  category={cat}
                  value={form.categoryIcons[cat]}
                  onSelect={(name) => setCategoryIcon(cat, name)}
                />
                <Label for={catId} class="min-w-0 flex-1 truncate text-[10px] text-muted-foreground"
                  >{cat}</Label
                >
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 shrink-0 text-destructive hover:text-destructive"
                  onclick={() => removeCategory(cat)}
                  aria-label={`Remove category ${cat}`}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={12} class="size-3" />
                </Button>
              </div>
              <MoneyInput
                id={catId}
                placeholder="0"
                value={form.categoryLimits[cat] ?? ''}
                onValueChange={(limit) => {
                  form = {
                    ...form,
                    categoryLimits: { ...form.categoryLimits, [cat]: limit },
                  }
                }}
              />
            </div>
          {/each}
        </div>

        {#if budgetOverage > 0}
          <p
            class="mt-2 rounded-lg border border-red-200 p-2 text-xs text-red-700 dark:border-red-900 dark:text-red-400"
            role="alert"
          >
            Monthly category limits exceed the amount available to spend (planned income after
            investments + meal voucher) by {formatCurrency(budgetOverage)}.
          </p>
        {/if}

        {#if showAddCategory}
          <div class="mt-2 flex gap-1">
            <Input
              placeholder="Category name"
              value={newCategoryName}
              oninput={(event) => {
                newCategoryName = event.currentTarget.value
              }}
              onkeydown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleAddCategory()
                }
              }}
              class="flex-1"
            />
            <Button onclick={handleAddCategory}>Add</Button>
            <Button
              variant="outline"
              onclick={() => {
                showAddCategory = false
                newCategoryName = ''
              }}
            >
              Cancel
            </Button>
          </div>
        {:else}
          <Button
            variant="outline"
            class="mt-2 w-full"
            onclick={() => {
              showAddCategory = true
            }}
          >
            <HugeiconsIcon icon={PlusSignIcon} size={12} class="size-3" /> Add Category
          </Button>
        {/if}
      </div>

      <div class="flex justify-end gap-2 pt-2">
        {#if editingMonth}
          <Button
            variant="ghost"
            class="mr-auto h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onclick={onDelete}
          >
            Delete budget
          </Button>
        {/if}
        <Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
        <Button onclick={handleSave}>Save Budget</Button>
      </div>
    </div>
  </DialogContent>
</Dialog>

{#if pendingConflict}
  <ConfirmDialog
    open
    title={pendingConflict.title}
    message={pendingConflict.message}
    confirmLabel="Continue"
    onConfirm={() => {
      if (pendingConflict) {
        commitSave(pendingConflict.newMonths, pendingConflict.toDelete, pendingConflict.budget)
      }
    }}
    onOpenChange={(open) => {
      if (!open) pendingConflict = null
    }}
  />
{/if}
