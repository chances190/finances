import {
  ArrowDownLeftIcon,
  DotsThreeIcon,
  FunnelIcon,
  HandCoinsIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  availableMonths,
  compareMovements,
  currentYM,
  type MovementSortKey,
  monthRelation,
} from '@/domain/calculations'
import { allCategoryNames, categoryOptionsForMonth } from '@/domain/categories'
import { ACCOUNT_BADGE_COLORS } from '@/domain/constants'
import {
  ACCOUNT_LABELS,
  accountForPaymentMethod,
  buildIncome,
  buildPurchase,
  buildRefund,
  CASH_ACCOUNTS,
  categoryOf,
  type DisplayPaymentMethod,
  EXPENSE_PAYMENT_METHODS,
  expenseAmount,
  type FundingAccount,
  fundingAccountOf,
  grossPurchaseAmount,
  type IncomePaymentMethod,
  type InstallmentInfo,
  incomeAmount,
  installmentInfo,
  localYMD,
  MOVEMENT_KIND_LABELS,
  type Movement,
  movementMonth,
  movementTotal,
  type OutstandingMovement,
  outstandingMovements,
  PAYMENT_METHODS,
  type PaymentMethod,
  paymentMethodOf,
  refundAmount,
  refundableAmount,
  settlementTotal,
  transferAccounts,
} from '@/domain/ledger'
import { formatCurrency, parseCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import EmptyState from '@/ui/components/Common/EmptyState'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import { useIsDesktop } from '@/ui/hooks/useIsDesktop'
import { useScrollMargin } from '@/ui/hooks/useScrollMargin'
import SmartTransactionInput from './SmartTransactionInput'
import TransactionForm from './TransactionForm'

const SORT_OPTIONS: { value: string; label: string; compact: string }[] = [
  { value: 'date:desc', label: 'Date: newest first', compact: 'Date ↓' },
  { value: 'date:asc', label: 'Date: oldest first', compact: 'Date ↑' },
  { value: 'amount:desc', label: 'Amount: high to low', compact: 'Amount ↓' },
  { value: 'amount:asc', label: 'Amount: low to high', compact: 'Amount ↑' },
  { value: 'description:asc', label: 'Description: A to Z', compact: 'Description ↑' },
  { value: 'description:desc', label: 'Description: Z to A', compact: 'Description ↓' },
  { value: 'category:asc', label: 'Category: A to Z', compact: 'Category ↑' },
  { value: 'payment:asc', label: 'Payment: A to Z', compact: 'Payment ↑' },
]

function accountOf(movement: Movement): FundingAccount | null {
  if (movement.kind === 'transfer') {
    const accounts = transferAccounts(movement)
    return (accounts?.[0] as FundingAccount | undefined) ?? null
  }
  if (movement.kind === 'settlement') {
    const cash = movement.postings.find((posting) =>
      CASH_ACCOUNTS.includes(posting.account as (typeof CASH_ACCOUNTS)[number]),
    )
    return cash ? (cash.account as FundingAccount) : null
  }
  if (movement.kind === 'adjustment') {
    const posting = movement.postings.find((candidate) => candidate.account !== 'adjustment')
    return posting ? (posting.account as FundingAccount) : null
  }
  return fundingAccountOf(movement)
}

function amountOf(movement: Movement): number {
  switch (movement.kind) {
    case 'purchase':
      return grossPurchaseAmount(movement)
    case 'income':
      return incomeAmount(movement)
    case 'refund':
      return refundAmount(movement)
    case 'settlement':
      return settlementTotal(movement)
    default:
      return movementTotal(movement)
  }
}

function amountClass(movement: Movement): string {
  if (movement.kind === 'income' || movement.kind === 'refund') return 'text-green-600'
  if (movement.kind === 'purchase') return 'text-red-600'
  return 'text-muted-foreground'
}

function paymentLabelOf(movement: Movement): string {
  const method = paymentMethodOf(movement)
  if (method) return method
  const account = accountOf(movement)
  return account ? ACCOUNT_LABELS[account] : '—'
}

function kindLabelOf(movement: Movement): string | null {
  if (movement.kind === 'purchase' || movement.kind === 'income') return null
  if (movement.kind === 'settlement') {
    const relation = movement.postings.find(
      (posting) => posting.account === 'receivable' || posting.account === 'payable',
    )
    return relation?.account === 'receivable' ? 'Received' : 'Paid'
  }
  return MOVEMENT_KIND_LABELS[movement.kind]
}

function debtStatusOf(rows: OutstandingMovement[]): 'Paid' | 'Partial' | null {
  if (rows.length === 0) return null
  if (rows.every((row) => row.outstanding <= 0.004)) return 'Paid'
  if (rows.some((row) => row.settled > 0.004)) return 'Partial'
  return null
}

function detailOf(movement: Movement, debtRows: OutstandingMovement[]): string {
  if (movement.kind === 'transfer') {
    const accounts = transferAccounts(movement)
    if (accounts) return `${ACCOUNT_LABELS[accounts[0]]} → ${ACCOUNT_LABELS[accounts[1]]}`
  }
  if (movement.kind === 'purchase') {
    const shares = debtRows.filter((row) => row.direction === 'receivable')
    if (shares.length > 0) {
      const people = shares
        .map((row) => {
          // Non-breaking spaces keep "R$ 50,00 (paid)" from wrapping mid-figure.
          const amount = formatCurrency(
            row.outstanding > 0.004 ? row.outstanding : row.total,
          ).replace(/ /g, '\u00A0')
          return `${row.counterparty} ${amount}${row.outstanding <= 0.004 ? '\u00A0(paid)' : ''}`
        })
        .join(' · ')
      return `You ${formatCurrency(expenseAmount(movement))} · ${people}`
    }
    const payable = debtRows.find((row) => row.direction === 'payable')
    if (payable) {
      return `Paid by ${payable.counterparty}${payable.outstanding <= 0.004 ? '\u00A0(paid)' : ''}`
    }
  }
  return ''
}

const PAYMENT_BADGE_COLORS: Record<DisplayPaymentMethod, string> = {
  'Debit/PIX': 'bg-teal-100 text-teal-800',
  Credit: 'bg-purple-100 text-purple-800',
  'Voucher Debit': 'bg-pink-100 text-pink-800',
  Cash: 'bg-emerald-100 text-emerald-800',
  Salary: 'bg-yellow-100 text-yellow-800',
  Transfer: 'bg-sky-100 text-sky-800',
  'Voucher Income': 'bg-orange-100 text-orange-800',
  'Someone else': 'bg-amber-100 text-amber-800',
}

function PaymentBadge({ movement }: { movement: Movement }) {
  const method = paymentMethodOf(movement)
  if (method) {
    return (
      <Badge variant="outline" className={PAYMENT_BADGE_COLORS[method]}>
        {method}
      </Badge>
    )
  }
  const account = accountOf(movement)
  if (!account) return null
  return (
    <Badge variant="outline" className={ACCOUNT_BADGE_COLORS[account]}>
      {ACCOUNT_LABELS[account]}
    </Badge>
  )
}

function DebtStatusBadge({ rows }: { rows: OutstandingMovement[] }) {
  const status = debtStatusOf(rows)
  if (!status) return null
  return (
    <Badge
      variant="outline"
      className={status === 'Paid' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'}
    >
      {status}
    </Badge>
  )
}

function MovementActions({
  movement,
  onRefund,
  onDelete,
}: {
  movement: Movement
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const act = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-10 shrink-0"
            aria-label="Transaction actions"
          />
        }
      >
        <DotsThreeIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {movement.kind === 'purchase' &&
          movement.postings.some(
            (posting) => posting.account === 'receivable' || posting.account === 'payable',
          ) && (
            <Link
              href={`/debts?movement=${movement.id}&settled=1`}
              className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <HandCoinsIcon className="size-4" /> Go to debt
            </Link>
          )}
        {movement.kind === 'purchase' && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs hover:bg-muted"
            onClick={() => act(() => onRefund(movement))}
          >
            <ArrowDownLeftIcon className="size-4" /> Reimbursed
          </button>
        )}
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
          onClick={() => act(() => onDelete(movement.id))}
        >
          <TrashIcon className="size-4" /> Delete
        </button>
      </PopoverContent>
    </Popover>
  )
}

const MovementCard = memo(function MovementCard({
  movement,
  debtRows,
  onOpen,
  onRefund,
  onDelete,
  installment,
}: {
  movement: Movement
  debtRows: OutstandingMovement[]
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
  installment: InstallmentInfo | null
}) {
  const isFuture = monthRelation(movementMonth(movement)) === 'future'
  const kindLabel = kindLabelOf(movement)
  const detail = detailOf(movement, debtRows)
  const category =
    movement.kind === 'purchase' || movement.kind === 'refund' ? categoryOf(movement) : undefined

  return (
    <div className={`relative px-3 py-2 ${isFuture ? 'opacity-45' : ''}`}>
      <button
        type="button"
        onClick={() => onOpen(movement)}
        className="block w-full rounded-none py-1 text-left hover:bg-muted/30 focus-visible:outline focus-visible:outline-ring"
      >
        <span className="flex items-start gap-2 pr-16">
          <span className="min-w-0 flex-1 break-words text-sm font-medium">
            {movement.description}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pr-10 text-xs">
          {kindLabel && (
            <Badge variant="outline" className="text-[10px]">
              {kindLabel}
            </Badge>
          )}
          <PaymentBadge movement={movement} />
          {category && (
            <Badge variant="outline" className="text-[10px]">
              {category}
            </Badge>
          )}
          {installment && (
            <Badge variant="outline" className="text-[10px]">
              {installment.index + 1}/{installment.total}
            </Badge>
          )}
          <span>{movement.date}</span>
          <DebtStatusBadge rows={debtRows} />
        </span>
        {detail && (
          <span className="mt-1 block pr-10 text-[10px] text-muted-foreground">{detail}</span>
        )}
      </button>
      <span
        className={`pointer-events-none absolute top-1.5 right-3 font-mono text-sm font-semibold ${amountClass(movement)}`}
      >
        {formatCurrency(amountOf(movement))}
      </span>
      <div className="absolute right-0 bottom-0">
        <MovementActions movement={movement} onRefund={onRefund} onDelete={onDelete} />
      </div>
    </div>
  )
})

function getParamList(params: URLSearchParams, key: string): string[] {
  const value = params.get(key)
  return value ? value.split(',').filter(Boolean) : []
}

function FilterGroup({
  idPrefix,
  label,
  options,
  selected,
  count,
  onToggle,
  wide,
}: {
  idPrefix: string
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  count: number
  onToggle: (option: string, on: boolean) => void
  wide: boolean
}) {
  const list = (
    <div className="space-y-1">
      {options.map((option) => (
        <label
          key={option.value}
          htmlFor={`${idPrefix}-${option.value}`}
          className="flex min-h-10 cursor-pointer items-center gap-2 py-1"
        >
          <Checkbox
            id={`${idPrefix}-${option.value}`}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => onToggle(option.value, checked === true)}
          />
          <span className="text-xs">{option.label}</span>
        </label>
      ))}
    </div>
  )

  if (wide) {
    return (
      <div>
        <p className="mb-1 text-xs text-muted-foreground">
          {label}
          {count > 0 && ` (${count})`}
        </p>
        <div>{list}</div>
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <FunnelIcon className="size-3" />
        {label}
        {count > 0 && ` (${count})`}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div>{list}</div>
      </PopoverContent>
    </Popover>
  )
}

const TransactionFilters = memo(function TransactionFilters({
  filterType,
  filterMonth,
  filterCategories,
  filterPayments,
  filterCounterparties,
  months,
  allCategories,
  allPaymentMethods,
  allCounterparties,
  showOtherType,
  updateParam,
  wide = false,
}: {
  filterType: string
  filterMonth: string
  filterCategories: string[]
  filterPayments: string[]
  filterCounterparties: string[]
  months: string[]
  allCategories: string[]
  allPaymentMethods: string[]
  allCounterparties: string[]
  showOtherType: boolean
  updateParam: (key: string, value: string | string[] | null) => void
  wide?: boolean
}) {
  return (
    <>
      <Select value={filterType} onValueChange={(value) => updateParam('type', value)}>
        <SelectTrigger
          className={
            wide
              ? 'h-10 w-full text-xs data-[size=default]:h-10 sm:h-7 sm:data-[size=default]:h-7'
              : 'h-7 w-24 text-xs'
          }
        >
          <SelectValue>{filterType === 'all' ? 'All types' : filterType}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="Expense">Expense</SelectItem>
          <SelectItem value="Income">Income</SelectItem>
          {showOtherType && <SelectItem value="Other">Transfers & payments</SelectItem>}
        </SelectContent>
      </Select>

      <Select value={filterMonth} onValueChange={(value) => updateParam('month', value)}>
        <SelectTrigger
          className={
            wide
              ? 'h-10 w-full text-xs data-[size=default]:h-10 sm:h-7 sm:data-[size=default]:h-7'
              : 'h-7 w-28 text-xs'
          }
        >
          <SelectValue>{filterMonth === 'all' ? 'All months' : filterMonth}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All months</SelectItem>
          {months.map((month) => {
            const relation = monthRelation(month)
            return (
              <SelectItem
                key={month}
                value={month}
                className={
                  relation === 'future'
                    ? 'text-muted-foreground/60'
                    : relation === 'current'
                      ? 'text-primary font-medium'
                      : ''
                }
              >
                {month}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <FilterGroup
        idPrefix="payment-filter"
        label="Payment"
        options={allPaymentMethods.map((method) => ({ value: method, label: method }))}
        selected={filterPayments}
        count={filterPayments.length}
        onToggle={(method, on) =>
          updateParam(
            'payment',
            on ? [...filterPayments, method] : filterPayments.filter((item) => item !== method),
          )
        }
        wide={wide}
      />

      <FilterGroup
        idPrefix="cat-filter"
        label="Category"
        options={allCategories.map((category) => ({ value: category, label: category }))}
        selected={filterCategories}
        count={filterCategories.length}
        onToggle={(category, on) =>
          updateParam(
            'category',
            on
              ? [...filterCategories, category]
              : filterCategories.filter((item) => item !== category),
          )
        }
        wide={wide}
      />

      {allCounterparties.length > 0 && (
        <FilterGroup
          idPrefix="person-filter"
          label="Person"
          options={allCounterparties.map((person) => ({ value: person, label: person }))}
          selected={filterCounterparties}
          count={filterCounterparties.length}
          onToggle={(person, on) =>
            updateParam(
              'person',
              on
                ? [...filterCounterparties, person]
                : filterCounterparties.filter((item) => item !== person),
            )
          }
          wide={wide}
        />
      )}
    </>
  )
})

const MovementRowCells = memo(function MovementRowCells({
  movement,
  debtRows,
  onRefund,
  onDelete,
  installment,
}: {
  movement: Movement
  debtRows: OutstandingMovement[]
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
  installment: InstallmentInfo | null
}) {
  const kindLabel = kindLabelOf(movement)
  const detail = detailOf(movement, debtRows)
  const category =
    movement.kind === 'purchase' || movement.kind === 'refund' ? categoryOf(movement) : undefined
  return (
    <>
      <TableCell>
        <PaymentBadge movement={movement} />
      </TableCell>
      <TableCell className={cn('text-right font-mono text-xs', amountClass(movement))}>
        {formatCurrency(amountOf(movement))}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 shrink truncate">{movement.description}</div>
          {kindLabel && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {kindLabel}
            </Badge>
          )}
          <DebtStatusBadge rows={debtRows} />
        </div>
        {detail && <div className="truncate text-[10px] text-muted-foreground">{detail}</div>}
      </TableCell>
      <TableCell className="text-xs">{category ?? '—'}</TableCell>
      <TableCell className="text-xs">{movement.date}</TableCell>
      <TableCell className="text-center text-xs">
        {installment ? `${installment.index + 1}/${installment.total}` : '—'}
      </TableCell>
      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
        <MovementActions movement={movement} onRefund={onRefund} onDelete={onDelete} />
      </TableCell>
    </>
  )
})

const DesktopMovementList = memo(function DesktopMovementList({
  movements,
  debtRowsById,
  emptyMessage,
  installmentsById,
  onOpen,
  onRefund,
  onDelete,
  onSort,
  sortKey,
  sortDir,
}: {
  movements: Movement[]
  debtRowsById: Map<string, OutstandingMovement[]>
  emptyMessage: string
  installmentsById: Map<string, InstallmentInfo>
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
  onSort: (key: string) => void
  sortKey: string | null
  sortDir: 'asc' | 'desc'
}) {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const scrollMargin = useScrollMargin(bodyRef)
  const rowVirtualizer = useWindowVirtualizer({
    count: movements.length,
    estimateSize: () => 41,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => movements[index]?.id ?? index,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start - scrollMargin : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - scrollMargin)
      : 0

  const indicator = (key: string) => {
    if (sortKey !== key) return null
    return sortDir === 'asc' ? (
      <SortAscendingIcon className="ml-0.5 inline size-3" />
    ) : (
      <SortDescendingIcon className="ml-0.5 inline size-3" />
    )
  }

  return (
    <div className="border border-border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">
              <button
                type="button"
                onClick={() => onSort('payment')}
                className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
              >
                Payment{indicator('payment')}
              </button>
            </TableHead>
            <TableHead className="w-28 text-right">
              <button
                type="button"
                onClick={() => onSort('amount')}
                className="flex w-full cursor-pointer select-none items-center justify-end gap-0.5 text-right font-medium"
              >
                Amount{indicator('amount')}
              </button>
            </TableHead>
            <TableHead className="flex-1">
              <button
                type="button"
                onClick={() => onSort('description')}
                className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
              >
                Description{indicator('description')}
              </button>
            </TableHead>
            <TableHead className="w-20">
              <button
                type="button"
                onClick={() => onSort('category')}
                className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
              >
                Category{indicator('category')}
              </button>
            </TableHead>
            <TableHead className="w-20">
              <button
                type="button"
                onClick={() => onSort('date')}
                className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
              >
                Date{indicator('date')}
              </button>
            </TableHead>
            <TableHead className="w-28 text-center">Installments</TableHead>
            <TableHead className="w-16 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <tbody ref={bodyRef} className="[&_tr:last-child]:border-0">
          {movements.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyState variant="cell" message={emptyMessage} />
              </TableCell>
            </TableRow>
          )}

          {paddingTop > 0 && (
            <tr aria-hidden>
              <td colSpan={7} style={{ height: paddingTop }} />
            </tr>
          )}

          {virtualRows.map((virtualRow) => {
            const movement = movements[virtualRow.index]
            const isFuture = monthRelation(movementMonth(movement)) === 'future'
            return (
              <tr
                key={movement.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={cn(
                  'cursor-pointer border-b transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                  isFuture && 'opacity-45',
                )}
                tabIndex={0}
                onClick={() => onOpen(movement)}
                onKeyDown={(event) => {
                  if (
                    event.target !== event.currentTarget ||
                    (event.key !== 'Enter' && event.key !== ' ')
                  ) {
                    return
                  }
                  event.preventDefault()
                  onOpen(movement)
                }}
              >
                <MovementRowCells
                  movement={movement}
                  debtRows={debtRowsById.get(movement.id) ?? []}
                  installment={installmentsById.get(movement.id) ?? null}
                  onRefund={onRefund}
                  onDelete={onDelete}
                />
              </tr>
            )
          })}

          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td colSpan={7} style={{ height: paddingBottom }} />
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  )
})

const MobileMovementList = memo(function MobileMovementList({
  movements,
  debtRowsById,
  emptyMessage,
  installmentsById,
  onOpen,
  onRefund,
  onDelete,
}: {
  movements: Movement[]
  debtRowsById: Map<string, OutstandingMovement[]>
  emptyMessage: string
  installmentsById: Map<string, InstallmentInfo>
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const scrollMargin = useScrollMargin(listRef)
  const rowVirtualizer = useWindowVirtualizer({
    count: movements.length,
    estimateSize: () => 120,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => movements[index]?.id ?? index,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <div
      ref={listRef}
      className={movements.length > 0 ? 'border-t border-border' : undefined}
      style={
        movements.length > 0
          ? { height: rowVirtualizer.getTotalSize(), position: 'relative' }
          : undefined
      }
    >
      {movements.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        virtualRows.map((virtualRow) => {
          const movement = movements[virtualRow.index]
          return (
            <div
              key={movement.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="border-r border-b border-l border-border"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <MovementCard
                movement={movement}
                debtRows={debtRowsById.get(movement.id) ?? []}
                installment={installmentsById.get(movement.id) ?? null}
                onOpen={onOpen}
                onRefund={onRefund}
                onDelete={onDelete}
              />
            </div>
          )
        })
      )}
    </div>
  )
})

function RefundDialog({
  purchase,
  open,
  onOpenChange,
}: {
  purchase: Movement | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('Credit')
  const [date, setDate] = useState(localYMD())
  const [description, setDescription] = useState('')

  const available = purchase ? refundableAmount(purchase, state.movements) : 0

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setAmount('')
    setDate(localYMD())
    setDescription(purchase?.description ?? '')
    const original = purchase ? paymentMethodOf(purchase) : null
    setMethod(original && original !== 'Someone else' ? original : 'Debit/PIX')
  }, [purchase, open])

  function handleSave() {
    if (!purchase) return
    const parsed = parseCurrency(amount)
    const result = buildRefund({
      id: crypto.randomUUID(),
      date,
      description,
      amount: parsed,
      account: accountForPaymentMethod(method),
      purchase,
      existing: state.movements,
    })
    if (!result.ok) {
      toast(result.reason, 'error')
      return
    }
    startTransition(() => dispatch({ type: 'ADD_MOVEMENTS', payload: [result.value] }))
    toast('Reimbursement recorded', 'success')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reimbursed</DialogTitle>
          <DialogDescription>
            Net this amount against “{purchase?.description ?? 'the purchase'}”. Up to{' '}
            {formatCurrency(available)} remains.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="refund-amount" className="text-xs">
              Amount (R$)
            </Label>
            <MoneyInput id="refund-amount" value={amount} onValueChange={setAmount} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="refund-date" className="text-xs">
                Date
              </Label>
              <Input
                id="refund-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="refund-account" className="text-xs">
                Received via
              </Label>
              <Select
                modal={false}
                value={method}
                onValueChange={(value) => setMethod((value ?? 'Credit') as PaymentMethod)}
              >
                <SelectTrigger id="refund-account" className="w-full">
                  <SelectValue>{method}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {EXPENSE_PAYMENT_METHODS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="refund-description" className="text-xs">
              Description
            </Label>
            <Input
              id="refund-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={available <= 0}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function TransactionTable() {
  const { state, dispatch } = useFinance()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [refundPurchase, setRefundPurchase] = useState<Movement | null>(null)
  const { toast } = useToast()
  const isDesktop = useIsDesktop()

  const filterSearch = searchParams.get('search') ?? ''
  const filterMonth = searchParams.get('month') ?? 'all'
  const filterType = searchParams.get('type') ?? 'all'
  const viewParam = searchParams.get('view')
  const view: 'spending' | 'activity' =
    viewParam === 'activity' || (!viewParam && searchParams.has('movement'))
      ? 'activity'
      : 'spending'
  const filterCategories = useMemo(() => getParamList(searchParams, 'category'), [searchParams])
  const filterPayments = useMemo(() => getParamList(searchParams, 'payment'), [searchParams])
  const filterCounterparties = useMemo(() => getParamList(searchParams, 'person'), [searchParams])
  const movementParam = searchParams.get('movement')
  const filterMovementId =
    movementParam && state.movements.some((movement) => movement.id === movementParam)
      ? movementParam
      : null

  const [localSearch, setLocalSearch] = useState(filterSearch)

  useEffect(() => {
    setLocalSearch(filterSearch)
  }, [filterSearch])

  useEffect(() => {
    if (localSearch === filterSearch) return
    const timer = setTimeout(() => {
      setSearchParams(
        (previous) => {
          if (localSearch) previous.set('search', localSearch)
          else previous.delete('search')
          return previous
        },
        { replace: true },
      )
    }, 150)
    return () => clearTimeout(timer)
  }, [localSearch, filterSearch, setSearchParams])

  const updateParam = useCallback(
    (key: string, value: string | string[] | null) => {
      setSearchParams((previous) => {
        if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          previous.delete(key)
        } else if (Array.isArray(value)) {
          previous.set(key, value.join(','))
        } else if (value === 'all') {
          previous.delete(key)
        } else {
          previous.set(key, value)
        }
        return previous
      })
    },
    [setSearchParams],
  )

  const months = useMemo(() => availableMonths(state.movements), [state.movements])

  const knownDescriptions = useMemo(() => {
    const descriptions = new Set<string>()
    for (const movement of state.movements) descriptions.add(movement.description)
    return Array.from(descriptions).sort()
  }, [state.movements])

  const allCategories = useMemo(
    () => allCategoryNames(state.budgets, state.movements),
    [state.budgets, state.movements],
  )

  const categoriesForMonth = useCallback(
    (month: string | null) =>
      categoryOptionsForMonth(month ?? currentYM(), state.budgets, state.movements),
    [state.budgets, state.movements],
  )

  const allCounterparties = useMemo(() => {
    const names = new Set<string>()
    for (const movement of state.movements) {
      for (const posting of movement.postings) {
        if (posting.counterparty) names.add(posting.counterparty)
      }
    }
    return Array.from(names).sort()
  }, [state.movements])

  const installmentsById = useMemo(() => {
    const map = new Map<string, InstallmentInfo>()
    for (const movement of state.movements) {
      const info = installmentInfo(movement, state.movements)
      if (info) map.set(movement.id, info)
    }
    return map
  }, [state.movements])

  const debtRowsById = useMemo(() => {
    const map = new Map<string, OutstandingMovement[]>()
    for (const direction of ['receivable', 'payable'] as const) {
      for (const row of outstandingMovements(state.movements, direction)) {
        const rows = map.get(row.movementId)
        if (rows) rows.push(row)
        else map.set(row.movementId, [row])
      }
    }
    return map
  }, [state.movements])

  const allPaymentMethods = useMemo(() => {
    const labels = new Set<string>([...PAYMENT_METHODS, 'Someone else'])
    for (const movement of state.movements) {
      const method = paymentMethodOf(movement)
      if (method) labels.add(method)
    }
    return Array.from(labels).sort()
  }, [state.movements])

  function setView(next: 'spending' | 'activity') {
    setSearchParams(
      (previous) => {
        previous.set('view', next)
        if (next === 'spending' && previous.get('type') === 'Other') previous.delete('type')
        return previous
      },
      { replace: true },
    )
  }

  const filtered = useMemo(() => {
    let movements = state.movements
    if (filterMovementId) {
      movements = movements.filter((movement) => movement.id === filterMovementId)
    }
    if (view === 'spending') {
      movements = movements.filter(
        (movement) =>
          movement.kind === 'purchase' || movement.kind === 'income' || movement.kind === 'refund',
      )
    }
    if (filterType === 'Expense') {
      movements = movements.filter(
        (movement) => movement.kind === 'purchase' || movement.kind === 'refund',
      )
    } else if (filterType === 'Income') {
      movements = movements.filter((movement) => movement.kind === 'income')
    } else if (filterType === 'Other') {
      movements = movements.filter(
        (movement) =>
          movement.kind === 'transfer' ||
          movement.kind === 'settlement' ||
          movement.kind === 'adjustment',
      )
    }
    if (filterMonth !== 'all') {
      movements = movements.filter((movement) => movementMonth(movement) === filterMonth)
    }
    if (filterSearch) {
      const needle = filterSearch.toLowerCase()
      movements = movements.filter((movement) =>
        movement.description.toLowerCase().includes(needle),
      )
    }
    if (filterCategories.length > 0) {
      movements = movements.filter(
        (movement) =>
          categoryOf(movement) && filterCategories.includes(categoryOf(movement) as string),
      )
    }
    if (filterPayments.length > 0) {
      movements = movements.filter((movement) => filterPayments.includes(paymentLabelOf(movement)))
    }
    if (filterCounterparties.length > 0) {
      movements = movements.filter((movement) =>
        movement.postings.some(
          (posting) => posting.counterparty && filterCounterparties.includes(posting.counterparty),
        ),
      )
    }
    if (sortKey === 'payment') {
      movements = [...movements].sort(
        (a, b) => paymentLabelOf(a).localeCompare(paymentLabelOf(b)) * (sortDir === 'asc' ? 1 : -1),
      )
    } else if (sortKey) {
      movements = [...movements].sort((a, b) =>
        compareMovements(a, b, sortKey as MovementSortKey, sortDir),
      )
    } else {
      movements = [...movements].sort((a, b) => b.date.localeCompare(a.date))
    }
    return movements
  }, [
    state.movements,
    filterMovementId,
    view,
    filterType,
    filterMonth,
    filterSearch,
    filterCategories,
    filterPayments,
    filterCounterparties,
    sortKey,
    sortDir,
  ])

  const activeFilterCount =
    (filterMovementId ? 1 : 0) +
    (filterType !== 'all' ? 1 : 0) +
    (filterMonth !== 'all' ? 1 : 0) +
    filterCategories.length +
    filterPayments.length +
    filterCounterparties.length

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        if (sortDir === 'desc') {
          setSortDir('asc')
        } else {
          setSortKey(null)
          setSortDir('desc')
        }
      } else {
        setSortKey(key)
        setSortDir('desc')
      }
    },
    [sortDir, sortKey],
  )

  function handleSmartAdd(row: {
    description: string
    amount: number
    category: string | null
    paymentMethod: PaymentMethod | null
    kind: 'income' | 'expense' | null
    date: string
  }) {
    if (row.amount <= 0) return
    const method: PaymentMethod =
      row.paymentMethod ?? (row.kind === 'income' ? 'Transfer' : 'Debit/PIX')
    const account = accountForPaymentMethod(method)

    if (row.kind === 'income') {
      const incomeMethod: IncomePaymentMethod =
        method === 'Salary' || method === 'Voucher Income' ? method : 'Transfer'
      const account = accountForPaymentMethod(incomeMethod)
      const result = buildIncome({
        id: crypto.randomUUID(),
        date: row.date,
        description: row.description,
        amount: row.amount,
        account: account === 'voucher' || account === 'cash' ? account : 'checking',
        method: incomeMethod,
        category: 'Income',
      })
      if (!result.ok) {
        toast(result.reason, 'error')
        return
      }
      startTransition(() => dispatch({ type: 'ADD_MOVEMENTS', payload: [result.value] }))
      toast('Income added', 'success')
      return
    }

    const result = buildPurchase({
      id: crypto.randomUUID(),
      date: row.date,
      description: row.description,
      amount: row.amount,
      category: row.category ?? 'Other',
      account,
    })
    if (!result.ok) {
      toast(result.reason, 'error')
      return
    }
    startTransition(() => dispatch({ type: 'ADD_MOVEMENTS', payload: result.value }))
    toast('Transaction added', 'success')
  }

  const handleDelete = useCallback(
    (id: string) => {
      const selected = state.movements.find((movement) => movement.id === id)
      if (!selected) return

      const ids = new Set([selected.id])
      if (selected.kind === 'purchase') {
        const rootId =
          selected.links?.find((linkedId) =>
            state.movements.some(
              (movement) => movement.id === linkedId && movement.kind === 'purchase',
            ),
          ) ?? selected.id
        for (const movement of state.movements) {
          if (
            movement.kind === 'purchase' &&
            (movement.id === rootId || movement.links?.includes(rootId))
          ) {
            ids.add(movement.id)
          }
        }
        for (const movement of state.movements) {
          if (movement.links?.some((linkedId) => ids.has(linkedId))) ids.add(movement.id)
        }
      }
      startTransition(() => {
        dispatch({ type: 'DELETE_MOVEMENTS', payload: [...ids] })
      })
      toast(
        ids.size > 1
          ? 'Purchase and linked activity deleted — Ctrl+Z to undo'
          : 'Transaction deleted — Ctrl+Z to undo',
        'info',
      )
    },
    [dispatch, state.movements, toast],
  )

  const handleRowOpen = useCallback((movement: Movement) => {
    if (movement.kind !== 'purchase' && movement.kind !== 'income') return
    setEditingMovement(movement)
    setShowEditForm(true)
  }, [])

  const handleFormClose = useCallback((open: boolean) => {
    setShowEditForm(open)
    if (!open) setEditingMovement(null)
  }, [])

  const clearAll =
    activeFilterCount > 0 || filterSearch ? (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={() => setSearchParams({}, { replace: true })}
      >
        Clear all
      </Button>
    ) : null

  const emptyMessage = view === 'spending' ? 'No spending transactions yet.' : 'No activity yet.'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Transactions</h2>
        <SegmentedControl
          aria-label="Transaction view"
          value={view}
          onValueChange={(value) => setView(value as 'spending' | 'activity')}
          options={[
            { value: 'spending', label: 'Spending' },
            { value: 'activity', label: 'All activity' },
          ]}
        />
      </div>
      <SmartTransactionInput
        onAdd={handleSmartAdd}
        onOpenModal={() => setShowAddForm(true)}
        knownDescriptions={knownDescriptions}
        categoriesForMonth={categoriesForMonth}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search description..."
          value={localSearch}
          onChange={(event) => setLocalSearch(event.target.value)}
          className="h-10 min-w-0 flex-1 text-xs sm:h-7 sm:w-44 sm:flex-none"
          aria-label="Search transactions"
        />
        {!isDesktop && (
          <Select
            value={sortKey ? `${sortKey}:${sortDir}` : 'date:desc'}
            onValueChange={(value) => {
              if (!value) return
              const [key, direction] = value.split(':')
              setSortKey(key === 'date' && direction === 'desc' ? null : key)
              setSortDir(direction as 'asc' | 'desc')
            }}
          >
            <SelectTrigger
              className="h-10 w-28 text-xs data-[size=default]:h-10 sm:h-7 sm:data-[size=default]:h-7"
              aria-label="Sort transactions"
            >
              <SelectValue>
                {SORT_OPTIONS.find(
                  (option) => option.value === (sortKey ? `${sortKey}:${sortDir}` : 'date:desc'),
                )?.compact ?? 'Sort'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isDesktop ? (
          <TransactionFilters
            filterType={filterType}
            filterMonth={filterMonth}
            filterCategories={filterCategories}
            filterPayments={filterPayments}
            filterCounterparties={filterCounterparties}
            months={months}
            allCategories={allCategories}
            allPaymentMethods={allPaymentMethods}
            allCounterparties={allCounterparties}
            showOtherType={view === 'activity'}
            updateParam={updateParam}
          />
        ) : (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className={`size-10 sm:size-8 ${activeFilterCount > 0 ? 'border-primary bg-muted text-foreground' : ''}`}
                />
              }
            >
              <FunnelIcon className="size-3" />
              <span className="sr-only">
                {activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
              </span>
            </PopoverTrigger>
            <PopoverContent className="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-3">
              <div className="flex flex-col gap-3">
                {clearAll}
                <TransactionFilters
                  filterType={filterType}
                  filterMonth={filterMonth}
                  filterCategories={filterCategories}
                  filterPayments={filterPayments}
                  filterCounterparties={filterCounterparties}
                  months={months}
                  allCategories={allCategories}
                  allPaymentMethods={allPaymentMethods}
                  allCounterparties={allCounterparties}
                  showOtherType={view === 'activity'}
                  updateParam={updateParam}
                  wide
                />
              </div>
            </PopoverContent>
          </Popover>
        )}

        {isDesktop && clearAll}
      </div>

      {isDesktop ? (
        <DesktopMovementList
          movements={filtered}
          debtRowsById={debtRowsById}
          emptyMessage={emptyMessage}
          installmentsById={installmentsById}
          onOpen={handleRowOpen}
          onRefund={setRefundPurchase}
          onDelete={handleDelete}
          onSort={handleSort}
          sortKey={sortKey}
          sortDir={sortDir}
        />
      ) : (
        <MobileMovementList
          movements={filtered}
          debtRowsById={debtRowsById}
          emptyMessage={emptyMessage}
          installmentsById={installmentsById}
          onOpen={handleRowOpen}
          onRefund={setRefundPurchase}
          onDelete={handleDelete}
        />
      )}

      {showEditForm && (
        <TransactionForm
          open
          onOpenChange={handleFormClose}
          editMovement={editingMovement}
          onDelete={handleDelete}
        />
      )}

      {showAddForm && <TransactionForm open onOpenChange={setShowAddForm} />}

      <RefundDialog
        purchase={refundPurchase}
        open={refundPurchase !== null}
        onOpenChange={(open) => {
          if (!open) setRefundPurchase(null)
        }}
      />
    </div>
  )
}
