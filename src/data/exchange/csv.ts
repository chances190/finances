import Papa from 'papaparse'
import { v4 as uuid } from 'uuid'
import {
  EXPENSE_PAYMENT_METHODS,
  INCOME_PAYMENT_METHODS,
  TRANSACTION_TYPES,
} from '../../domain/constants'
import type {
  ExpensePaymentMethod,
  ExpenseTransaction,
  IncomePaymentMethod,
  Transaction,
  TransactionType,
} from '../../domain/entities'
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

function validateType(s: string): TransactionType | null {
  if (!TRANSACTION_TYPES.includes(s as TransactionType)) return null
  return s as TransactionType
}

function validateIncomeMethod(s: string): IncomePaymentMethod | null {
  if (!(INCOME_PAYMENT_METHODS as readonly string[]).includes(s)) return null
  return s as IncomePaymentMethod
}

function validateExpenseMethod(s: string): ExpensePaymentMethod | null {
  if (!(EXPENSE_PAYMENT_METHODS as readonly string[]).includes(s)) return null
  return s as ExpensePaymentMethod
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

    const type = validateType(first.type)
    if (type === null) {
      skippedRows.push({ line, reason: `invalid type: "${first.type}"` })
      continue
    }

    const amount = validateAmount(first.amount)
    if (amount === null) {
      skippedRows.push({ line, reason: `invalid amount: "${first.amount}"` })
      continue
    }

    if (type === 'Income') {
      const paymentMethod = validateIncomeMethod(first.paymentMethod)
      if (paymentMethod === null) {
        skippedRows.push({
          line,
          reason: `invalid payment method: "${first.paymentMethod}" for Income`,
        })
        continue
      }
      const validated = validateTransaction({
        id: uuid(),
        type: 'Income',
        date: first.date,
        description: first.description || '',
        amount,
        category: 'Income',
        paymentMethod,
      })
      if (!validated.ok) {
        skippedRows.push({ line, reason: validated.reason })
        continue
      }
      transactions.push(validated.tx)
      continue
    }

    const paymentMethod = validateExpenseMethod(first.paymentMethod)
    if (paymentMethod === null) {
      skippedRows.push({
        line,
        reason: `invalid payment method: "${first.paymentMethod}" for Expense`,
      })
      continue
    }

    const expense: ExpenseTransaction = {
      id: uuid(),
      type: 'Expense',
      date: first.date,
      description: first.description || '',
      amount,
      category: first.category || 'Other',
      paymentMethod,
    }

    if (first.installmentTotal && !first.installmentRef) {
      expense.installments = parseInt(first.installmentTotal, 10) || 1
    }

    if (first.debtName && rows.some((r) => r.debtName)) {
      expense.debts = rows
        .filter((r) => r.debtName)
        .map((r) => ({
          name: r.debtName,
          amount: parseCurrency(r.debtAmount || '0'),
          settled: false,
        }))
    }

    const validated = validateTransaction(expense)
    if (!validated.ok) {
      skippedRows.push({ line, reason: validated.reason })
      continue
    }
    transactions.push(validated.tx)
  }

  skippedRows.sort((a, b) => a.line - b.line)
  return { transactions, skippedRows }
}
