import { v4 as uuid } from 'uuid'
import { readFileSync, writeFileSync } from 'node:fs'

const CATEGORY_MAP: Record<string, string> = {
  Comida: 'Food',
  Alimentação: 'Food',
  Família: 'Other',
  'Uber/Pop': 'Transport',
  Transporte: 'Transport',
  'Despesas ordinárias': 'Other',
  'Despesas extraordinárias': 'Other',
  Compras: 'Shopping',
  'Presente de Natal': 'Leisure',
  Outros: 'Other',
}

interface ParsedRow {
  date: string
  description: string
  amount: number
  category: string
  paymentMethod: 'Credit' | 'Debit'
  installment?: { current: number; total: number }
  debt?: { name: string; amount: number }
}

interface ImportTransaction {
  id: string
  type: 'Expense'
  date: string
  description: string
  amount: number
  category: string
  paymentMethod: 'Credit' | 'Debit'
  installments?: number
  debts?: { name: string; amount: number; settled: boolean }[]
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace('R$ ', '').replace('.', '').replace(',', '.').trim()
  return parseFloat(cleaned) || 0
}

function parseDateBR(dmy: string): string {
  const [d, m, y] = dmy.split('/')
  return `${y}-${m}-${d}`
}

function extractInstallment(desc: string): { description: string; current: number; total: number } | null {
  const m = desc.match(/\[(\d+)\/(\d+)\]$/)
  if (!m) return null
  return {
    description: desc.replace(/\s*\[\d+\/\d+\]$/, '').trim(),
    current: parseInt(m[1], 10),
    total: parseInt(m[2], 10),
  }
}

function parseTag(tag: string): { debtorName: string; split: boolean } | null {
  const t = tag.trim()
  if (!t) return null
  if (t.startsWith('com ')) {
    return { debtorName: t.slice(4).trim(), split: true }
  }
  return { debtorName: t, split: false }
}

function buildDebt(tag: { debtorName: string; split: boolean }, amount: number): { name: string; amount: number } {
  if (tag.split) {
    const debtorCents = Math.floor(Math.round(amount * 100) / 2)
    return { name: tag.debtorName, amount: debtorCents / 100 }
  }
  return { name: tag.debtorName, amount }
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

function parseRow(cols: string[]): ParsedRow | null {
  const paymentRaw = cols[0].trim()
  const descriptionRaw = cols[1].trim()
  const amountRaw = cols[2].trim()
  const dateRaw = cols[3].trim()
  const categoryRaw = cols[4].trim()
  const tagRaw = cols[5]?.trim() ?? ''

  const amount = parseAmount(amountRaw)
  if (amount === 0) return null

  const date = parseDateBR(dateRaw)
  const category = CATEGORY_MAP[categoryRaw] ?? 'Other'
  const paymentMethod = paymentRaw === 'Crédito' ? 'Credit' : 'Debit'

  const inst = extractInstallment(descriptionRaw)
  const description = inst ? inst.description : descriptionRaw

  const tag = parseTag(tagRaw)
  const debt = tag ? buildDebt(tag, amount) : undefined

  return {
    date,
    description,
    amount,
    category,
    paymentMethod,
    ...(inst ? { installment: inst } : {}),
    ...(debt ? { debt } : {}),
  }
}

function toTransaction(row: ParsedRow): ImportTransaction {
  return {
    id: uuid(),
    type: 'Expense',
    date: row.date,
    description: row.description,
    amount: row.amount,
    category: row.category,
    paymentMethod: row.paymentMethod,
    ...(row.debt ? { debts: [{ name: row.debt.name, amount: row.debt.amount, settled: false }] } : {}),
  }
}

const inputPath = process.argv[2] ?? '/home/chances/Downloads/Fatura do Cartão - Página9.csv'
const outputPath = process.argv[3] ?? '/home/chances/Downloads/fatura-import.json'

const csv = readFileSync(inputPath, 'utf-8')
const lines = csv.trim().split('\n')

const transactions: ImportTransaction[] = []
const installmentGroups = new Map<string, { rows: ParsedRow[]; total: number }>()

for (const line of lines) {
  const cols = parseCSVLine(line)
  if (cols.length < 5) continue

  const row = parseRow(cols)
  if (!row) continue

  if (row.installment) {
    const key = `${row.description}::${row.installment.total}`
    const group = installmentGroups.get(key) ?? { rows: [], total: row.installment.total }
    group.rows.push(row)
    installmentGroups.set(key, group)
  } else {
    transactions.push(toTransaction(row))
  }
}

for (const [, group] of installmentGroups) {
  const first = group.rows[0]
  const amount = group.rows.reduce((s, r) => s + r.amount, 0)
  const date = group.rows.map((r) => r.date).sort()[0]
  transactions.push({
    id: uuid(),
    type: 'Expense',
    date,
    description: first.description,
    amount,
    category: first.category,
    paymentMethod: first.paymentMethod,
    installments: group.total,
    ...(first.debt ? { debts: [{ name: first.debt.name, amount: first.debt.amount, settled: false }] } : {}),
  })
}

const output = { transactions, budgets: [] }
writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')

const debtCount = transactions.filter((t) => t.debts && t.debts.length > 0).length
console.log(
  `Converted ${transactions.length} transactions (${debtCount} with debts, ${installmentGroups.size} installment series collapsed) → ${outputPath}`,
)
console.log('Import via Actions tab → Import backup (.json)')