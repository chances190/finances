import { v4 as uuid } from 'uuid'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../domain/constants'
import type { FinanceData, PaymentMethod, Transaction, TransactionType } from '../domain/entities'
import { parseCurrency } from '../lib/currency'
import { validateFinanceData } from './validation'

function parseType(s: string | undefined): TransactionType {
  return s && TRANSACTION_TYPES.includes(s as (typeof TRANSACTION_TYPES)[number])
    ? (s as TransactionType)
    : 'EXPENSE'
}

function parsePaymentMethod(s: string | undefined): PaymentMethod {
  return s && PAYMENT_METHODS.includes(s as PaymentMethod) ? (s as PaymentMethod) : 'DEBIT'
}

export function exportJSON(data: FinanceData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `finances-${new Date().toISOString().slice(0, 10)}.json`)
}

export function importJSON(json: string): FinanceData {
  return validateFinanceData(JSON.parse(json))
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
    'debtUserShare',
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
    const debtorAmounts = t.debtSplits?.map((d) => d.amount).join('/') ?? ''
    const debtAmounts = t.debtSplits?.length ? debtorAmounts : ''

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
      String(t.debtUserShare ?? 0),
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
      type: parseType(row.type),
      date,
      referenceMonth,
      description: row.description || '',
      amount: parseCurrency(row.amount),
      category: row.category || 'Other',
      paymentMethod: parsePaymentMethod(row.paymentMethod),
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
      const amounts = row.debtAmounts.split('/').filter(Boolean)
      if (names.length === amounts.length && names.length > 0) {
        t.debtSplits = names.map((name, i) => ({
          debtorName: name,
          amount: parseCurrency(amounts[i]),
        }))
        t.debtUserShare = parseCurrency(row.debtUserShare)
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
