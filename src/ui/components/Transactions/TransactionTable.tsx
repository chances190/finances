import {
  ArrowUUpLeftIcon,
  FunnelIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'wouter'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  buildIncome,
  buildPurchase,
  buildRefund,
  categoryOf,
  counterpartyOf,
  expenseAmount,
  FUNDING_ACCOUNTS,
  type FundingAccount,
  fundingAccountOf,
  grossPurchaseAmount,
  incomeAmount,
  localYMD,
  MOVEMENT_KIND_LABELS,
  type Movement,
  movementMonth,
  movementTotal,
  refundAmount,
  refundableAmount,
  settlementTotal,
  transferAccounts,
} from '@/domain/ledger'
import { addCurrency, formatCurrency, formatPlainCurrency, parseCurrency } from '@/lib/currency'
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
  { value: 'account:asc', label: 'Account: A to Z', compact: 'Account ↑' },
]

function accountOf(movement: Movement): FundingAccount | null {
  if (movement.kind === 'transfer') {
    const accounts = transferAccounts(movement)
    return (accounts?.[0] as FundingAccount | undefined) ?? null
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

function detailOf(movement: Movement): string {
  if (movement.kind === 'transfer') {
    const accounts = transferAccounts(movement)
    if (accounts) return `${ACCOUNT_LABELS[accounts[0]]} → ${ACCOUNT_LABELS[accounts[1]]}`
  }
  if (movement.kind === 'purchase') {
    const payer = movement.postings.find((posting) => posting.account === 'payable')?.counterparty
    if (payer) return `Paid by ${payer}`
    const owed = movement.postings
      .filter((posting) => posting.account === 'receivable' && posting.counterparty)
      .map((posting) => posting.counterparty)
    if (owed.length > 0) return `Owed by ${owed.join(', ')}`
  }
  if (movement.kind === 'settlement') {
    const counterparty = counterpartyOf(movement)
    if (counterparty) return `Settled with ${counterparty}`
  }
  return '—'
}

function ownedShare(movement: Movement): number {
  return expenseAmount(movement)
}

function AccountBadge({ account }: { account: FundingAccount | null }) {
  if (!account) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <Badge variant="outline" className={ACCOUNT_BADGE_COLORS[account]}>
      {account === 'payable' ? 'Someone else' : ACCOUNT_LABELS[account]}
    </Badge>
  )
}

const MovementCard = memo(function MovementCard({
  movement,
  onOpen,
  onRefund,
  onDelete,
}: {
  movement: Movement
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
}) {
  const isFuture = monthRelation(movementMonth(movement)) === 'future'
  const account = accountOf(movement)

  return (
    <div className={`px-3 py-1.5 ${isFuture ? 'opacity-45' : ''}`}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onOpen(movement)}
          className="min-w-0 flex-1 rounded-none py-1 text-left hover:bg-muted/30 focus-visible:outline focus-visible:outline-ring"
          title={
            movement.kind === 'purchase' || movement.kind === 'income'
              ? 'Edit movement'
              : 'View movement'
          }
        >
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 flex-1 break-words text-sm font-medium">
              {movement.description}
            </span>
            <span className={`shrink-0 font-mono text-sm font-semibold ${amountClass(movement)}`}>
              {formatCurrency(amountOf(movement))}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Badge variant="outline" className="text-[10px]">
              {MOVEMENT_KIND_LABELS[movement.kind]}
            </Badge>
            <AccountBadge account={account} />
            {categoryOf(movement) && (
              <Badge variant="outline" className="text-[10px]">
                {categoryOf(movement)}
              </Badge>
            )}
            <span>{movement.date}</span>
          </span>
          {detailOf(movement) !== '—' && (
            <span className="mt-1 block text-[10px] text-muted-foreground">
              {detailOf(movement)}
            </span>
          )}
        </button>
        {movement.kind === 'purchase' && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 size-10"
            onClick={(event) => {
              event.stopPropagation()
              onRefund(movement)
            }}
            aria-label="Received back"
          >
            <ArrowUUpLeftIcon />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 size-10"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(movement.id)
          }}
          aria-label="Delete movement"
        >
          <TrashIcon />
        </Button>
      </div>

      {movement.kind === 'purchase' &&
        (movement.links?.length || ownedShare(movement) !== amountOf(movement)) && (
          <div className="ml-2 mt-1 bg-muted/30 p-2 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Others</span>
              <span className="font-mono">
                {formatCurrency(addCurrency(amountOf(movement), -ownedShare(movement)))}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 font-medium">
              <span>You</span>
              <span className="font-mono">{formatCurrency(ownedShare(movement))}</span>
            </div>
          </div>
        )}
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
  options: string[]
  selected: string[]
  count: number
  onToggle: (option: string, on: boolean) => void
  wide: boolean
}) {
  const list = (
    <div className="space-y-1">
      {options.map((option) => (
        <label
          key={option}
          htmlFor={`${idPrefix}-${option}`}
          className="flex min-h-10 cursor-pointer items-center gap-2 py-1"
        >
          <Checkbox
            id={`${idPrefix}-${option}`}
            checked={selected.includes(option)}
            onCheckedChange={(checked) => onToggle(option, checked === true)}
          />
          <span className="text-xs">{option}</span>
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
  filterAccounts,
  filterCounterparties,
  months,
  allCategories,
  allCounterparties,
  updateParam,
  wide = false,
}: {
  filterType: string
  filterMonth: string
  filterCategories: string[]
  filterAccounts: string[]
  filterCounterparties: string[]
  months: string[]
  allCategories: string[]
  allCounterparties: string[]
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
        idPrefix="account-filter"
        label="Account"
        options={FUNDING_ACCOUNTS.map((account) =>
          account === 'payable' ? 'Someone else' : ACCOUNT_LABELS[account],
        )}
        selected={filterAccounts}
        count={filterAccounts.length}
        onToggle={(account, on) =>
          updateParam(
            'account',
            on ? [...filterAccounts, account] : filterAccounts.filter((item) => item !== account),
          )
        }
        wide={wide}
      />

      <FilterGroup
        idPrefix="cat-filter"
        label="Category"
        options={allCategories}
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
          options={allCounterparties}
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
  onOpen,
  onRefund,
  onDelete,
}: {
  movement: Movement
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
}) {
  const account = accountOf(movement)
  return (
    <>
      <TableCell>
        <AccountBadge account={account} />
      </TableCell>
      <TableCell className={cn('text-right font-mono text-xs', amountClass(movement))}>
        {formatCurrency(amountOf(movement))}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 truncate">{movement.description}</div>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {MOVEMENT_KIND_LABELS[movement.kind]}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-xs">{categoryOf(movement) ?? '—'}</TableCell>
      <TableCell className="text-xs">{movement.date}</TableCell>
      <TableCell className="max-w-36 truncate text-xs text-muted-foreground">
        {detailOf(movement)}
      </TableCell>
      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
        <span className="flex justify-end gap-1">
          {(movement.kind === 'purchase' || movement.kind === 'income') && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onOpen(movement)}
              aria-label="Edit movement"
            >
              <span className="text-xs">Edit</span>
            </Button>
          )}
          {movement.kind === 'purchase' && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onRefund(movement)}
              aria-label="Received back"
            >
              <ArrowUUpLeftIcon />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDelete(movement.id)}
            aria-label="Delete movement"
          >
            <TrashIcon />
          </Button>
        </span>
      </TableCell>
    </>
  )
})

const DesktopMovementList = memo(function DesktopMovementList({
  movements,
  onOpen,
  onRefund,
  onDelete,
  onSort,
  sortKey,
  sortDir,
}: {
  movements: Movement[]
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
            <TableHead className="w-24">
              <button
                type="button"
                onClick={() => onSort('account')}
                className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
              >
                Account{indicator('account')}
              </button>
            </TableHead>
            <TableHead className="w-24 text-right">
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
            <TableHead className="w-24">
              <button
                type="button"
                onClick={() => onSort('date')}
                className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
              >
                Date{indicator('date')}
              </button>
            </TableHead>
            <TableHead className="w-36">Detail</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <tbody ref={bodyRef} className="[&_tr:last-child]:border-0">
          {movements.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyState variant="cell" message="No movements yet." />
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
                  onOpen={onOpen}
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
  onOpen,
  onRefund,
  onDelete,
}: {
  movements: Movement[]
  onOpen: (movement: Movement) => void
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const scrollMargin = useScrollMargin(listRef)
  const rowVirtualizer = useWindowVirtualizer({
    count: movements.length,
    estimateSize: () => 104,
    overscan: 8,
    gap: 8,
    scrollMargin,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <div
      ref={listRef}
      style={
        movements.length > 0
          ? { height: rowVirtualizer.getTotalSize(), position: 'relative' }
          : undefined
      }
    >
      {movements.length === 0 ? (
        <EmptyState message="No movements yet." />
      ) : (
        virtualRows.map((virtualRow) => {
          const movement = movements[virtualRow.index]
          return (
            <div
              key={movement.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <div className="border border-border">
                <MovementCard
                  movement={movement}
                  onOpen={onOpen}
                  onRefund={onRefund}
                  onDelete={onDelete}
                />
              </div>
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
  const [account, setAccount] = useState<FundingAccount>('card')
  const [date, setDate] = useState(localYMD())
  const [description, setDescription] = useState('Received back')

  const available = purchase ? refundableAmount(purchase, state.movements) : 0

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setAmount('')
    setDate(localYMD())
    setDescription('Received back')
    setAccount(purchase ? (fundingAccountOf(purchase) ?? 'card') : 'card')
  }, [purchase, open])

  function handleSave() {
    if (!purchase) return
    const parsed = parseCurrency(amount)
    const result = buildRefund({
      id: crypto.randomUUID(),
      date,
      description,
      amount: parsed,
      account,
      purchase,
      existing: state.movements,
    })
    if (!result.ok) {
      toast(result.reason, 'error')
      return
    }
    startTransition(() => dispatch({ type: 'ADD_MOVEMENTS', payload: [result.value] }))
    toast('Refund recorded', 'success')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Received back</DialogTitle>
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
                Received in
              </Label>
              <Select
                modal={false}
                value={account}
                onValueChange={(value) => setAccount((value ?? 'card') as FundingAccount)}
              >
                <SelectTrigger id="refund-account" className="w-full">
                  <SelectValue>{ACCOUNT_LABELS[account]}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {FUNDING_ACCOUNTS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ACCOUNT_LABELS[option]}
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

function MovementDetailsDialog({
  movement,
  open,
  onOpenChange,
}: {
  movement: Movement | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{movement?.description ?? 'Movement'}</DialogTitle>
          <DialogDescription>
            {movement ? `${MOVEMENT_KIND_LABELS[movement.kind]} · ${movement.date}` : ''}
          </DialogDescription>
        </DialogHeader>
        {movement && (
          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movement.postings.map((posting, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: posting rows are positional
                  <TableRow key={index}>
                    <TableCell className="text-xs">{ACCOUNT_LABELS[posting.account]}</TableCell>
                    <TableCell className="text-xs">{posting.category ?? '—'}</TableCell>
                    <TableCell className="text-xs">{posting.counterparty ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatPlainCurrency(posting.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
  const [detailsMovement, setDetailsMovement] = useState<Movement | null>(null)
  const { toast } = useToast()
  const isDesktop = useIsDesktop()

  const filterSearch = searchParams.get('search') ?? ''
  const filterMonth = searchParams.get('month') ?? 'all'
  const filterType = searchParams.get('type') ?? 'all'
  const filterCategories = useMemo(() => getParamList(searchParams, 'category'), [searchParams])
  const filterAccounts = useMemo(() => getParamList(searchParams, 'account'), [searchParams])
  const filterCounterparties = useMemo(() => getParamList(searchParams, 'person'), [searchParams])
  const filterMovementId = searchParams.get('movement')

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

  useEffect(() => {
    if (!filterMovementId) return
    const movement = state.movements.find((candidate) => candidate.id === filterMovementId)
    if (movement) {
      if (movement.kind === 'purchase' || movement.kind === 'income') {
        setEditingMovement(movement)
        setShowEditForm(true)
      } else {
        setDetailsMovement(movement)
      }
    }
    setSearchParams(
      (previous) => {
        previous.delete('movement')
        return previous
      },
      { replace: true },
    )
  }, [filterMovementId, setSearchParams, state.movements])

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

  const filtered = useMemo(() => {
    let movements = state.movements
    if (filterType === 'Expense') {
      movements = movements.filter(
        (movement) => movement.kind === 'purchase' || movement.kind === 'refund',
      )
    } else if (filterType === 'Income') {
      movements = movements.filter((movement) => movement.kind === 'income')
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
    if (filterAccounts.length > 0) {
      movements = movements.filter((movement) => {
        const account = accountOf(movement)
        if (!account) return false
        const label = account === 'payable' ? 'Someone else' : ACCOUNT_LABELS[account]
        return filterAccounts.includes(label)
      })
    }
    if (filterCounterparties.length > 0) {
      movements = movements.filter((movement) =>
        movement.postings.some(
          (posting) => posting.counterparty && filterCounterparties.includes(posting.counterparty),
        ),
      )
    }
    if (sortKey) {
      movements = [...movements].sort((a, b) =>
        compareMovements(a, b, sortKey as MovementSortKey, sortDir),
      )
    } else {
      movements = [...movements].sort((a, b) => b.date.localeCompare(a.date))
    }
    return movements
  }, [
    state.movements,
    filterType,
    filterMonth,
    filterSearch,
    filterCategories,
    filterAccounts,
    filterCounterparties,
    sortKey,
    sortDir,
  ])

  const activeFilterCount =
    (filterType !== 'all' ? 1 : 0) +
    (filterMonth !== 'all' ? 1 : 0) +
    filterCategories.length +
    filterAccounts.length +
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
    paymentMethod: FundingAccount | null
    kind: 'income' | 'expense' | null
    date: string
  }) {
    if (row.amount <= 0) return
    const account =
      row.paymentMethod && FUNDING_ACCOUNTS.includes(row.paymentMethod)
        ? row.paymentMethod
        : 'checking'

    if (row.kind === 'income') {
      const result = buildIncome({
        id: crypto.randomUUID(),
        date: row.date,
        description: row.description,
        amount: row.amount,
        account: account === 'voucher' || account === 'cash' ? account : 'checking',
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
      const refunds = state.movements
        .filter((movement) => movement.kind === 'refund' && movement.links?.includes(id))
        .map((movement) => movement.id)
      startTransition(() => {
        dispatch({ type: 'DELETE_MOVEMENT', payload: id })
        for (const refundId of refunds) {
          dispatch({ type: 'DELETE_MOVEMENT', payload: refundId })
        }
      })
      toast('Transaction deleted', 'info')
    },
    [dispatch, state.movements, toast],
  )

  const handleOpen = useCallback((movement: Movement) => {
    if (movement.kind === 'purchase' || movement.kind === 'income') {
      setEditingMovement(movement)
      setShowEditForm(true)
    } else {
      setDetailsMovement(movement)
    }
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
        className="h-10 text-xs text-muted-foreground sm:h-7"
        onClick={() => setSearchParams({}, { replace: true })}
      >
        Clear all
      </Button>
    ) : null

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Transactions</h2>
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
            filterAccounts={filterAccounts}
            filterCounterparties={filterCounterparties}
            months={months}
            allCategories={allCategories}
            allCounterparties={allCounterparties}
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
                <TransactionFilters
                  filterType={filterType}
                  filterMonth={filterMonth}
                  filterCategories={filterCategories}
                  filterAccounts={filterAccounts}
                  filterCounterparties={filterCounterparties}
                  months={months}
                  allCategories={allCategories}
                  allCounterparties={allCounterparties}
                  updateParam={updateParam}
                  wide
                />
                {clearAll}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {isDesktop && clearAll}
      </div>

      {isDesktop ? (
        <DesktopMovementList
          movements={filtered}
          onOpen={handleOpen}
          onRefund={setRefundPurchase}
          onDelete={handleDelete}
          onSort={handleSort}
          sortKey={sortKey}
          sortDir={sortDir}
        />
      ) : (
        <MobileMovementList
          movements={filtered}
          onOpen={handleOpen}
          onRefund={setRefundPurchase}
          onDelete={handleDelete}
        />
      )}

      {showEditForm && (
        <TransactionForm open onOpenChange={handleFormClose} editMovement={editingMovement} />
      )}

      {showAddForm && <TransactionForm open onOpenChange={setShowAddForm} />}

      <RefundDialog
        purchase={refundPurchase}
        open={refundPurchase !== null}
        onOpenChange={(open) => {
          if (!open) setRefundPurchase(null)
        }}
      />

      <MovementDetailsDialog
        movement={detailsMovement}
        open={detailsMovement !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsMovement(null)
        }}
      />
    </div>
  )
}
