import Papa from 'papaparse'
import { v4 as uuid } from 'uuid'
import { INCOME_PAYMENT_METHODS, PAYMENT_METHODS, TRANSACTION_TYPES } from '../../domain/constants'
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
] as const

export function exportCSV(transactions: Transaction[]): void {
  const rows: string[][] = []
  let refCounter = 0

  for (const t of transactions) {
    const ref = `r${String(++refCounter).padStart(3, '0')}`

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

  const csv = Papa.unparse({ fields: [...HEADERS], data: rows })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `finances-${new Date().toISOString().slice(0, 10)}.csv`)
}

export interface SkippedRow {
  line: number
  reason: string
}

export interface CSVImportResult {
  transactions: Transaction[]
  skippedRows: SkippedRow[]
}

function validateType(s: string): TransactionType | null {
  if (!TRANSACTION_TYPES.includes(s as TransactionType)) return null
  return s as TransactionType
}

function validatePaymentMethod(s: string, type: TransactionType): PaymentMethod | null {
  const valid = type === 'Income' ? INCOME_PAYMENT_METHODS : PAYMENT_METHODS
  if (!valid.includes(s as PaymentMethod)) return null
  return s as PaymentMethod
}

function validateAmount(s: string): number | null {
  if (!s.trim()) return null
  const value = parseCurrency(s)
  if (value === 0 && s.trim() !== '0') return null
  return value
}

type CSVRow = Record<string, string>

export function importCSV(csv: string): CSVImportResult {
  const parsed = Papa.parse<CSVRow>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
  })

  const headers = parsed.meta.fields ?? []
  const requiredFields = ['date', 'type', 'amount', 'category', 'paymentMethod']
  for (const field of requiredFields) {
    if (!headers.includes(field)) throw new Error(`Missing required column: ${field}`)
  }

  const malformedLines = new Set(
    parsed.errors
      .filter((e) => e.code === 'TooFewFields' || e.code === 'TooManyFields')
      .map((e) => (e.row ?? -1) + 2),
  )

  const skippedRows: SkippedRow[] = [...malformedLines].map((line) => ({
    line,
    reason: 'wrong number of columns',
  }))

  const transactions: Transaction[] = []

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i]
    const line = i + 2

    if (malformedLines.has(line)) continue

    const type = validateType(row.type)
    if (type === null) {
      skippedRows.push({ line, reason: `invalid type: "${row.type}"` })
      continue
    }

    const paymentMethod = validatePaymentMethod(row.paymentMethod, type)
    if (paymentMethod === null) {
      skippedRows.push({
        line,
        reason: `invalid payment method: "${row.paymentMethod}" for ${type}`,
      })
      continue
    }

    const amount = validateAmount(row.amount)
    if (amount === null) {
      skippedRows.push({ line, reason: `invalid amount: "${row.amount}"` })
      continue
    }

    const ref = row.ref
    const isInstallmentHead = row.installmentTotal && !row.installmentRef
    const isInstallmentChild = !!row.installmentRef

    if (isInstallmentChild) continue

    const t: Transaction = {
      id: uuid(),
      type,
      date: row.date,
      description: row.description || '',
      amount,
      category: type === 'Income' ? 'Income' : row.category || 'Other',
      paymentMethod,
    }

    if (isInstallmentHead) {
      t.installments = parseInt(row.installmentTotal, 10) || 1
    }

    if (row.debtName) {
      t.debts = [
        {
          name: row.debtName,
          amount: parseCurrency(row.debtAmount || '0'),
          settled: false,
        },
      ]

      if (!isInstallmentHead) {
        const sameRef = parsed.data.filter((r) => r.ref === ref && r !== row)
        if (sameRef.length > 0 && sameRef.every((r) => r.debtName)) {
          t.amount = amount
          t.debts = [
            { name: row.debtName, amount: parseCurrency(row.debtAmount || '0'), settled: false },
            ...sameRef.map((r) => ({
              name: r.debtName,
              amount: parseCurrency(r.debtAmount || '0'),
              settled: false,
            })),
          ]
        }
      }
    }

    transactions.push(t)
  }

  skippedRows.sort((a, b) => a.line - b.line)
  return { transactions, skippedRows }
}
