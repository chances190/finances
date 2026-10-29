import { FunnelIcon, SortAscendingIcon, SortDescendingIcon, TrashIcon } from '@phosphor-icons/react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useSearchParams } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
  compareTransactions,
  currentYM,
  monthRelation,
  type TransactionSortKey,
} from '@/domain/calculations'
import { allCategoryNames, categoryOptionsForMonth } from '@/domain/categories'
import {
  EXPENSE_PAYMENT_METHODS,
  INCOME_PAYMENT_METHODS,
  isExpensePaymentMethod,
  isIncomePaymentMethod,
  PAYMENT_METHOD_BADGE_COLORS,
} from '@/domain/constants'
import type { Debt, MonthlyFlow, PaymentMethod, Transaction } from '@/domain/entities'
import { monthlyFlows } from '@/domain/entities'
import { addCurrency, formatCurrency } from '@/lib/currency'
import EmptyState from '@/ui/components/Common/EmptyState'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import { useIsDesktop } from '@/ui/hooks/useIsDesktop'
import SmartTransactionInput from './SmartTransactionInput'
import TransactionForm from './TransactionForm'

const SORT_KEYS: [string, string][] = [
  ['paymentMethod', 'Payment'],
  ['amount', 'Amount'],
  ['description', 'Description'],
  ['category', 'Category'],
  ['date', 'Date'],
]

const SORT_ORDER_LABELS: Record<string, [string, string]> = {
  paymentMethod: ['Z to A', 'A to Z'],
  amount: ['High to low', 'Low to high'],
  description: ['Z to A', 'A to Z'],
  category: ['Z to A', 'A to Z'],
  date: ['Newest first', 'Oldest first'],
}

const SORT_OPTIONS = SORT_KEYS.flatMap(([key, label]) => {
  const [desc, asc] = SORT_ORDER_LABELS[key]
  return [
    { value: `${key}:desc`, label: `${label}: ${desc}`, compact: `${label} ↓` },
    { value: `${key}:asc`, label: `${label}: ${asc}`, compact: `${label} ↑` },
  ]
})

function PaymentBadge({ method, installment }: { method: PaymentMethod; installment?: string }) {
  return (
    <Badge variant="outline" className={PAYMENT_METHOD_BADGE_COLORS[method]}>
      {method}
      {installment && ` · Installment ${installment}`}
    </Badge>
  )
}

function debtsOf(tx: Transaction): Debt[] {
  return tx.type === 'Expense' ? (tx.debts ?? []) : []
}

function othersOwe(flow: MonthlyFlow): number {
  return addCurrency(flow.amount, -flow.ownAmount)
}

function SplitBreakdown({ flow }: { flow: MonthlyFlow }) {
  return (
    <div className="space-y-0.5 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">Others</span>
        <span className="font-mono">{formatCurrency(othersOwe(flow))}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2 font-medium">
        <span>You</span>
        <span className="font-mono">{formatCurrency(flow.ownAmount)}</span>
      </div>
    </div>
  )
}

const TransactionCard = memo(function TransactionCard({
  tx,
  flow,
  onEdit,
  onDelete,
}: {
  tx: Transaction
  flow: MonthlyFlow
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => void
}) {
  const debts = debtsOf(tx)
  const isFuture = monthRelation(flow.referenceMonth) === 'future'

  return (
    <div className={`px-3 py-1.5 ${isFuture ? 'opacity-45' : ''}`}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onEdit(tx)}
          className="min-w-0 flex-1 rounded-none py-1 text-left hover:bg-muted/30 focus-visible:outline focus-visible:outline-ring"
          title="Edit transaction"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-start gap-1 text-sm font-medium">
              <span className="min-w-0 flex-1 break-words">{tx.description}</span>
              {debts.length > 0 && debts.every((d) => d.settled) && (
                <Badge
                  variant="outline"
                  className="shrink-0 text-[10px] text-green-600 bg-green-50"
                >
                  Paid
                </Badge>
              )}
            </span>
            <span
              className={`shrink-0 font-mono text-sm font-semibold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}
            >
              {formatCurrency(flow.amount)}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <PaymentBadge
              method={tx.paymentMethod}
              installment={
                flow.installmentIndex != null
                  ? `${flow.installmentIndex + 1}/${flow.installmentTotal}`
                  : undefined
              }
            />
            <span>{flow.installmentIndex != null ? flow.referenceMonth : tx.date}</span>
            <Badge variant="outline" className="text-[10px]">
              {tx.category}
            </Badge>
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 size-10"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(tx.id)
          }}
          aria-label="Delete transaction"
        >
          <TrashIcon />
        </Button>
      </div>

      {othersOwe(flow) > 0 && (
        <div className="ml-2 mt-1 bg-muted/30 p-2">
          <SplitBreakdown flow={flow} />
        </div>
      )}
    </div>
  )
})

function getParamList(params: URLSearchParams, key: string): string[] {
  const val = params.get(key)
  return val ? val.split(',').filter(Boolean) : []
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
  filterPayments,
  filterDebtors,
  months,
  allCategories,
  allDebtors,
  updateParam,
  wide = false,
}: {
  filterType: string
  filterMonth: string
  filterCategories: string[]
  filterPayments: string[]
  filterDebtors: string[]
  months: string[]
  allCategories: string[]
  allDebtors: string[]
  updateParam: (key: string, value: string | string[] | null) => void
  wide?: boolean
}) {
  return (
    <>
      <Select value={filterType} onValueChange={(v) => updateParam('type', v)}>
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

      <Select value={filterMonth} onValueChange={(v) => updateParam('month', v)}>
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
          {months.map((m) => {
            const rel = monthRelation(m)
            return (
              <SelectItem
                key={m}
                value={m}
                className={
                  rel === 'future'
                    ? 'text-muted-foreground/60'
                    : rel === 'current'
                      ? 'text-primary font-medium'
                      : ''
                }
              >
                {m}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <FilterGroup
        idPrefix="pay-filter"
        label="Payment"
        options={[...EXPENSE_PAYMENT_METHODS, ...INCOME_PAYMENT_METHODS]}
        selected={filterPayments}
        count={filterPayments.length}
        onToggle={(pm, on) =>
          updateParam(
            'payment',
            on ? [...filterPayments, pm] : filterPayments.filter((p) => p !== pm),
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
        onToggle={(cat, on) =>
          updateParam(
            'category',
            on ? [...filterCategories, cat] : filterCategories.filter((c) => c !== cat),
          )
        }
        wide={wide}
      />

      {allDebtors.length > 0 && (
        <FilterGroup
          idPrefix="debtor-filter"
          label="Debtor"
          options={allDebtors}
          selected={filterDebtors}
          count={filterDebtors.length}
          onToggle={(name, on) =>
            updateParam(
              'debtor',
              on ? [...filterDebtors, name] : filterDebtors.filter((d) => d !== name),
            )
          }
          wide={wide}
        />
      )}
    </>
  )
})

const TransactionRow = memo(function TransactionRow({
  tx,
  flow,
  onEdit,
  onDelete,
}: {
  tx: Transaction
  flow: MonthlyFlow
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => void
}) {
  const txDebts = debtsOf(tx)
  const allDebtsSettled = txDebts.every((d) => d.settled)
  const isFuture = monthRelation(flow.referenceMonth) === 'future'

  return (
    <TableRow
      className={`cursor-pointer [content-visibility:auto] [contain-intrinsic-size:auto_2.5rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${isFuture ? 'opacity-45' : ''}`}
      tabIndex={0}
      onClick={() => onEdit(tx)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault()
        onEdit(tx)
      }}
    >
      <TableCell>
        <PaymentBadge method={tx.paymentMethod} />
      </TableCell>
      <TableCell
        className={`text-right font-mono text-xs ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}
      >
        {formatCurrency(flow.amount)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 truncate">{tx.description}</div>
          {txDebts.length > 0 && allDebtsSettled && (
            <Badge variant="outline" className="shrink-0 text-[10px] text-green-600 bg-green-50 ">
              Paid
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs">{tx.category}</TableCell>
      <TableCell className="text-xs">
        {flow.installmentIndex != null ? flow.referenceMonth : tx.date}
      </TableCell>
      <TableCell className="text-center text-xs">
        {flow.installmentIndex != null ? (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {flow.installmentIndex + 1}/{flow.installmentTotal}
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="text-xs">
        {othersOwe(flow) > 0 ? (
          <SplitBreakdown flow={flow} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <span className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDelete(tx.id)}
            aria-label="Delete transaction"
          >
            <TrashIcon />
          </Button>
        </span>
      </TableCell>
    </TableRow>
  )
})

export default function TransactionTable() {
  const { state, dispatch } = useFinance()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const { toast } = useToast()
  const isDesktop = useIsDesktop()

  const filterSearch = searchParams.get('search') ?? ''
  const filterMonth = searchParams.get('month') ?? 'all'
  const filterType = searchParams.get('type') ?? 'all'
  const filterCategories = useMemo(() => getParamList(searchParams, 'category'), [searchParams])
  const filterPayments = useMemo(() => getParamList(searchParams, 'payment'), [searchParams])
  const filterDebtors = useMemo(() => getParamList(searchParams, 'debtor'), [searchParams])
  const filterTxId = searchParams.get('tx')

  const [localSearch, setLocalSearch] = useState(filterSearch)

  useEffect(() => {
    setLocalSearch(filterSearch)
  }, [filterSearch])

  useEffect(() => {
    if (localSearch === filterSearch) return
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          if (localSearch) {
            prev.set('search', localSearch)
          } else {
            prev.delete('search')
          }
          return prev
        },
        { replace: true },
      )
    }, 150)
    return () => clearTimeout(timer)
  }, [localSearch, filterSearch, setSearchParams])

  useEffect(() => {
    if (filterTxId) {
      const tx = state.transactions.find((t) => t.id === filterTxId)
      if (tx) {
        setEditingTx(tx)
        setShowEditForm(true)
      }
      setSearchParams(
        (prev) => {
          prev.delete('tx')
          return prev
        },
        { replace: true },
      )
    }
  }, [filterTxId, setSearchParams, state.transactions])

  const updateParam = useCallback(
    (key: string, value: string | string[] | null) => {
      setSearchParams((prev) => {
        if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          prev.delete(key)
        } else if (Array.isArray(value)) {
          prev.set(key, value.join(','))
        } else if (value === 'all') {
          prev.delete(key)
        } else {
          prev.set(key, value)
        }
        return prev
      })
    },
    [setSearchParams],
  )

  const months = useMemo(() => availableMonths(state.transactions), [state.transactions])

  const knownDescriptions = useMemo(() => {
    const descs = new Set<string>()
    for (const t of state.transactions) {
      if (t.description) descs.add(t.description)
    }
    return Array.from(descs).sort()
  }, [state.transactions])

  const allCategories = useMemo(
    () => allCategoryNames(state.budgets, state.transactions),
    [state.budgets, state.transactions],
  )

  const categoriesForMonth = useCallback(
    (month: string | null) =>
      categoryOptionsForMonth(month ?? currentYM(), state.budgets, state.transactions),
    [state.budgets, state.transactions],
  )

  const allDebtors = useMemo(() => {
    const names = new Set<string>()
    for (const t of state.transactions) {
      for (const d of debtsOf(t)) {
        if (d.name) names.add(d.name)
      }
    }
    return Array.from(names).sort()
  }, [state.transactions])

  const filtered = useMemo(() => {
    let txs = state.transactions
    if (filterType !== 'all') {
      txs = txs.filter((t) => t.type === filterType)
    }
    if (filterMonth !== 'all') {
      txs = txs.filter((t) => monthlyFlows(t).some((f) => f.referenceMonth === filterMonth))
    }
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      txs = txs.filter((t) => t.description.toLowerCase().includes(q))
    }
    if (filterCategories.length > 0) {
      txs = txs.filter((t) => filterCategories.includes(t.category))
    }
    if (filterPayments.length > 0) {
      txs = txs.filter((t) => filterPayments.includes(t.paymentMethod))
    }
    if (filterDebtors.length > 0) {
      txs = txs.filter((t) => debtsOf(t).some((d) => filterDebtors.includes(d.name)))
    }
    if (sortKey) {
      txs = [...txs].sort((a, b) =>
        compareTransactions(a, b, sortKey as TransactionSortKey, sortDir),
      )
    } else {
      txs = [...txs].sort((a, b) => b.date.localeCompare(a.date))
    }
    return txs
  }, [
    state.transactions,
    filterType,
    filterMonth,
    filterSearch,
    filterCategories,
    filterPayments,
    filterDebtors,
    sortKey,
    sortDir,
  ])

  const rows = useMemo(
    () =>
      filtered.flatMap((tx) =>
        monthlyFlows(tx)
          .filter((f) => filterMonth === 'all' || f.referenceMonth === filterMonth)
          .map((flow) => ({ tx, flow }))
          .sort(
            (a, b) =>
              b.flow.referenceMonth.localeCompare(a.flow.referenceMonth) ||
              (a.flow.installmentIndex ?? 0) - (b.flow.installmentIndex ?? 0),
          ),
      ),
    [filtered, filterMonth],
  )

  const activeFilterCount =
    (filterType !== 'all' ? 1 : 0) +
    (filterMonth !== 'all' ? 1 : 0) +
    filterCategories.length +
    filterPayments.length +
    filterDebtors.length

  function handleSort(key: string) {
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
  }

  const sortIndicator = (key: string) => {
    if (sortKey !== key) return null
    return sortDir === 'asc' ? (
      <SortAscendingIcon className="size-3 inline ml-0.5" />
    ) : (
      <SortDescendingIcon className="size-3 inline ml-0.5" />
    )
  }

  function handleSmartAdd(row: {
    description: string
    amount: number
    category: string | null
    paymentMethod: PaymentMethod | null
    date: string
  }) {
    if (row.amount <= 0) return
    const amount = row.amount

    const method = row.paymentMethod ?? 'Debit/PIX'

    if (isIncomePaymentMethod(method)) {
      dispatch({
        type: 'ADD_TRANSACTIONS',
        payload: [
          {
            id: uuid(),
            type: 'Income',
            date: row.date,
            description: row.description,
            amount,
            category: 'Income',
            paymentMethod: method,
          },
        ],
      })
    } else {
      dispatch({
        type: 'ADD_TRANSACTIONS',
        payload: [
          {
            id: uuid(),
            type: 'Expense',
            date: row.date,
            description: row.description,
            amount,
            category: row.category ?? 'Other',
            paymentMethod: isExpensePaymentMethod(method) ? method : 'Debit/PIX',
          },
        ],
      })
    }
    toast('Transaction added', 'success')
  }

  const handleDelete = useCallback(
    (id: string) => {
      dispatch({ type: 'DELETE_TRANSACTION', payload: id })
      toast('Transaction deleted', 'info')
    },
    [dispatch, toast],
  )

  const handleEdit = useCallback((tx: Transaction) => {
    setEditingTx(tx)
    setShowEditForm(true)
  }, [])

  const handleFormClose = useCallback((open: boolean) => {
    setShowEditForm(open)
    if (!open) setEditingTx(null)
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
          onChange={(e) => setLocalSearch(e.target.value)}
          className="h-10 min-w-0 flex-1 text-xs sm:h-7 sm:w-44 sm:flex-none"
          aria-label="Search transactions"
        />
        {!isDesktop && (
          <Select
            value={sortKey ? `${sortKey}:${sortDir}` : 'none'}
            onValueChange={(v) => {
              if (v === null || v === 'none') {
                setSortKey(null)
                setSortDir('desc')
              } else {
                const [key, direction] = v.split(':')
                setSortKey(key)
                setSortDir(direction as 'asc' | 'desc')
              }
            }}
          >
            <SelectTrigger
              className="h-10 w-28 text-xs data-[size=default]:h-10 sm:h-7 sm:data-[size=default]:h-7"
              aria-label="Sort transactions"
            >
              <SelectValue>
                {SORT_OPTIONS.find(
                  (option) => option.value === (sortKey ? `${sortKey}:${sortDir}` : ''),
                )?.compact ?? 'Sort'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default order</SelectItem>
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
            filterDebtors={filterDebtors}
            months={months}
            allCategories={allCategories}
            allDebtors={allDebtors}
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
                  filterPayments={filterPayments}
                  filterDebtors={filterDebtors}
                  months={months}
                  allCategories={allCategories}
                  allDebtors={allDebtors}
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

      {isDesktop && (
        <div className="border border-border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">
                  <button
                    type="button"
                    onClick={() => handleSort('paymentMethod')}
                    className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
                  >
                    Payment{sortIndicator('paymentMethod')}
                  </button>
                </TableHead>
                <TableHead className="text-right w-24">
                  <button
                    type="button"
                    onClick={() => handleSort('amount')}
                    className="flex w-full cursor-pointer select-none items-center justify-end gap-0.5 text-right font-medium"
                  >
                    Amount{sortIndicator('amount')}
                  </button>
                </TableHead>
                <TableHead className="flex-1">
                  <button
                    type="button"
                    onClick={() => handleSort('description')}
                    className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
                  >
                    Description{sortIndicator('description')}
                  </button>
                </TableHead>
                <TableHead className="w-20">
                  <button
                    type="button"
                    onClick={() => handleSort('category')}
                    className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
                  >
                    Category{sortIndicator('category')}
                  </button>
                </TableHead>
                <TableHead className="w-24">
                  <button
                    type="button"
                    onClick={() => handleSort('date')}
                    className="flex w-full cursor-pointer select-none items-center gap-0.5 text-left font-medium"
                  >
                    Date{sortIndicator('date')}
                  </button>
                </TableHead>
                <TableHead className="w-24 text-center">Installment</TableHead>
                <TableHead className="w-28">Split</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState variant="cell" message="No transactions yet." />
                  </TableCell>
                </TableRow>
              )}

              {rows.map(({ tx, flow }) => (
                <TransactionRow
                  key={`${tx.id}-${flow.referenceMonth}-${flow.installmentIndex ?? 0}`}
                  tx={tx}
                  flow={flow}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!isDesktop && (
        <div className="space-y-2">
          {rows.length === 0 ? (
            <EmptyState message="No transactions yet." />
          ) : (
            rows.map(({ tx, flow }) => (
              <div
                key={`${tx.id}-${flow.referenceMonth}-${flow.installmentIndex ?? 0}`}
                className="border border-border [content-visibility:auto] [contain-intrinsic-size:auto_6rem]"
              >
                <TransactionCard tx={tx} flow={flow} onEdit={handleEdit} onDelete={handleDelete} />
              </div>
            ))
          )}
        </div>
      )}

      <TransactionForm
        open={showEditForm}
        onOpenChange={handleFormClose}
        editTransaction={editingTx}
      />

      <TransactionForm open={showAddForm} onOpenChange={setShowAddForm} />
    </div>
  )
}
