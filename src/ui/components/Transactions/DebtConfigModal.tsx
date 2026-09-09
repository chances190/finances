import { LightningAIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import c from 'currency.js'
import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Debt } from '@/domain/entities'
import { formatCurrency, parseCurrency } from '@/lib/currency'
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
  totalAmount: number
}

export default function DebtConfigModal({
  open,
  onOpenChange,
  debts,
  onDebtsChange,
  totalAmount,
}: DebtConfigModalProps) {
  const [splits, setSplits] = useState<DebtSplitUI[]>([])
  const { toast } = useToast()

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setSplits(debts.map((d) => ({ id: uuid(), name: d.name, amount: d.amount })))
  }, [debts, open])

  const assignedTotal = splits.reduce((s, d) => s + d.amount, 0)
  const remaining = Math.max(0, totalAmount - assignedTotal)
  const isBalanced = remaining < 0.01

  function handleAddPerson() {
    setSplits((prev) => [...prev, { id: uuid(), name: '', amount: 0 }])
  }

  function handleUpdateSplit(id: string, patch: Partial<DebtSplitUI>) {
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function handleRemoveSplit(id: string) {
    setSplits((prev) => prev.filter((s) => s.id !== id))
  }

  function handleFillRemainder(id: string) {
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, amount: remaining } : s)))
  }

  function handleSplitEvenly() {
    if (splits.length === 0) return
    const perPerson = c(totalAmount).divide(splits.length).value
    const remainder = Math.round((totalAmount - perPerson * splits.length) * 100) / 100
    setSplits((prev) =>
      prev.map((s, i) => ({
        ...s,
        amount: i === 0 ? perPerson + remainder : perPerson,
      })),
    )
  }

  function handleSave() {
    if (totalAmount > 0 && !isBalanced) {
      toast(
        `Debt splits must total ${formatCurrency(totalAmount)} (currently ${formatCurrency(assignedTotal)})`,
        'error',
      )
      return
    }
    onDebtsChange(splits.map((s) => ({ name: s.name, amount: s.amount, settled: false })))
    onOpenChange(false)
  }

  function handleCancel() {
    setSplits(debts.map((d) => ({ id: uuid(), name: d.name, amount: d.amount })))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure Debt Split</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium" id="debtors-label">
                Debtors
              </Label>
              <Button variant="ghost" size="xs" onClick={handleAddPerson} aria-label="Add person">
                <PlusIcon className="size-3" /> Add person
              </Button>
            </div>

            {splits.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border border-dashed p-2">
                No debtors yet. Click "Add person" to get started.
              </div>
            ) : (
              <>
                {splits.map((split) => (
                  <div key={split.id} className="flex gap-2 items-center">
                    <Input
                      placeholder="Name"
                      value={split.name}
                      onChange={(e) => handleUpdateSplit(split.id, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Amount"
                      value={split.amount || ''}
                      onChange={(e) =>
                        handleUpdateSplit(split.id, { amount: parseCurrency(e.target.value) })
                      }
                      className="w-28"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Fill with remaining amount"
                      onClick={() => handleFillRemainder(split.id)}
                      disabled={remaining < 0.01}
                      aria-label="Fill remaining amount"
                    >
                      <LightningAIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveSplit(split.id)}
                      aria-label="Remove person"
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                ))}

                {splits.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleSplitEvenly}
                  >
                    Split evenly ({splits.length} debtor{splits.length !== 1 ? 's' : ''})
                  </Button>
                )}
              </>
            )}
          </div>

          <div
            className={`flex items-center justify-between text-xs p-2 border ${
              totalAmount === 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : isBalanced
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}
          >
            <span>{totalAmount === 0 ? 'Amount will be set to:' : 'Balance:'}</span>
            <span className="font-mono font-medium">
              {totalAmount === 0
                ? formatCurrency(assignedTotal)
                : `${formatCurrency(assignedTotal)} / ${formatCurrency(totalAmount)}`}
            </span>
          </div>

          {!isBalanced && remaining !== 0 && (
            <div className="text-xs text-muted-foreground">
              Remaining: {formatCurrency(remaining)}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={totalAmount > 0 && !isBalanced}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
