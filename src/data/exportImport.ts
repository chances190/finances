import { v4 as uuid } from 'uuid'
import type { Budget, FinanceData, Transaction } from '../domain/entities'

export function exportJSON(data: FinanceData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `finances-${new Date().toISOString().slice(0, 10)}.json`)
}

export function importJSON(json: string): FinanceData {
  const data = JSON.parse(json) as FinanceData
  if (!Array.isArray(data.transactions) || !Array.isArray(data.budgets)) {
    throw new Error('Invalid format: expected { transactions: [], budgets: [] }')
  }
  return data
}

export function exportCSV(transactions: Transaction[]): void {
  const headers = [
    'date',
    'type',
    'amount',
    'category',
    'paymentMethod',
    'description',
    'referenceMonth',
    'isDebt',
    'debtorName',
    'debtNames',
    'debtAmounts',
    'isSettled',
    'installmentTotal',
    'installmentCurrent',
    'parentId',
    'groupId',
  ]
  const rows = transactions.map((t) => {
    const debtNames = t.debtSplits?.map((d) => d.debtorName).join('/') ?? ''
    const userAmount = t.debtSplits ? t.amount - t.debtSplits.reduce((s, d) => s + d.amount, 0) : 0
    const debtorAmounts = t.debtSplits?.map((d) => d.amount).join('/') ?? ''
    const debtAmounts = t.debtSplits?.length ? `${userAmount}//${debtorAmounts}` : ''

    return [
      t.date,
      t.type,
      String(t.amount),
      t.category,
      t.paymentMethod,
      t.description,
      t.referenceMonth,
      String(t.isDebt),
      t.debtorName ?? '',
      debtNames,
      debtAmounts,
      String(t.isSettled),
      t.installment?.total?.toString() ?? '',
      t.installment?.current?.toString() ?? '',
      t.parentId ?? '',
      t.groupId ?? '',
    ]
  })
  const csv = [
    headers.join(','),
    ...rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `finances-${new Date().toISOString().slice(0, 10)}.csv`)
}

export function importCSV(csv: string): Transaction[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')

  const headers = parseCSVLine(lines[0])
  const requiredFields = ['date', 'type', 'amount', 'category', 'paymentMethod']
  for (const field of requiredFields) {
    if (!headers.includes(field)) throw new Error(`Missing required column: ${field}`)
  }

  const transactions: Transaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    if (values.length !== headers.length) continue

    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx]]))

    const date = row.date
    const referenceMonth = row.referenceMonth || date.slice(0, 7)

    const t: Transaction = {
      id: uuid(),
      type: row.type as 'INCOME' | 'EXPENSE',
      date,
      referenceMonth,
      description: row.description || '',
      amount: parseFloat(row.amount) || 0,
      category: row.category || 'Other',
      paymentMethod: row.paymentMethod as Transaction['paymentMethod'],
      installment: row.installmentTotal
        ? {
            current: parseInt(row.installmentCurrent, 10) || 1,
            total: parseInt(row.installmentTotal, 10) || 1,
          }
        : undefined,
      parentId: row.parentId || undefined,
      groupId: row.groupId || undefined,
      isDebt: row.isDebt === 'true',
      debtorName: row.debtorName || undefined,
      isSettled: row.isSettled === 'true',
    }

    if (row.debtNames && row.debtAmounts) {
      const names = row.debtNames.split('/').filter(Boolean)
      const amounts = row.debtAmounts.split('//')
      const debtorAmounts = amounts[1]?.split('/').filter(Boolean) ?? []
      if (names.length === debtorAmounts.length && names.length > 0) {
        t.debtSplits = names.map((name, i) => ({
          debtorName: name,
          amount: parseFloat(debtorAmounts[i]) || 0,
        }))
      }
    }

    transactions.push(t)
  }

  return transactions
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportBudgetCSV(budgets: Budget[]): void {
  if (budgets.length === 0) return
  const allCategories = Array.from(new Set(budgets.flatMap((b) => Object.keys(b.categoryLimits))))
  const headers = ['referenceMonth', 'plannedIncome', 'plannedMealVoucher', ...allCategories]
  const rows = budgets.map((b) => [
    b.referenceMonth,
    String(b.plannedIncome),
    String(b.plannedMealVoucher),
    ...allCategories.map((cat) => String(b.categoryLimits[cat] ?? '')),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `finances-budgets-${new Date().toISOString().slice(0, 10)}.csv`)
}
