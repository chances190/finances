import { PlusIcon, UsersIcon } from '@phosphor-icons/react'
import React, { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { DEFAULT_CATEGORIES, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/domain/constants'
import type { DebtConfig, PaymentMethod } from '@/domain/entities'
import { useToast } from '@/ui/context/ToastContext'

interface QuickAddRowState {
  date: string
  amount: string
  description: string
  category: string | null
  paymentMethod: PaymentMethod | null
  installmentTotal: number
  isDebt: boolean
}

type CompletedQuickAddRow = Omit<QuickAddRowState, 'category' | 'paymentMethod'> & {
  category: string
  paymentMethod: PaymentMethod
}

interface QuickAddRowProps {
  refMonth: string
  onAdd: (row: CompletedQuickAddRow, refMonth: string, debtConfig?: DebtConfig) => void
  isFilteredMonth: boolean
  onOpenDebtModal?: (callback: (config: DebtConfig) => void, totalAmount: number) => void
}

export default function QuickAddRow({
  refMonth,
  onAdd,
  isFilteredMonth,
  onOpenDebtModal,
}: QuickAddRowProps) {
  const [row, setRow] = React.useState<QuickAddRowState>({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    description: '',
    category: null,
    paymentMethod: null,
    installmentTotal: 1,
    isDebt: false,
  })

  const [selectedRefMonth, setSelectedRefMonth] = React.useState(refMonth)
  const [debtConfig, setDebtConfig] = React.useState<DebtConfig>({ userShare: 0, splits: [] })
  const { toast } = useToast()

  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-focus date input when row mounts
    dateInputRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleAdd()
    }
  }

  function handleAdd() {
    const amount = parseFloat(row.amount) || 0

    if (!row.date) {
      toast('Date is required', 'error')
      return
    }
    if (amount <= 0) {
      toast('Amount is required and must be greater than 0', 'error')
      return
    }
    if (!row.category) {
      toast('Category is required', 'error')
      return
    }
    if (!row.paymentMethod) {
      toast('Payment method is required', 'error')
      return
    }

    onAdd(
      row as CompletedQuickAddRow,
      selectedRefMonth,
      debtConfig.splits.length > 0 ? debtConfig : undefined,
    )

    // Reset for next entry
    setRow({
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      description: '',
      category: null,
      paymentMethod: null,
      installmentTotal: 1,
      isDebt: false,
    })
    setDebtConfig({ userShare: 0, splits: [] })
    dateInputRef.current?.focus()
  }

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/50">
      <TableCell className="p-1 w-20">
        {isFilteredMonth ? (
          <div className="text-xs text-muted-foreground pt-2">{refMonth}</div>
        ) : (
          <Input
            type="month"
            value={selectedRefMonth}
            onChange={(e) => setSelectedRefMonth(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-6 text-xs"
          />
        )}
      </TableCell>
      <TableCell className="p-1 w-20">
        <Input
          ref={dateInputRef}
          type="date"
          value={row.date}
          onChange={(e) => setRow((r) => ({ ...r, date: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="h-6 text-xs"
        />
      </TableCell>
      <TableCell className="p-1 flex-1">
        <Input
          placeholder="Description"
          value={row.description}
          onChange={(e) => setRow((r) => ({ ...r, description: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="h-6 text-xs"
        />
      </TableCell>
      <TableCell className="p-1 w-20">
        <Select
          value={row.category ?? ''}
          onValueChange={(v) => setRow((r) => ({ ...r, category: v || null }))}
        >
          <SelectTrigger className="h-6 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="p-1 w-24">
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={row.amount}
          onChange={(e) => setRow((r) => ({ ...r, amount: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="h-6 text-xs text-right font-mono"
        />
      </TableCell>
      <TableCell className="p-1 w-20">
        <Select
          value={row.paymentMethod ?? ''}
          onValueChange={(v) =>
            setRow((r) => ({ ...r, paymentMethod: (v || null) as PaymentMethod | null }))
          }
        >
          <SelectTrigger className="h-6 text-xs">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((pm) => (
              <SelectItem key={pm} value={pm} className="text-xs">
                {PAYMENT_METHOD_LABELS[pm] ?? pm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="p-1 w-16 text-center">
        {row.paymentMethod === 'CREDIT' && (
          <Input
            type="number"
            min="1"
            max="48"
            value={row.installmentTotal}
            onChange={(e) =>
              setRow((r) => ({
                ...r,
                installmentTotal: Math.max(1, parseInt(e.target.value, 10) || 1),
              }))
            }
            onKeyDown={handleKeyDown}
            className="h-6 text-xs text-center"
          />
        )}
      </TableCell>
      <TableCell className="p-1 w-32">
        <Button
          size="icon-xs"
          variant={debtConfig.splits.length > 0 ? 'default' : 'ghost'}
          onClick={() => {
            if (onOpenDebtModal) {
              const amount = parseFloat(row.amount) || 0
              onOpenDebtModal((config) => {
                setDebtConfig(config)
                // If amount was 0, auto-fill with the debt total
                if (amount === 0) {
                  const total = config.userShare + config.splits.reduce((s, d) => s + d.amount, 0)
                  setRow((r) => ({ ...r, amount: String(total) }))
                }
              }, amount)
            }
          }}
          title={
            debtConfig.splits.length > 0 ? `${debtConfig.splits.length} debtors` : 'Add debt splits'
          }
        >
          <UsersIcon className="size-3" />
          {debtConfig.splits.length > 0 && (
            <span className="ml-1 text-xs">{debtConfig.splits.length}</span>
          )}
        </Button>
      </TableCell>
      <TableCell className="p-1 text-right w-20">
        <Button size="icon-xs" onClick={handleAdd} title="Add transaction (or press Enter)">
          <PlusIcon />
        </Button>
      </TableCell>
    </TableRow>
  )
}
