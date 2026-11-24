import Papa from 'papaparse'
import {
  accountForPaymentMethod,
  buildIncome,
  buildPurchase,
  EXPENSE_PAYMENT_METHODS,
  type ExpensePaymentMethod,
  grossPurchaseAmount,
  INCOME_PAYMENT_METHODS,
  type IncomePaymentMethod,
  incomeAmount,
  type Movement,
  type PurchaseShare,
  paymentMethodOf,
} from '../../domain/ledger'
import { parseCurrency, parseCurrencyStrict } from '../../lib/currency'
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

function expenseMethod(method: string): ExpensePaymentMethod | null {
  const needle = method.trim().toLowerCase()
  return EXPENSE_PAYMENT_METHODS.find((value) => value.toLowerCase() === needle) ?? null
}

function incomeMethod(method: string): IncomePaymentMethod | null {
  const needle = method.trim().toLowerCase()
  if (needle === 'voucher') return 'Voucher Income'
  return INCOME_PAYMENT_METHODS.find((value) => value.toLowerCase() === needle) ?? null
}

function exportMethod(movement: Movement): string | null {
  const method = paymentMethodOf(movement)
  return method === 'Someone else' ? null : method
}

export function exportCSV(movements: Movement[]): void {
  const rows: string[][] = []
  let refCounter = 0

  for (const movement of movements) {
    const method = exportMethod(movement)
    if (!method) continue
    const ref = `r${String(++refCounter).padStart(3, '0')}`
    const category = movement.postings.find((posting) => posting.category)?.category ?? 'Other'

    if (movement.kind === 'income') {
      rows.push([
        ref,
        movement.date,
        'Income',
        String(incomeAmount(movement)),
        category,
        method,
        movement.description,
        '',
        '',
        '',
        '',
        '',
      ])
      continue
    }

    const shares = movement.postings.filter(
      (posting) => posting.account === 'receivable' && posting.counterparty,
    )
    if (shares.length === 0) {
      rows.push([
        ref,
        movement.date,
        'Expense',
        String(grossPurchaseAmount(movement)),
        category,
        method,
        movement.description,
        '',
        '',
        '',
        '',
        '',
      ])
    } else {
      for (const share of shares) {
        rows.push([
          ref,
          movement.date,
          'Expense',
          String(grossPurchaseAmount(movement)),
          category,
          method,
          movement.description,
          '',
          '',
          '',
          share.counterparty as string,
          String(share.amount),
        ])
      }
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
  movements: Movement[]
  skippedRows: SkippedRow[]
}

function validateAmount(value: string): number | null {
  const amount = parseCurrencyStrict(value)
  if (amount === null || amount <= 0) return null
  return amount
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
      .filter((error) => error.code === 'TooFewFields' || error.code === 'TooManyFields')
      .map((error) => error.row ?? -1),
  )

  const skippedRows: SkippedRow[] = [...malformedRows].map((rowIndex) => ({
    line: rowIndex + 2,
    reason: 'wrong number of columns',
  }))

  const installmentChildRefs = new Set(
    parsed.data.filter((row) => row.installmentRef).map((row) => row.ref),
  )

  const byRef = new Map<string, { firstIndex: number; rows: CSVRow[] }>()
  for (let index = 0; index < parsed.data.length; index++) {
    if (malformedRows.has(index)) continue
    const row = parsed.data[index]
    if (!row.ref || installmentChildRefs.has(row.ref)) continue
    const existing = byRef.get(row.ref)
    if (existing) existing.rows.push(row)
    else byRef.set(row.ref, { firstIndex: index, rows: [row] })
  }

  const movements: Movement[] = []

  for (const [ref, { firstIndex, rows }] of byRef) {
    const first = rows[0]
    const line = firstIndex + 2
    const amount = validateAmount(first.amount)
    if (amount === null) {
      skippedRows.push({ line, reason: `invalid amount: "${first.amount}"` })
      continue
    }

    const type = first.type.trim().toLowerCase()
    const importId = `csv:${ref}:${first.date}:${amount}:${first.description ?? ''}`

    if (type === 'income') {
      const method = incomeMethod(first.paymentMethod)
      if (!method) {
        skippedRows.push({
          line,
          reason: `invalid payment method: "${first.paymentMethod}"`,
        })
        continue
      }
      const result = buildIncome({
        id: crypto.randomUUID(),
        date: first.date,
        description: first.description || 'Imported income',
        amount,
        account: accountForPaymentMethod(method) as 'checking' | 'voucher',
        method,
        category: first.category || 'Income',
        importId,
      })
      if (!result.ok) {
        skippedRows.push({ line, reason: result.reason })
        continue
      }
      movements.push(result.value)
      continue
    }

    if (type !== 'expense') {
      skippedRows.push({ line, reason: `invalid type: "${first.type}"` })
      continue
    }

    const method = expenseMethod(first.paymentMethod)
    if (!method) {
      skippedRows.push({
        line,
        reason: `invalid payment method: "${first.paymentMethod}"`,
      })
      continue
    }
    const account = accountForPaymentMethod(method)

    const shares: PurchaseShare[] = rows
      .filter((row) => row.debtName)
      .map((row) => ({
        counterparty: row.debtName,
        amount: parseCurrency(row.debtAmount || '0'),
      }))
    const installments = Math.max(1, Number.parseInt(first.installmentTotal || '1', 10) || 1)

    const result = buildPurchase({
      id: crypto.randomUUID(),
      date: first.date,
      description: first.description || 'Imported purchase',
      amount,
      category: first.category || 'Other',
      account,
      shares: shares.filter((share) => share.counterparty.trim() && share.amount > 0),
      installments,
      importId,
    })
    if (!result.ok) {
      skippedRows.push({ line, reason: result.reason })
      continue
    }
    movements.push(...result.value)
  }

  skippedRows.sort((a, b) => a.line - b.line)
  return { movements, skippedRows }
}
