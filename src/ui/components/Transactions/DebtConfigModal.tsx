import { LightningAIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DebtConfig, DebtSplitUI } from '@/domain/entities'
import { useToast } from '@/ui/context/ToastContext'

interface DebtConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: DebtConfig
  onConfigChange: (config: DebtConfig) => void
  totalAmount: number
}

export default function DebtConfigModal({
  open,
  onOpenChange,
  config,
  onConfigChange,
  totalAmount,
}: DebtConfigModalProps) {
  const [tempConfig, setTempConfig] = useState<DebtConfig>(config)
  const { toast } = useToast()

  const assignedDebtors = tempConfig.splits.reduce((s, d) => s + d.amount, 0)
  const assignedTotal = tempConfig.userShare + assignedDebtors
  const remaining = Math.max(0, totalAmount - assignedTotal)
  const isBalanced = Math.abs(remaining) < 0.01

  function handleAddPerson() {
    setTempConfig((c) => ({
      ...c,
      splits: [...c.splits, { id: uuid(), name: '', amount: 0 }],
    }))
  }

  function handleUpdateSplit(id: string, patch: Partial<DebtSplitUI>) {
    setTempConfig((c) => ({
      ...c,
      splits: c.splits.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }

  function handleRemoveSplit(id: string) {
    setTempConfig((c) => ({
      ...c,
      splits: c.splits.filter((s) => s.id !== id),
    }))
  }

  function handleFillRemainder(id: string) {
    setTempConfig((c) => ({
      ...c,
      splits: c.splits.map((s) => (s.id === id ? { ...s, amount: remaining } : s)),
    }))
  }

  function handleSplitEvenly() {
    const count = tempConfig.splits.length
    if (count === 0) return
    const perPerson = Math.round((totalAmount / count) * 100) / 100
    const remainder = Math.round((totalAmount - perPerson * count) * 100) / 100
    setTempConfig((c) => ({
      ...c,
      userShare: 0,
      splits: c.splits.map((s, i) => ({
        ...s,
        amount: i === c.splits.length - 1 ? perPerson + remainder : perPerson,
      })),
    }))
  }

  function handleSave() {
    // If totalAmount is 0, the user will auto-fill it from the config total
    // If totalAmount > 0, validate that splits don't exceed it
    if (totalAmount > 0 && !isBalanced) {
      toast(
        `Debt splits must total R$ ${totalAmount.toFixed(2)} (currently ${assignedTotal.toFixed(2)})`,
        'error',
      )
      return
    }
    onConfigChange(tempConfig)
    onOpenChange(false)
  }

  function handleCancel() {
    setTempConfig(config)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Configure Debt Split
            {totalAmount === 0 ? ' (will set amount)' : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Me row */}
          <div className="border-b pb-3">
            <Label className="text-xs font-medium mb-2 block">Your share (R$)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium flex-1">Me</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={tempConfig.userShare}
                onChange={(e) =>
                  setTempConfig((c) => ({
                    ...c,
                    userShare: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-28"
              />
            </div>
          </div>

          {/* Debtors */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Debtors</Label>
              <Button variant="ghost" size="xs" onClick={handleAddPerson}>
                <PlusIcon className="size-3" /> Add person
              </Button>
            </div>

            {tempConfig.splits.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border border-dashed p-2">
                No debtors yet. Click "Add person" to get started.
              </div>
            ) : (
              <>
                {tempConfig.splits.map((split) => (
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
                      value={split.amount}
                      onChange={(e) =>
                        handleUpdateSplit(split.id, { amount: parseFloat(e.target.value) || 0 })
                      }
                      className="w-28"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Fill with remaining amount"
                      onClick={() => handleFillRemainder(split.id)}
                      disabled={remaining < 0.01}
                    >
                      <LightningAIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveSplit(split.id)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                ))}

                {tempConfig.splits.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleSplitEvenly}
                  >
                    Split evenly across {tempConfig.splits.length} person
                    {tempConfig.splits.length !== 1 ? 's' : ''}
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Balance indicator */}
          <div
            className={`flex items-center justify-between text-xs p-2 rounded border ${
              totalAmount === 0
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                : isBalanced
                  ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
            }`}
          >
            <span>{totalAmount === 0 ? 'Amount will be set to:' : 'Balance:'}</span>
            <span className="font-mono font-medium">
              {totalAmount === 0
                ? `R$ ${(tempConfig.userShare + tempConfig.splits.reduce((s, d) => s + d.amount, 0)).toFixed(2)}`
                : `R$ ${tempConfig.userShare.toFixed(2)} + R$ ${assignedDebtors.toFixed(2)} = R$ ${assignedTotal.toFixed(2)} / R$ ${totalAmount.toFixed(2)}`}
            </span>
          </div>

          {!isBalanced && remaining !== 0 && (
            <div className="text-xs text-muted-foreground">
              Remaining: R$ {remaining.toFixed(2)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={totalAmount > 0 && !isBalanced}>
            {totalAmount === 0 ? 'Set Amount & Continue' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
