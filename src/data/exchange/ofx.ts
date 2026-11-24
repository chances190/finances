import { parseSync } from 'ofx-js'
import { buildIncome, buildPurchase, type Movement } from '../../domain/ledger'

interface RawTransaction {
  TRNTYPE?: string
  DTPOSTED?: string
  TRNAMT?: string
  FITID?: string
  MEMO?: string
  NAME?: string
}

export interface OFXImportResult {
  movements: Movement[]
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

export function importOFX(content: string, existing: Movement[]): OFXImportResult {
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
    existing.map((movement) => movement.importId).filter((id): id is string => Boolean(id)),
  )
  const movements: Movement[] = []
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

    if (value > 0 && source === 'card') {
      movements.push({
        id: crypto.randomUUID(),
        date,
        kind: 'refund',
        description: cleanPixMemo(memo) || 'Card credit',
        postings: [
          { account: 'card', amount },
          { account: 'expense', amount: -amount, category: 'Other' },
        ],
        importId,
      })
      seen.add(importId)
      continue
    }

    if (value > 0) {
      const result = buildIncome({
        id: crypto.randomUUID(),
        date,
        description: cleanPixMemo(memo) || 'Imported income',
        amount,
        account: 'checking',
        method: 'Transfer',
        category: 'Income',
        importId,
      })
      if (!result.ok) {
        skipped.push({ label, reason: result.reason })
        continue
      }
      movements.push(result.value)
      seen.add(importId)
      continue
    }

    const result = buildPurchase({
      id: crypto.randomUUID(),
      date,
      description: cleanPixMemo(memo) || 'Imported purchase',
      amount,
      category: 'Other',
      account: source === 'card' ? 'card' : 'checking',
      importId,
    })
    if (!result.ok) {
      skipped.push({ label, reason: result.reason })
      continue
    }
    movements.push(...result.value)
    seen.add(importId)
  }

  return { movements, skipped, source }
}
