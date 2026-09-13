import Papa from 'papaparse'
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
  const cleaned = raw.replace('R$ ', '').replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(cleaned) || 0
}

function parseDateBR(dmy: string): string {
  const [d, m, y] = dmy.split('/')
  return `${y}-${m}-${d}`
}

function extractInstallment(desc: string): { description: string; total: number } | null {
  const m = desc.match(/\[(\d+)\/(\d+)\]$/)
  if (!m) return null
  return {
    description: desc.replace(/\s*\[\d+\/\d+\]$/, '').trim(),
    total: parseInt(m[2], 10),
  }
}

function parseDebt(tag: string, amount: number): { name: string; amount: number } | null {
  const t = tag.trim()
  if (!t) return null
  if (t.startsWith('com ')) {
    const debtorCents = Math.floor(Math.round(amount * 100) / 2)
    return { name: t.slice(4).trim(), amount: debtorCents / 100 }
  }
  return { name: t, amount }
}

function parseRow(cols: string[]): ImportTransaction | null {
  const amount = parseAmount(cols[2].trim())
  if (amount === 0) return null

  const inst = extractInstallment(cols[1].trim())
  const debt = parseDebt(cols[5]?.trim() ?? '', amount)

  return {
    id: uuid(),
    type: 'Expense',
    date: parseDateBR(cols[3].trim()),
    description: inst ? inst.description : cols[1].trim(),
    amount,
    category: CATEGORY_MAP[cols[4].trim()] ?? 'Other',
    paymentMethod: cols[0].trim() === 'Crédito' ? 'Credit' : 'Debit',
    installments: inst?.total,
    debts: debt ? [{ ...debt, settled: false }] : undefined,
  }
}

const inputPath = process.argv[2] ?? '/home/chances/Downloads/Fatura do Cartão - Página9.csv'
const outputPath = process.argv[3] ?? '/home/chances/Downloads/fatura-import.json'

const csv = readFileSync(inputPath, 'utf-8')
const rows = Papa.parse<string[]>(csv, { skipEmptyLines: true }).data

const transactions: ImportTransaction[] = []
const installmentGroups = new Map<string, ImportTransaction[]>()

for (const cols of rows) {
  if (cols.length < 5) continue

  const tx = parseRow(cols)
  if (!tx) continue

  if (tx.installments) {
    const key = `${tx.description}::${tx.installments}`
    const group = installmentGroups.get(key) ?? []
    group.push(tx)
    installmentGroups.set(key, group)
  } else {
    transactions.push(tx)
  }
}

for (const [, group] of installmentGroups) {
  const first = group[0]
  transactions.push({
    id: uuid(),
    type: 'Expense',
    date: group.map((tx) => tx.date).sort()[0],
    description: first.description,
    amount: group.reduce((sum, tx) => sum + tx.amount, 0),
    category: first.category,
    paymentMethod: first.paymentMethod,
    installments: first.installments,
    debts: first.debts,
  })
}

const output = { transactions, budgets: [] }
writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')

const debtCount = transactions.filter((t) => t.debts && t.debts.length > 0).length
console.log(
  `Converted ${transactions.length} transactions (${debtCount} with debts, ${installmentGroups.size} installment series collapsed) → ${outputPath}`,
)
console.log('Import via Actions tab → Import backup (.json)')
