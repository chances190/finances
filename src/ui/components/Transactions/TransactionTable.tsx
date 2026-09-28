import {
  CheckCircleIcon,
  FunnelIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { availableMonths, compareTransactions, monthRelation } from '@/domain/calculations'
import { getAllCategories } from '@/domain/categories'
import {
  INCOME_PAYMENT_METHODS,
  PAYMENT_METHOD_BADGE_COLORS,
  PAYMENT_METHODS,
} from '@/domain/constants'
import type { MonthlyFlow, PaymentMethod, Transaction } from '@/domain/entities'
import { monthlyFlows } from '@/domain/entities'
import { formatCurrency, parseCurrency } from '@/lib/currency'
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

function PaymentBadge({ method }: { method: string }) {
  return (
    <Badge variant="outline" className={PAYMENT_METHOD_BADGE_COLORS[method] ?? ''}>
      {method}
    </Badge>
  )
}

function TransactionCard({
  tx,
  flow,
  onEdit,
  onSettleDebt,
  onDelete,
}: {
  tx: Transaction
  flow: MonthlyFlow
  onEdit: () => void
  onSettleDebt: (name: string) => void
  onDelete: () => void
}) {
  const debts = tx.debts ?? []
  const isFuture = monthRelation(flow.referenceMonth) === 'future'

  return (
    <div className={`px-3 pt-0 pb-3 ${isFuture ? 'opacity-45' : ''}`}>
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-start gap-2 py-3 text-left"
      >
        <span className="min-w-0 flex-1 text-sm font-medium break-words">{tx.description}</span>
        {debts.length > 0 && debts.every((d) => d.settled) && (
          <Badge variant="outline" className="shrink-0 text-[10px] text-green-600 bg-green-50">
            Paid
          </Badge>
        )}
        <span
          className={`shrink-0 font-mono text-sm font-semibold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}
        >
          {formatCurrency(flow.amount)}
        </span>
      </button>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <PaymentBadge method={tx.paymentMethod} />
        <span className="text-xs text-muted-foreground">
          {flow.installmentIndex != null ? flow.referenceMonth : tx.date}
        </span>
        <span className="text-xs">{tx.category}</span>
        {flow.installmentIndex != null && (
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {flow.installmentIndex + 1}/{flow.installmentTotal}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-10"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Delete transaction"
        >
          <TrashIcon />
        </Button>
      </div>

      {debts.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          {debts.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-2">
              <span className={`text-xs text-muted-foreground ${d.settled ? 'line-through' : ''}`}>
                {d.name}: {formatCurrency(d.amount)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={(e) => {
                  e.stopPropagation()
                  onSettleDebt(d.name)
                }}
                title={d.settled ? `Unsettle ${d.name}` : `Settle ${d.name}`}
                aria-label={d.settled ? `Unsettle ${d.name}` : `Settle ${d.name}`}
              >
                <CheckCircleIcon />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
        <span key={option} className="flex items-center gap-2 py-1 cursor-pointer">
          <Checkbox
            id={`${idPrefix}-${option}`}
            checked={selected.includes(option)}
            onCheckedChange={(checked) => onToggle(option, checked === true)}
          />
          <span className="text-xs">{option}</span>
        </span>
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
        <div className="max-h-48 overflow-y-auto">{list}</div>
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
        <div className="max-h-48 overflow-y-auto">{list}</div>
      </PopoverContent>
    </Popover>
  )
}

function TransactionFilters({
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
        <SelectTrigger className={wide ? 'h-9 w-full text-xs' : 'h-7 w-24 text-xs'}>
          <SelectValue>{filterType === 'all' ? 'All types' : filterType}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="Expense">Expense</SelectItem>
          <SelectItem value="Income">Income</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filterMonth} onValueChange={(v) => updateParam('month', v)}>
        <SelectTrigger className={wide ? 'h-9 w-full text-xs' : 'h-7 w-28 text-xs'}>
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

      <FilterGroup
        idPrefix="pay-filter"
        label="Payment"
        options={[...PAYMENT_METHODS, ...INCOME_PAYMENT_METHODS]}
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
}

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
  const filterCategories = getParamList(searchParams, 'category')
  const filterPayments = getParamList(searchParams, 'payment')
  const filterDebtors = getParamList(searchParams, 'debtor')
  const filterTxId = searchParams.get('tx')

  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const [localSearch, setLocalSearch] = useState(filterSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(filterSearch)

  useEffect(() => {
    setLocalSearch(filterSearch)
    setDebouncedSearch(filterSearch)
  }, [filterSearch])

  useEffect(() => {
    searchTimer.current = setTimeout(() => {
      setSearchParams(
        (prev) => {
          if (debouncedSearch) {
            prev.set('search', debouncedSearch)
          } else {
            prev.delete('search')
          }
          return prev
        },
        { replace: true },
      )
    }, 150)
    return () => clearTimeout(searchTimer.current)
  }, [debouncedSearch, setSearchParams])

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

  function updateParam(key: string, value: string | string[] | null) {
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
  }

  const months = useMemo(() => availableMonths(state.transactions), [state.transactions])

  const knownDescriptions = useMemo(() => {
    const descs = new Set<string>()
    for (const t of state.transactions) {
      if (t.description) descs.add(t.description)
    }
    return Array.from(descs).sort()
  }, [state.transactions])

  const allCategories = useMemo(
    () => getAllCategories(state.budgets, state.transactions),
    [state.budgets, state.transactions],
  )

  const allDebtors = useMemo(() => {
    const names = new Set<string>()
    for (const t of state.transactions) {
      for (const d of t.debts ?? []) {
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
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      txs = txs.filter((t) => t.description.toLowerCase().includes(q))
    }
    if (filterCategories.length > 0) {
      txs = txs.filter((t) => filterCategories.includes(t.category))
    }
    if (filterPayments.length > 0) {
      txs = txs.filter((t) => filterPayments.includes(t.paymentMethod))
    }
    if (filterDebtors.length > 0) {
      txs = txs.filter((t) => t.debts?.some((d) => filterDebtors.includes(d.name)))
    }
    if (sortKey) {
      txs = [...txs].sort((a, b) =>
        compareTransactions(a, b, sortKey as keyof Transaction, sortDir),
      )
    } else {
      txs = [...txs].sort((a, b) => b.date.localeCompare(a.date))
    }
    return txs
  }, [
    state.transactions,
    filterType,
    filterMonth,
    debouncedSearch,
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
    amount: string
    category: string | null
    paymentMethod: string | null
    date: string
    error: string | null
  }) {
    const amount = parseCurrency(row.amount)
    if (amount <= 0) return

    const isIncome =
      row.paymentMethod && INCOME_PAYMENT_METHODS.includes(row.paymentMethod as PaymentMethod)

    const tx: Transaction = {
      id: uuid(),
      type: isIncome ? 'Income' : 'Expense',
      date: row.date,
      description: row.description,
      amount,
      category: isIncome ? 'Income' : (row.category ?? 'Other'),
      paymentMethod: (row.paymentMethod ?? 'Debit') as PaymentMethod,
    }

    dispatch({ type: 'ADD_TRANSACTIONS', payload: [tx] })
    toast('Transaction added', 'success')
  }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id })
    toast('Transaction deleted', 'info')
  }

  function handleSettleDebt(id: string, debtName: string) {
    dispatch({ type: 'SETTLE_DEBT', payload: { transactionId: id, debtName } })
  }

  function handleEdit(tx: Transaction) {
    setEditingTx(tx)
    setShowEditForm(true)
  }

  function handleFormClose(open: boolean) {
    setShowEditForm(open)
    if (!open) setEditingTx(null)
  }

  const clearAll =
    activeFilterCount > 0 || filterSearch ? (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground"
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
        categories={allCategories}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search description..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="h-7 w-44 text-xs"
          aria-label="Search transactions"
        />
        {!isDesktop && (
          <Select
            value={sortKey ?? 'none'}
            onValueChange={(v) => {
              if (v === null || v === 'none') setSortKey(null)
              else handleSort(v)
            }}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue>
                {sortKey
                  ? `${SORT_KEYS.find(([k]) => k === sortKey)?.[1] ?? sortKey} ${sortDir === 'asc' ? '↑' : '↓'}`
                  : 'Sort'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default order</SelectItem>
              {SORT_KEYS.map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
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
                  variant={activeFilterCount > 0 ? 'default' : 'outline'}
                  size="icon-sm"
                  className="size-8"
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
          <Table>
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
                <TableHead className="w-16 text-center">Install</TableHead>
                <TableHead className="w-32">Debts</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      variant="cell"
                      message="No transactions yet. Add one using the row above or import a CSV file."
                    />
                  </TableCell>
                </TableRow>
              )}

              {rows.map(({ tx, flow }) => {
                const allDebtsSettled = tx.debts?.every((d) => d.settled) ?? true
                const isFuture = monthRelation(flow.referenceMonth) === 'future'
                return (
                  <TableRow
                    key={`${tx.id}-${flow.referenceMonth}-${flow.installmentIndex ?? 0}`}
                    className={`cursor-pointer ${isFuture ? 'opacity-45' : ''}`}
                    onClick={() => handleEdit(tx)}
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
                        <div className="max-w-48 truncate">{tx.description}</div>
                        {tx.debts && tx.debts.length > 0 && allDebtsSettled && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-green-600 bg-green-50 "
                          >
                            Paid
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{tx.category}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {flow.installmentIndex != null ? flow.referenceMonth : tx.date}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {flow.installmentIndex != null ? (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {flow.installmentIndex + 1}/{flow.installmentTotal}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {tx.debts && tx.debts.length > 0 ? (
                        <div className="text-xs space-y-0.5">
                          {tx.debts.map((d) => (
                            <div key={d.name} className="flex items-center justify-between gap-2">
                              <span
                                className={`text-muted-foreground ${d.settled ? 'line-through' : ''}`}
                              >
                                {d.name}: {formatCurrency(d.amount)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSettleDebt(tx.id, d.name)
                                }}
                                title={d.settled ? `Unsettle ${d.name}` : `Settle ${d.name}`}
                                aria-label={d.settled ? `Unsettle ${d.name}` : `Settle ${d.name}`}
                              >
                                <CheckCircleIcon />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <span className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(tx.id)}
                          aria-label="Delete transaction"
                        >
                          <TrashIcon />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!isDesktop && (
        <div className="border border-border">
          {rows.length === 0 ? (
            <EmptyState message="No transactions yet. Add one using the row above or import a CSV file." />
          ) : (
            rows.map(({ tx, flow }) => (
              <div
                key={`${tx.id}-${flow.referenceMonth}-${flow.installmentIndex ?? 0}`}
                className="border-b border-border last:border-b-0"
              >
                <TransactionCard
                  tx={tx}
                  flow={flow}
                  onEdit={() => handleEdit(tx)}
                  onSettleDebt={(name) => handleSettleDebt(tx.id, name)}
                  onDelete={() => handleDelete(tx.id)}
                />
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
