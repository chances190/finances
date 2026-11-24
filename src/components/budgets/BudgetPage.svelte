<script lang="ts">
import PlusIcon from 'phosphor-svelte/lib/PlusIcon'
import { MediaQuery } from 'svelte/reactivity'
import ConfirmDialog from '@/components/common/ConfirmDialog.svelte'
import EmptyState from '@/components/common/EmptyState.svelte'
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
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import { finance } from '@/lib/stores/finance.svelte'
import BudgetFormDialog from './BudgetFormDialog.svelte'

const financeState = $derived(finance.state)
const isDesktop = new MediaQuery('(min-width: 640px)')

const currentMonth = currentYM()
const rangeLabel = (range: BudgetRange) =>
  range.months.length > 1 ? `${range.startMonth} – ${range.endMonth}` : range.startMonth
const relationOf = (range: BudgetRange) =>
  range.months.includes(currentMonth) ? 'current' : monthRelation(range.startMonth)

let showForm = $state(false)
let editingMonth = $state<string | null>(null)
let editingRange = $state<{ startMonth: string; endMonth: string } | null>(null)
let confirmDeleteRange = $state<BudgetRange | null>(null)

const sorted = $derived(
  [...financeState.budgets].sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth)),
)
const ranges = $derived(groupBudgetsByRange(financeState.budgets).reverse())
const existingBudget = $derived(
  editingMonth
    ? financeState.budgets.find((budget) => budget.referenceMonth === editingMonth)
    : undefined,
)
const editingBudgetRange = $derived.by(() => {
  if (!editingRange) return undefined
  const startMonth = editingRange.startMonth
  return ranges.find((range) => range.startMonth === startMonth)
})
const nextMonth = $derived(sorted.length > 0 ? addMonths(sorted[0].referenceMonth, 1) : currentYM())

function openEdit(range: BudgetRange) {
  editingMonth = range.startMonth
  editingRange = { startMonth: range.startMonth, endMonth: range.endMonth }
  showForm = true
}

function closeForm() {
  showForm = false
  editingMonth = null
  editingRange = null
}
</script>

{#snippet budgetCard(range: BudgetRange)}
  {@const label = rangeLabel(range)}
  {@const relation = relationOf(range)}
  <button
    type="button"
    onclick={() => openEdit(range)}
    class="block w-full px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium {relation === 'current' ? 'text-primary' : ''}">
          {label}
        </p>
        {#if range.months.length > 1}
          <p class="text-[10px] text-muted-foreground">{range.months.length} months</p>
        {/if}
      </div>
      {#if relation === 'current'}
        <Badge variant="outline" class="shrink-0 text-[10px]">Current</Badge>
      {:else if relation === 'future'}
        <Badge variant="outline" class="shrink-0 text-[10px] text-muted-foreground">Future</Badge>
      {/if}
    </div>

    <div class="mt-2 space-y-0.5 border-t border-border/60 pt-2">
      <div class="flex items-baseline justify-between gap-2 text-xs">
        <span class="text-muted-foreground">Planned Income</span>
        <span class="font-mono">{formatCurrency(range.budget.plannedIncome)}</span>
      </div>
      <div class="flex items-baseline justify-between gap-2 text-xs">
        <span class="text-muted-foreground">Meal Voucher</span>
        <span class="font-mono">{formatCurrency(range.budget.plannedMealVoucher)}</span>
      </div>
    </div>

    {#if Object.values(range.budget.categoryLimits).some((value) => value > 0)}
      <div class="mt-2 space-y-0.5 border-t border-border/60 pt-2">
        {#each Object.entries(range.budget.categoryLimits).filter(
          ([, value]) => value > 0,
        ) as [category, value] (category)}
          <div class="flex items-baseline justify-between gap-2 text-xs">
            <span class="truncate text-muted-foreground">{category}</span>
            <span class="font-mono">{formatCurrency(value)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </button>
{/snippet}

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-lg font-semibold text-foreground">Budgets</h2>
    <Button
      size="sm"
      class="h-10 text-xs sm:h-7"
      onclick={() => {
        editingMonth = null
        editingRange = null
        showForm = true
      }}
    >
      <PlusIcon /> New Budget
    </Button>
  </div>

  {#if isDesktop.current}
    <div class="border border-border">
      <Table class="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead class="w-72">Period</TableHead>
            <TableHead class="w-48 text-right">Planned Income</TableHead>
            <TableHead class="w-48 text-right">Meal Voucher</TableHead>
            <TableHead class="pl-6">Categories</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#if ranges.length === 0}
            <TableRow>
              <TableCell colspan={4}>
                <EmptyState
                  variant="cell"
                  message="No budgets yet. Create one to start planning."
                />
              </TableCell>
            </TableRow>
          {/if}
          {#each ranges as range (range.startMonth)}
            {@const relation = relationOf(range)}
            <TableRow
              class="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              tabindex={0}
              onclick={() => openEdit(range)}
              onkeydown={(event) => {
                if (
                  event.target !== event.currentTarget ||
                  (event.key !== 'Enter' && event.key !== ' ')
                ) {
                  return
                }
                event.preventDefault()
                openEdit(range)
              }}
            >
              <TableCell class="font-medium {relation === 'current' ? 'text-primary' : ''}">
                {rangeLabel(range)}
                {#if range.months.length > 1}
                  <span class="ml-2 text-[10px] text-muted-foreground">
                    · {range.months.length} months
                  </span>
                {/if}
                {#if relation === 'current'}
                  <Badge variant="outline" class="ml-2 text-[10px]">Current</Badge>
                {:else if relation === 'future'}
                  <Badge variant="outline" class="ml-2 text-[10px] text-muted-foreground">
                    Future
                  </Badge>
                {/if}
              </TableCell>
              <TableCell class="text-right font-mono">
                {formatCurrency(range.budget.plannedIncome)}
              </TableCell>
              <TableCell class="text-right font-mono">
                {formatCurrency(range.budget.plannedMealVoucher)}
              </TableCell>
              <TableCell class="pl-6">
                <div class="flex flex-wrap gap-1">
                  {#each Object.entries(range.budget.categoryLimits).filter(
                    ([, value]) => value > 0,
                  ) as [category, value] (category)}
                    <span class="bg-muted px-1.5 py-0.5 text-xs">
                      {category}: {formatCurrency(value)}
                    </span>
                  {/each}
                </div>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </div>
  {:else}
    <div class="divide-y divide-border border border-border">
      {#if ranges.length === 0}
        <EmptyState message="No budgets yet. Create one to start planning." />
      {:else}
        {#each ranges as range (range.startMonth)}
          {@render budgetCard(range)}
        {/each}
      {/if}
    </div>
  {/if}
</div>

{#if showForm}
  <BudgetFormDialog
    onOpenChange={(open) => {
      if (!open) closeForm()
    }}
    onDelete={() => {
      if (editingBudgetRange) confirmDeleteRange = editingBudgetRange
    }}
    {editingMonth}
    {editingRange}
    {existingBudget}
    {nextMonth}
  />
{/if}

{#if confirmDeleteRange}
  <ConfirmDialog
    open
    title="Delete Budget"
    message={confirmDeleteRange.months.length > 1
      ? `Delete budget for ${confirmDeleteRange.startMonth} – ${confirmDeleteRange.endMonth}? This will remove the budget for ${confirmDeleteRange.months.length} months.`
      : `Delete budget for ${confirmDeleteRange.startMonth}?`}
    confirmLabel="Delete"
    onConfirm={() => {
      if (confirmDeleteRange) {
        for (const month of confirmDeleteRange.months) {
          finance.dispatch({ type: 'DELETE_BUDGET', payload: month })
        }
        confirmDeleteRange = null
        closeForm()
      }
    }}
    onOpenChange={(open) => {
      if (!open) confirmDeleteRange = null
    }}
  />
{/if}
