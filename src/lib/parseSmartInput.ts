import { EXPENSE_PAYMENT_METHODS, INCOME_PAYMENT_METHODS } from '@/domain/constants'
import type { PaymentMethod } from '@/domain/entities'
import { parseCurrency } from './currency'
import { dateCompletions, matchDateAt, parsePortugueseDate } from './dates'

export interface SmartParseResult {
  amount: number | null
  description: string
  category: string | null
  paymentMethod: PaymentMethod | null
  date: string | null
  error: string | null
}

type Slot = 'amount' | 'category' | 'payment' | 'date'

interface Span {
  start: number
  end: number
  slot: Slot | null
  provisional: boolean
  raw: string
}

const SUGGESTION_LIMIT = 10
const AMOUNT_RE = /(?:R\$\s?)?\d+(?:\.\d{3})*,\d{2}/iy
const WHITESPACE_RE = /\s/
const MAX_REGISTRY_WORDS = 3

const PAYMENT_VALUES = [...EXPENSE_PAYMENT_METHODS, ...INCOME_PAYMENT_METHODS]
const PAYMENT_LOOKUP = new Map<string, PaymentMethod>(
  PAYMENT_VALUES.map((value) => [value.toLowerCase(), value]),
)

export function detectDateMonth(text: string): string | null {
  for (let index = 0; index < text.length; index++) {
    const match = matchDateAt(text, index)
    if (!match) continue
    const iso = parsePortugueseDate(text.slice(index, match.end))
    if (iso) return iso.slice(0, 7)
  }
  return null
}

function wordEnd(text: string, from: number): number {
  let index = from
  while (index < text.length && !WHITESPACE_RE.test(text[index])) index += 1
  return index
}

function matchRegistry(text: string, index: number, lookup: Map<string, string>): number | null {
  let best: number | null = null
  let end = index + 1
  for (let word = 0; word < MAX_REGISTRY_WORDS; word++) {
    end = wordEnd(text, end)
    if (end === index + 1) return best
    if (lookup.has(text.slice(index + 1, end).toLowerCase())) best = end
    if (end >= text.length || text[end] !== ' ') break
    end += 1
  }
  return best
}

function candidateAt(text: string, index: number, categories: Map<string, string>): Span | null {
  let best: Span | null = null

  const take = (end: number, slot: Slot, provisional = false) => {
    if (end > index && (best === null || end > best.end)) {
      best = { start: index, end, slot, provisional, raw: text.slice(index, end) }
    }
  }

  AMOUNT_RE.lastIndex = index
  const amount = AMOUNT_RE.exec(text)
  if (amount) take(index + amount[0].length, 'amount')

  const date = matchDateAt(text, index)
  if (date) take(date.end, 'date', date.provisional)

  if (text[index] === '#') {
    const end = matchRegistry(text, index, categories)
    if (end !== null) take(end, 'category')
  }
  if (text[index] === '@') {
    const end = matchRegistry(text, index, PAYMENT_LOOKUP)
    if (end !== null) take(end, 'payment')
  }

  return best
}

function textSpan(text: string, start: number): Span {
  const end = wordEnd(text, start)
  return { start, end, slot: null, provisional: false, raw: text.slice(start, end) }
}

function lex(text: string, categories: readonly string[]): Span[] {
  const lookup = new Map(categories.map((value) => [value.toLowerCase(), value]))
  const spans: Span[] = []
  let index = 0

  while (index < text.length) {
    if (WHITESPACE_RE.test(text[index])) {
      index += 1
      continue
    }
    const span = candidateAt(text, index, lookup) ?? textSpan(text, index)
    spans.push(span)
    index = span.end
  }

  return spans
}

interface Analysis extends SmartParseResult {
  lastSlotEnd: number
  lastFreeEnd: number
}

function analyze(text: string, categories: readonly string[]): Analysis {
  const spans = lex(text, categories)
  const committed = spans.map((span) => span.slot !== null)

  let amount: number | null = null
  let category: string | null = null
  let paymentMethod: string | null = null
  let error: string | null = null

  spans.forEach((span, i) => {
    if (span.slot === null || !committed[i]) return
    switch (span.slot) {
      case 'amount':
        if (amount !== null) error ??= 'Multiple amounts'
        else amount = parseCurrency(span.raw.replace(/^R\$\s?/i, ''))
        break
      case 'category':
        if (category !== null) error ??= 'Multiple categories'
        else category = span.raw.slice(1)
        break
      case 'payment': {
        if (paymentMethod !== null) {
          error ??= 'Multiple payment methods'
          break
        }
        paymentMethod = PAYMENT_LOOKUP.get(span.raw.slice(1).toLowerCase()) ?? null
        break
      }
      case 'date':
        break
    }
  })

  const describe = () => {
    let runs = 0
    let lastRun = ''
    let open = false
    for (let i = 0; i < spans.length; i++) {
      if (committed[i]) {
        open = false
        continue
      }
      if (!open) {
        runs += 1
        open = true
        lastRun = ''
      }
      lastRun += (lastRun === '' ? '' : ' ') + spans[i].raw
    }
    return { runs, text: lastRun }
  }

  let description = describe()
  for (let i = 0; !isSingleRun(description) && i < spans.length; i++) {
    if (spans[i].provisional && committed[i]) {
      committed[i] = false
      description = describe()
    }
  }

  const dateSpans = spans.filter((span, i) => span.slot === 'date' && committed[i])
  const date = dateSpans.length > 0 ? parsePortugueseDate(dateSpans[0].raw) : null

  if (!error) {
    if (description.runs > 1) error = 'Description must be contiguous'
    else if (description.runs === 0) error = 'Description required'
    else if (amount === null || amount <= 0) error = 'Amount required'
    else if (dateSpans.length > 1) error = 'Multiple dates'
  }

  const lastSlot = lastIndexOf(spans, committed)
  const freeFlags = spans.map((_, i) => !committed[i])
  const lastFree = lastIndexOf(spans, freeFlags)
  const slotSpan = lastSlot >= 0 ? spans[lastSlot] : null
  const stillTyping = slotSpan?.slot === 'date' && extendsDateForm(slotSpan.raw)

  return {
    amount,
    description: description.runs === 1 ? description.text : '',
    category,
    paymentMethod,
    date,
    error,
    lastSlotEnd: stillTyping ? (slotSpan?.start ?? 0) : (slotSpan?.end ?? 0),
    lastFreeEnd: spans[lastFree]?.end ?? 0,
  }
}

function extendsDateForm(raw: string): boolean {
  const form = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return dateCompletions(form).some((completion) => completion.length > form.length)
}

function isSingleRun(description: { runs: number; text: string }): boolean {
  return description.runs <= 1 && description.text !== ''
}

function lastIndexOf(spans: Span[], keep: boolean[]): number {
  for (let i = spans.length - 1; i >= 0; i--) {
    if (keep[i]) return i
  }
  return -1
}

export function parseSmartInput(text: string, categories: readonly string[]): SmartParseResult {
  const { amount, description, category, paymentMethod, date, error } = analyze(text, categories)
  return { amount, description, category, paymentMethod, date, error }
}

function prefixFilter(items: readonly string[], prefix: string): string[] {
  const needle = prefix.toLowerCase()
  return items.filter((item) => item.toLowerCase().startsWith(needle)).slice(0, SUGGESTION_LIMIT)
}

function trailingToken(segment: string): string {
  const trimmed = segment.trimEnd()
  const sigil = Math.max(trimmed.lastIndexOf('#'), trimmed.lastIndexOf('@'))
  if (sigil >= 0) return trimmed.slice(sigil)
  return trimmed.match(/\S+$/)?.[0] ?? ''
}

function trailingDateForm(segment: string): string | null {
  const words = segment.trim().split(/\s+/).filter(Boolean)
  for (let start = 0; start < words.length; start++) {
    const candidate = words.slice(start).join(' ')
    if (dateCompletions(candidate).length > 0) return candidate
  }
  return null
}

export function getSuggestions(
  text: string,
  knownDescriptions: readonly string[],
  categories: readonly string[],
): string[] {
  const state = analyze(text, categories)
  const segment = text.slice(state.lastSlotEnd)
  const token = trailingToken(segment)

  if (token.startsWith('#')) {
    return state.category
      ? []
      : prefixFilter(categories, token.slice(1)).map((value) => `#${value}`)
  }
  if (token.startsWith('@')) {
    return state.paymentMethod
      ? []
      : prefixFilter(PAYMENT_VALUES, token.slice(1)).map((value) => `@${value}`)
  }
  if (token.toLowerCase().startsWith('r$')) return []

  const form = trailingDateForm(segment)
  if (form !== null) return dateCompletions(form)

  if (token === '') {
    const descriptionClosed = state.lastSlotEnd > state.lastFreeEnd
    return descriptionClosed && !state.date ? dateCompletions('') : []
  }

  return prefixFilter(knownDescriptions, token)
}

export function acceptSuggestion(text: string, suggestion: string): string {
  const needle = suggestion.toLowerCase()
  let cut = text.length

  for (let i = 0; i <= text.length; i++) {
    if (i > 0 && !WHITESPACE_RE.test(text[i - 1])) continue
    if (needle.startsWith(text.slice(i).trim().toLowerCase())) {
      cut = i
      break
    }
  }

  const head = text.slice(0, cut).trimEnd()
  return head === '' ? `${suggestion} ` : `${head} ${suggestion} `
}
