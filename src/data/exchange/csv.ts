import { v4 as uuid } from 'uuid'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../../domain/constants'
import type { PaymentMethod, Transaction, TransactionType } from '../../domain/entities'
import { monthlyFlows } from '../../domain/entities'
import { parseCurrency } from '../../lib/currency'
import { downloadBlob } from '../download'

const HEADERS = [
  'ref',
  'date',
  'type',
  'amount',
  'category',
  'paymentMethod',
  'description',
  'installmentTotal',
  'installmentIndex',
  'installmentRef',
  'debtName',
  'debtAmount',
]

function parseType(s: string | undefined): TransactionType {
  return s && TRANSACTION_TYPES.includes(s as (typeof TRANSACTION_TYPES)[number])
    ? (s as TransactionType)
    : 'EXPENSE'
}

function parsePaymentMethod(s: string | undefined): PaymentMethod {
  return s && PAYMENT_METHODS.includes(s as PaymentMethod) ? (s as PaymentMethod) : 'DEBIT'
}

export function exportCSV(transactions: Transaction[]): void {
  const rows: string[][] = []
  let refCounter = 0
  const txToRef = new Map<string, string>()

  for (const t of transactions) {
    const ref = `r${String(++refCounter).padStart(3, '0')}`
    txToRef.set(t.id, ref)

    if (t.installments && t.installments > 1) {
      const flows = monthlyFlows(t)
      for (let i = 0; i < flows.length; i++) {
        const f = flows[i]
        rows.push([
          i === 0 ? ref : `r${String(++refCounter).padStart(3, '0')}`,
          t.date,
          t.type,
          String(t.amount),
          t.category,
          t.paymentMethod,
          t.description,
          i === 0 ? String(t.installments) : '',
          String((f.installmentIndex ?? 0) + 1),
          i > 0 ? ref : '',
          '',
          '',
        ])
      }
    } else if (t.debts && t.debts.length > 0) {
      for (const d of t.debts) {
        rows.push([
          ref,
          t.date,
          t.type,
          String(t.amount),
          t.category,
          t.paymentMethod,
          t.description,
          '',
          '',
          '',
          d.name,
          String(d.amount),
        ])
      }
    } else {
      rows.push([
        ref,
        t.date,
        t.type,
        String(t.amount),
        t.category,
        t.paymentMethod,
        t.description,
        '',
        '',
        '',
        '',
        '',
      ])
    }
  }

  const csv = [
    HEADERS.join(','),
    ...rows.map((r) =>
      r
        .map((cell) => {
          if (cell === '') return ''
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        })
        .join(','),
    ),
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

  const rowObjects: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    if (values.length !== headers.length) continue
    rowObjects.push(Object.fromEntries(headers.map((h, idx) => [h, values[idx]])))
  }

  const refGroups = new Map<string, Record<string, string>[]>()

  const installmentHeadRefs = new Set<string>()
  const installmentChildRefs = new Set<string>()
  for (const row of rowObjects) {
    if (row.installmentTotal && !row.installmentRef) {
      installmentHeadRefs.add(row.ref)
    }
    if (row.installmentRef) {
      installmentChildRefs.add(row.ref)
    }
  }

  for (const row of rowObjects) {
    const group = refGroups.get(row.ref) ?? []
    group.push(row)
    refGroups.set(row.ref, group)
  }

  const transactions: Transaction[] = []

  for (const [ref, group] of refGroups) {
    const first = group[0]

    // Skip installment child rows (already accounted for by head)
    if (installmentChildRefs.has(ref)) continue

    if (first.debtName && group.length > 1 && group.every((r) => r.debtName)) {
      const totalAmount = parseCurrency(first.amount)
      transactions.push({
        id: uuid(),
        type: parseType(first.type),
        date: first.date,
        description: first.description || '',
        amount: totalAmount,
        category: first.category || 'Other',
        paymentMethod: parsePaymentMethod(first.paymentMethod),
        debts: group.map((r) => ({
          name: r.debtName,
          amount: parseCurrency(r.debtAmount || '0'),
          settled: false,
        })),
      })
      continue
    }

    if (installmentHeadRefs.has(ref)) {
      const total = parseInt(first.installmentTotal, 10) || 1
      transactions.push({
        id: uuid(),
        type: parseType(first.type),
        date: first.date,
        description: first.description || '',
        amount: parseCurrency(first.amount),
        category: first.category || 'Other',
        paymentMethod: parsePaymentMethod(first.paymentMethod),
        installments: total,
      })
      continue
    }

    const t: Transaction = {
      id: uuid(),
      type: parseType(first.type),
      date: first.date,
      description: first.description || '',
      amount: parseCurrency(first.amount),
      category: first.category || 'Other',
      paymentMethod: parsePaymentMethod(first.paymentMethod),
    }

    if (first.debtName) {
      t.debts = [
        {
          name: first.debtName,
          amount: parseCurrency(first.debtAmount || '0'),
          settled: false,
        },
      ]
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
