import { parseSync } from 'ofx-js'
import { v4 as uuid } from 'uuid'
import type { Transaction } from '../../domain/entities'
import { validateTransaction } from '../validation'

interface RawTransaction {
  TRNTYPE?: string
  DTPOSTED?: string
  TRNAMT?: string
  FITID?: string
  MEMO?: string
  NAME?: string
}

export interface OFXImportResult {
  transactions: Transaction[]
  skipped: { label: string; reason: string }[]
  source: 'card' | 'bank'
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function cleanPixMemo(memo: string): string {
  if (!/^transferência/i.test(memo)) return memo
  return memo
    .replace(
      /^transferência\s+(enviada|recebida)\s+pelo\s+pix(\s+via\s+open\s+banking)?\s+-\s+/i,
      '',
    )
    .replace(/\s*\(transferência\s+(enviada|recebida)\)$/i, '')
    .replace(/\s+-\s+.*$/, '')
    .trim()
}

function skipReason(memo: string, source: 'card' | 'bank'): string | null {
  if (/pagamento (recebido|de fatura)/i.test(memo)) return 'card bill payment'
  if (source === 'bank' && /^(resgate|aplica[cç][aã]o) rdb$/i.test(memo)) {
    return 'investment transfer'
  }
  return null
}

export function importOFX(content: string, existing: Transaction[]): OFXImportResult {
  const ofx = parseSync(content).OFX
  const card = ofx.CREDITCARDMSGSRSV1
  const bank = ofx.BANKMSGSRSV1
  const source: 'card' | 'bank' = card ? 'card' : 'bank'

  const statements = card
    ? asArray(card.CCSTMTTRNRS).map((statement) => statement?.CCSTMTRS)
    : asArray(bank?.STMTTRNRS).map((statement) => statement?.STMTRS)

  if (statements.length === 0) {
    throw new Error('Unsupported OFX file: no bank or credit card statement found')
  }

  const raws = statements.flatMap((statement) =>
    asArray<RawTransaction>(statement?.BANKTRANLIST?.STMTTRN),
  )

  const seen = new Set(
    existing.map((transaction) => transaction.importId).filter((id): id is string => Boolean(id)),
  )
  const transactions: Transaction[] = []
  const skipped: { label: string; reason: string }[] = []

  for (const raw of raws) {
    const memo = (raw.MEMO ?? raw.NAME ?? '').trim()
    const label = memo || 'transaction'

    const reason = skipReason(memo, source)
    if (reason) {
      skipped.push({ label, reason })
      continue
    }

    const posted = raw.DTPOSTED?.slice(0, 8) ?? ''
    if (!/^\d{8}$/.test(posted)) {
      skipped.push({ label, reason: 'invalid date' })
      continue
    }

    const value = Number(raw.TRNAMT)
    if (!Number.isFinite(value) || value === 0) {
      skipped.push({ label, reason: 'invalid amount' })
      continue
    }

    const date = `${posted.slice(0, 4)}-${posted.slice(4, 6)}-${posted.slice(6, 8)}`
    const amount = Math.round(Math.abs(value) * 100) / 100
    const importId = `${source}:${raw.FITID ?? ''}:${date}:${amount}:${memo}`

    if (seen.has(importId)) {
      skipped.push({ label, reason: 'already imported' })
      continue
    }
    seen.add(importId)

    const base = {
      id: uuid(),
      date,
      description: cleanPixMemo(memo) || 'Imported transaction',
      amount,
      importId,
    }

    const validated =
      value > 0
        ? validateTransaction({
            ...base,
            type: 'Income',
            category: 'Income',
            paymentMethod: 'Transfer',
          })
        : validateTransaction({
            ...base,
            type: 'Expense',
            category: 'Other',
            paymentMethod: source === 'card' ? 'Credit' : 'Debit',
          })

    if (!validated.ok) {
      skipped.push({ label, reason: validated.reason })
      continue
    }
    transactions.push(validated.tx)
  }

  return { transactions, skipped, source }
}
