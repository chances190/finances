import Papa from 'papaparse'
import type { Transaction } from '../../domain/entities'
import { monthlyFlows } from '../../domain/entities'
import { parseCurrency, parseCurrencyStrict } from '../../lib/currency'
import { downloadBlob } from '../download'
import { validateTransaction } from '../validation'

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

    if (t.type === 'Expense' && t.installments && t.installments > 1) {
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
    } else if (t.type === 'Expense' && t.debts && t.debts.length > 0) {
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

function validateAmount(s: string): number | null {
  const value = parseCurrencyStrict(s)
  if (value === null || value <= 0) return null
  return value
}

type CSVRow = Record<string, string>

export function importCSV(csv: string): CSVImportResult {
  const parsed = Papa.parse<CSVRow>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
  })

  const headers = parsed.meta.fields ?? []
  const requiredFields = ['ref', 'date', 'type', 'amount', 'category', 'paymentMethod']
  for (const field of requiredFields) {
    if (!headers.includes(field)) throw new Error(`Missing required column: ${field}`)
  }

  const malformedRows = new Set(
    parsed.errors
      .filter((e) => e.code === 'TooFewFields' || e.code === 'TooManyFields')
      .map((e) => e.row ?? -1),
  )

  const skippedRows: SkippedRow[] = [...malformedRows].map((rowIdx) => ({
    line: rowIdx + 2,
    reason: 'wrong number of columns',
  }))

  const installmentChildRefs = new Set(
    parsed.data.filter((r) => r.installmentRef).map((r) => r.ref),
  )

  const byRef = new Map<string, { firstIndex: number; rows: CSVRow[] }>()
  for (let i = 0; i < parsed.data.length; i++) {
    if (malformedRows.has(i)) continue
    const row = parsed.data[i]
    if (!row.ref || installmentChildRefs.has(row.ref)) continue
    const existing = byRef.get(row.ref)
    if (existing) {
      existing.rows.push(row)
    } else {
      byRef.set(row.ref, { firstIndex: i, rows: [row] })
    }
  }

  const transactions: Transaction[] = []

  for (const [, { firstIndex, rows }] of byRef) {
    const first = rows[0]
    const line = firstIndex + 2

    const amount = validateAmount(first.amount)
    if (amount === null) {
      skippedRows.push({ line, reason: `invalid amount: "${first.amount}"` })
      continue
    }

    const draft: Record<string, unknown> = {
      id: crypto.randomUUID(),
      type: first.type,
      date: first.date,
      description: first.description || '',
      amount,
      category: first.category || 'Other',
      paymentMethod: first.paymentMethod,
    }

    if (first.installmentTotal && !first.installmentRef) {
      draft.installments = parseInt(first.installmentTotal, 10) || 1
    }

    if (first.debtName && rows.some((r) => r.debtName)) {
      draft.debts = rows
        .filter((r) => r.debtName)
        .map((r) => ({
          name: r.debtName,
          amount: parseCurrency(r.debtAmount || '0'),
          settled: false,
        }))
    }

    const validated = validateTransaction(draft)
    if (!validated.ok) {
      skippedRows.push({ line, reason: validated.reason })
      continue
    }
    transactions.push(validated.tx)
  }

  skippedRows.sort((a, b) => a.line - b.line)
  return { transactions, skippedRows }
}
