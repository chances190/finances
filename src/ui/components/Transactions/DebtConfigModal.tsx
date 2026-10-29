import { LightningAIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
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
import type { Debt } from '@/domain/entities'
import { addCurrency, formatCurrency, formatPlainCurrency, parseCurrency } from '@/lib/currency'
import { useToast } from '@/ui/context/ToastContext'

interface DebtSplitUI {
  id: string
  name: string
  amount: number
}

interface DebtConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  debts: Debt[]
  onDebtsChange: (debts: Debt[]) => void
  onRemoveAll: () => void
  totalAmount: number
}

export default function DebtConfigModal({
  open,
  onOpenChange,
  debts,
  onDebtsChange,
  onRemoveAll,
  totalAmount,
}: DebtConfigModalProps) {
  const [splits, setSplits] = useState<DebtSplitUI[]>([])
  const { toast } = useToast()

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setSplits(debts.map((d) => ({ id: uuid(), name: d.name, amount: d.amount })))
  }, [debts, open])

  const assignedTotal = splits.reduce((s, d) => addCurrency(s, d.amount), 0)
  const delta = totalAmount - assignedTotal
  const userShare = Math.max(0, delta)
  const overBy = Math.max(0, -delta)
  const isOver = delta < -0.01

  function handleAddPerson() {
    setSplits((prev) => [...prev, { id: uuid(), name: '', amount: 0 }])
  }

  function handleUpdateSplit(id: string, patch: Partial<DebtSplitUI>) {
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function handleRemoveSplit(id: string) {
    setSplits((prev) => prev.filter((s) => s.id !== id))
  }

  function handleSplitEvenly() {
    if (splits.length === 0) return
    const amounts = splitEvenlyAcrossParticipants(totalAmount, splits.length)
    setSplits((prev) => prev.map((split, index) => ({ ...split, amount: amounts[index] })))
  }

  function handleSave() {
    if (totalAmount > 0 && isOver) {
      toast(
        `Debt splits cannot exceed ${formatCurrency(totalAmount)} (currently ${formatCurrency(assignedTotal)})`,
        'error',
      )
      return
    }
    const named = splits.filter((s) => s.name.trim())
    if (named.length !== splits.length) {
      toast('Every person needs a name', 'error')
      return
    }
    onDebtsChange(named.map((s) => ({ name: s.name, amount: s.amount, settled: false })))
    onOpenChange(false)
  }

  function handleCancel() {
    setSplits(debts.map((d) => ({ id: uuid(), name: d.name, amount: d.amount })))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split expense</DialogTitle>
          <DialogDescription>
            Assign what other people owe. Your share is the remainder.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-3 overflow-y-auto px-1">
          {splits.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add the people who owe you for this purchase.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {splits.map((split, index) => (
                <li key={split.id} className="flex items-center gap-2 py-2">
                  <Input
                    placeholder="Name"
                    aria-label={`Name of person ${index + 1}`}
                    value={split.name}
                    onChange={(e) => handleUpdateSplit(split.id, { name: e.target.value })}
                    className="h-10 min-w-0 flex-1"
                  />
                  <MoneyInput
                    placeholder="Amount"
                    aria-label={`Amount owed by ${split.name || `person ${index + 1}`}`}
                    value={split.amount ? formatPlainCurrency(split.amount) : ''}
                    onValueChange={(amount) =>
                      handleUpdateSplit(split.id, { amount: parseCurrency(amount) })
                    }
                    className="h-10 w-24 shrink-0 text-right font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveSplit(split.id)}
                    title={`Remove ${split.name || `person ${index + 1}`}`}
                    aria-label={`Remove ${split.name || `person ${index + 1}`}`}
                  >
                    <TrashIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-10 flex-1" onClick={handleAddPerson}>
              <PlusIcon className="size-3" /> Add person
            </Button>
            {splits.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 flex-1"
                onClick={handleSplitEvenly}
              >
                <LightningAIcon className="size-3" /> Split evenly
              </Button>
            )}
          </div>

          <div className={`border p-2 text-xs ${isOver ? 'border-red-200 text-red-700' : ''}`}>
            <div className="flex items-baseline justify-between gap-3 py-0.5">
              <span>Others owe</span>
              <span className="font-mono font-medium">{formatCurrency(assignedTotal)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-0.5 font-medium">
              <span>You</span>
              <span className="font-mono">{formatCurrency(userShare)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1 font-medium">
              <span>Purchase total</span>
              <span className="font-mono">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {totalAmount > 0 && isOver && (
            <div className="text-xs text-destructive" role="alert">
              Amounts owed exceed the purchase by {formatCurrency(overBy)}. Reduce the amounts to
              save.
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end border-t border-border bg-popover pt-3">
          {splits.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onRemoveAll}
            >
              Remove all splits
            </Button>
          )}
          <Button variant="outline" className="h-10" onClick={handleCancel}>
            Cancel
          </Button>
          <Button className="h-10" onClick={handleSave} disabled={totalAmount > 0 && isOver}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
