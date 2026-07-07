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

function buildDebtSplits(amount: number, debtorName: string, split: boolean): { userShare: number; splits: { debtorName: string; amount: number }[] } {
  if (split) {
    const totalCents = Math.round(amount * 100)
    const halfCents = Math.round(totalCents / 2)
    return {
      userShare: halfCents / 100,
      splits: [{ debtorName, amount: (totalCents - halfCents) / 100 }],
    }
  }
  return {
    userShare: 0,
    splits: [{ debtorName, amount }],
  }
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

const csv = readFileSync('/home/chances/Downloads/Fatura do Cartão - Página9.csv', 'utf-8')
const lines = csv.trim().split('\n')

const transactions: any[] = []
const installmentGroups = new Map<string, string>()

for (const line of lines) {
  const cols = parseCSVLine(line)
  if (cols.length < 5) continue

  const paymentRaw = cols[0].trim()
  const descriptionRaw = cols[1].trim()
  const amountRaw = cols[2].trim()
  const dateRaw = cols[3].trim()
  const categoryRaw = cols[4].trim()
  const tagRaw = cols[5]?.trim() ?? ''

  const amount = parseAmount(amountRaw)
  if (amount === 0) continue

  const date = parseDateBR(dateRaw)
  const refMonth = date.slice(0, 7)
  const category = CATEGORY_MAP[categoryRaw] ?? 'Other'
  const paymentMethod = paymentRaw === 'Crédito' ? 'CREDIT' : 'DEBIT'

  const inst = extractInstallment(descriptionRaw)
  const description = inst ? inst.description : descriptionRaw

  const tag = parseTag(tagRaw)

  const tx: any = {
    id: uuid(),
    type: 'EXPENSE',
    date,
    referenceMonth: refMonth,
    description,
    amount,
    category,
    paymentMethod,
    isDebt: !!tag,
    isSettled: !!tag,
  }

  if (tag) {
    const debt = buildDebtSplits(amount, tag.debtorName, tag.split)
    tx.debtUserShare = debt.userShare
    tx.debtSplits = debt.splits
  }

  if (inst) {
    tx.installment = { current: inst.current, total: inst.total }
    const groupKey = `${description}::${inst.total}`
    if (!installmentGroups.has(groupKey)) {
      installmentGroups.set(groupKey, uuid())
    }
    const groupId = installmentGroups.get(groupKey)!
    tx.groupId = groupId
    tx.parentId = groupId
  }

  transactions.push(tx)
}

const output = { transactions, budgets: [] }
writeFileSync('/home/chances/Downloads/fatura-import.json', JSON.stringify(output, null, 2), 'utf-8')

const debtCount = transactions.filter((t) => t.isDebt).length
const splitCount = transactions.filter((t) => t.debtSplits && t.debtSplits.length > 0 && t.debtUserShare > 0).length
console.log(`Converted ${transactions.length} transactions (${debtCount} debts, ${splitCount} split evenly) → /home/chances/Downloads/fatura-import.json`)
