<script lang="ts">
import { BoltIcon, Delete02Icon, PlusSignIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/svelte'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { splitEvenlyAcrossParticipants } from '@/domain/calculations'
import type { PurchaseShare } from '@/domain/ledger'
import { addCurrency, formatCurrency, formatPlainCurrency, parseCurrency } from '@/lib/currency'
import { toast } from '@/lib/stores/toast.svelte'

interface SplitUI {
  id: string
  name: string
  amount: number
}

interface Props {
  onOpenChange: (open: boolean) => void
  shares: PurchaseShare[]
  onSharesChange: (shares: PurchaseShare[]) => void
  onRemoveAll: () => void
  totalAmount: number
}

let { onOpenChange, shares, onSharesChange, onRemoveAll, totalAmount }: Props = $props()

function initialSplits(): SplitUI[] {
  return shares.map((share) => ({
    id: crypto.randomUUID(),
    name: share.counterparty,
    amount: share.amount,
  }))
}

let splits = $state<SplitUI[]>(initialSplits())

const assignedTotal = $derived(splits.reduce((sum, split) => addCurrency(sum, split.amount), 0))
const delta = $derived(totalAmount - assignedTotal)
const userShare = $derived(Math.max(0, delta))
const overBy = $derived(Math.max(0, -delta))
const isOver = $derived(delta < -0.01)

function handleAddPerson() {
  splits = [...splits, { id: crypto.randomUUID(), name: '', amount: 0 }]
}

function handleUpdateSplit(id: string, patch: Partial<SplitUI>) {
  splits = splits.map((split) => (split.id === id ? { ...split, ...patch } : split))
}

function handleRemoveSplit(id: string) {
  splits = splits.filter((split) => split.id !== id)
}

function handleSplitEvenly() {
  if (splits.length === 0) return
  const amounts = splitEvenlyAcrossParticipants(totalAmount, splits.length)
  splits = splits.map((split, index) => ({ ...split, amount: amounts[index] }))
}

function handleSave() {
  if (totalAmount > 0 && isOver) {
    toast(
      `Debt splits cannot exceed ${formatCurrency(totalAmount)} (currently ${formatCurrency(assignedTotal)})`,
      'error',
    )
    return
  }
  const named = splits.filter((split) => split.name.trim())
  if (named.length !== splits.length) {
    toast('Every person needs a name', 'error')
    return
  }
  onSharesChange(named.map((split) => ({ counterparty: split.name.trim(), amount: split.amount })))
  onOpenChange(false)
}

function handleCancel() {
  onOpenChange(false)
}
</script>

<Dialog open {onOpenChange}>
  <DialogContent class="grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Split expense</DialogTitle>
      <DialogDescription
        >Assign what other people owe. Your share is the remainder.</DialogDescription
      >
    </DialogHeader>

    <div class="min-h-0 space-y-3 overflow-y-auto px-1">
      {#if splits.length === 0}
        <p class="text-xs text-muted-foreground">Add the people who owe you for this purchase.</p>
      {:else}
        <ul class="panel-inset divide-y divide-border">
          {#each splits as split, index (split.id)}
            <li class="flex items-center gap-2 py-2">
              <Input
                placeholder="Name"
                aria-label={`Name of person ${index + 1}`}
                value={split.name}
                oninput={(event) =>
                  handleUpdateSplit(split.id, { name: event.currentTarget.value })}
                class="h-10 min-w-0 flex-1"
              />
              <MoneyInput
                placeholder="Amount"
                aria-label={`Amount owed by ${split.name || `person ${index + 1}`}`}
                value={split.amount ? formatPlainCurrency(split.amount) : ''}
                onValueChange={(amount) =>
                  handleUpdateSplit(split.id, { amount: parseCurrency(amount) })}
                class="h-10 w-24 shrink-0 text-right font-mono"
              />
              <Button
                variant="ghost"
                size="icon"
                class="size-10 shrink-0 text-destructive hover:text-destructive"
                onclick={() => handleRemoveSplit(split.id)}
                title={`Remove ${split.name || `person ${index + 1}`}`}
                aria-label={`Remove ${split.name || `person ${index + 1}`}`}
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
              </Button>
            </li>
          {/each}
        </ul>
      {/if}

      <div class="flex gap-2">
        <Button variant="outline" size="sm" class="h-10 flex-1" onclick={handleAddPerson}>
          <HugeiconsIcon icon={PlusSignIcon} size={12} class="size-3" /> Add person
        </Button>
        {#if splits.length > 0}
          <Button variant="outline" size="sm" class="h-10 flex-1" onclick={handleSplitEvenly}>
            <HugeiconsIcon icon={BoltIcon} size={12} class="size-3" /> Split evenly
          </Button>
        {/if}
      </div>

      <div
        class="rounded-lg border p-2 text-xs {isOver
          ? 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-400'
          : ''}"
      >
        <div class="flex items-baseline justify-between gap-3 py-0.5">
          <span>Others owe</span>
          <span class="font-mono font-medium">{formatCurrency(assignedTotal)}</span>
        </div>
        <div class="flex items-baseline justify-between gap-3 py-0.5 font-medium">
          <span>You</span>
          <span class="font-mono">{formatCurrency(userShare)}</span>
        </div>
        <div
          class="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1 font-medium"
        >
          <span>Purchase total</span>
          <span class="font-mono">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {#if totalAmount > 0 && isOver}
        <div class="text-xs text-destructive" role="alert">
          Amounts owed exceed the purchase by {formatCurrency(overBy)}. Reduce the amounts to save.
        </div>
      {/if}
    </div>

    <div class="flex gap-2 justify-end border-t border-border bg-popover pt-3">
      {#if splits.length > 0}
        <Button
          variant="ghost"
          size="sm"
          class="mr-auto h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onclick={onRemoveAll}
        >
          Remove all splits
        </Button>
      {/if}
      <Button variant="outline" class="h-10" onclick={handleCancel}>Cancel</Button>
      <Button class="h-10" onclick={handleSave} disabled={totalAmount > 0 && isOver}>Save</Button>
    </div>
  </DialogContent>
</Dialog>
