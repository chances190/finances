import { LightningAIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Debt } from '@/domain/entities'
import { addCurrency, formatCurrency, parseCurrency } from '@/lib/currency'
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

  const assignedTotal = splits.reduce((s, d) => addCurrency(s, d.amount), 0)
  const delta = totalAmount - assignedTotal
  const userShare = Math.max(0, delta)
  const overBy = Math.max(0, -delta)
  const isOver = delta < -0.01
  const isBalanced = Math.abs(delta) < 0.01

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
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, amount: userShare } : s)))
  }

  function handleSplitEvenly() {
    if (splits.length === 0) return
    const totalCents = Math.round(totalAmount * 100)
    const baseCents = Math.floor(totalCents / (splits.length + 1))
    setSplits((prev) => prev.map((s) => ({ ...s, amount: baseCents / 100 })))
  }

  function handleSave() {
    if (totalAmount > 0 && isOver) {
      toast(
        `Debt splits cannot exceed ${formatCurrency(totalAmount)} (currently ${formatCurrency(assignedTotal)})`,
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
                      type="text"
                      inputMode="decimal"
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
                      disabled={userShare < 0.01}
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
                    Split evenly (you + {splits.length} debtor{splits.length !== 1 ? 's' : ''})
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
                  : isOver
                    ? 'bg-red-50 border-red-200 text-red-700'
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

          {totalAmount > 0 && (
            <div className="flex items-center justify-between text-xs border p-2">
              <span>Your share:</span>
              <span className="font-mono font-medium">{formatCurrency(userShare)}</span>
            </div>
          )}

          {totalAmount > 0 && isOver && (
            <div className="text-xs text-destructive">
              Over by {formatCurrency(overBy)} — reduce split amounts.
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={totalAmount > 0 && isOver}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
