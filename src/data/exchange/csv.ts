import { v4 as uuid } from 'uuid'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../../domain/constants'
import type { PaymentMethod, Transaction, TransactionType } from '../../domain/entities'
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
  'referenceMonth',
  'isDebt',
  'debtorName',
  'debtAmount',
  'debtUserShare',
  'isSettled',
  'installmentTotal',
  'installmentCurrent',
  'installmentRef',
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
  const groupIdToHeadRef = new Map<string, string>()

  for (const t of transactions) {
    const ref = `r${String(++refCounter).padStart(3, '0')}`
    const isInstallmentHead = t.installment && t.installment.current === 1
    const isInstallmentChild = t.installment && t.installment.current > 1 && t.groupId

    let installmentRef = ''
    if (isInstallmentChild && t.groupId) {
      const cached = groupIdToHeadRef.get(t.groupId)
      if (cached) installmentRef = cached
    }

    if (isInstallmentHead && t.groupId) {
      groupIdToHeadRef.set(t.groupId, ref)
    }

    if (t.isDebt && t.debtSplits?.length) {
      for (const split of t.debtSplits) {
        rows.push([
          ref,
          t.date,
          t.type,
          String(t.amount),
          t.category,
          t.paymentMethod,
          t.description,
          t.referenceMonth,
          'true',
          split.debtorName,
          String(split.amount),
          String(t.debtUserShare ?? 0),
          String(split.settled ?? t.isSettled),
          '',
          '',
          '',
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
        t.referenceMonth,
        String(t.isDebt),
        t.debtorName ?? '',
        '',
        String(t.debtUserShare ?? 0),
        String(t.isSettled),
        isInstallmentHead ? String(t.installment?.total) : '',
        t.installment?.current?.toString() ?? '',
        installmentRef,
      ])
    }
  }

  const csv = [
    HEADERS.join(','),
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

  const rowObjects: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    if (values.length !== headers.length) continue
    rowObjects.push(Object.fromEntries(headers.map((h, idx) => [h, values[idx]])))
  }

  // Group by ref for debt reconstruction
  const refGroups = new Map<string, Record<string, string>[]>()
  for (const row of rowObjects) {
    const group = refGroups.get(row.ref) ?? []
    group.push(row)
    refGroups.set(row.ref, group)
  }

  // First pass: map installment head refs to internal IDs
  const headRefToId = new Map<string, string>()
  for (const [, group] of refGroups) {
    const first = group[0]
    if (first.installmentTotal && !first.installmentRef) {
      headRefToId.set(first.ref, uuid())
    }
  }

  const transactions: Transaction[] = []

  // Second pass: build transactions
  for (const [, group] of refGroups) {
    const first = group[0]

    // Debt with 1NF splits (multiple rows share same ref)
    if (group.length > 1 && first.isDebt === 'true') {
      transactions.push({
        id: uuid(),
        type: parseType(first.type),
        date: first.date,
        referenceMonth: first.referenceMonth || first.date.slice(0, 7),
        description: first.description || '',
        amount: parseCurrency(first.amount),
        category: first.category || 'Other',
        paymentMethod: parsePaymentMethod(first.paymentMethod),
        isDebt: true,
        debtorName: first.debtorName || undefined,
        debtSplits: group.map((r) => ({
          debtorName: r.debtorName,
          amount: parseCurrency(r.debtAmount || r.amount),
          settled: r.isSettled === 'true',
        })),
        debtUserShare: parseCurrency(first.debtUserShare),
        isSettled: group.every((r) => r.isSettled === 'true'),
      })
      continue
    }

    // Single-row: standalone, installment head, or installment child
    const t: Transaction = {
      id:
        first.installmentTotal && !first.installmentRef
          ? (headRefToId.get(first.ref) ?? uuid())
          : uuid(),
      type: parseType(first.type),
      date: first.date,
      referenceMonth: first.referenceMonth || first.date.slice(0, 7),
      description: first.description || '',
      amount: parseCurrency(first.amount),
      category: first.category || 'Other',
      paymentMethod: parsePaymentMethod(first.paymentMethod),
      isDebt: first.isDebt === 'true',
      debtorName: first.debtorName || undefined,
      isSettled: first.isSettled === 'true',
    }

    if (first.installmentTotal && !first.installmentRef) {
      const total = parseInt(first.installmentTotal, 10) || 1
      t.installment = { current: 1, total }
      t.groupId = headRefToId.get(first.ref)
    } else if (first.installmentRef) {
      const current = parseInt(first.installmentCurrent, 10) || 1
      const headId = headRefToId.get(first.installmentRef)
      t.installment = { current, total: 1 }
      t.parentId = headId
      t.groupId = headId
    }

    if (first.debtAmount) {
      t.debtSplits = [
        {
          debtorName: first.debtorName,
          amount: parseCurrency(first.debtAmount),
          settled: first.isSettled === 'true',
        },
      ]
      t.debtUserShare = parseCurrency(first.debtUserShare)
    }

    transactions.push(t)
  }

  // Fixup: set installment totals on children from their heads
  for (const t of transactions) {
    if (t.parentId && t.installment) {
      const head = transactions.find((h) => h.id === t.parentId)
      if (head?.installment) {
        t.installment = { current: t.installment.current, total: head.installment.total }
      }
    }
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
