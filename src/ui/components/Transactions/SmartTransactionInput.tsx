import { PlusIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { localYMD } from '@/domain/calculations'
import { INCOME_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/domain/constants'
import { parseCurrency } from '@/lib/currency'
import { parseNaturalDate } from '@/lib/parseDate'

type ParsedRow = {
  description: string
  amount: string
  category: string | null
  paymentMethod: string | null
  date: string
  error: string | null
}

function splitAmountTokens(parts: string[]): { amount: string; rest: string[] } {
  const isPureInt = (s: string) => /^\d+$/.test(s)
  const looksLikeThousands = (s: string) => /^\d{1,3}(\.\d{3})+$/.test(s)
  if (
    parts.length >= 3 &&
    isPureInt(parts[2]) &&
    (isPureInt(parts[1]) || looksLikeThousands(parts[1]))
  ) {
    return { amount: `${parts[1]},${parts[2]}`, rest: parts.slice(3) }
  }
  return { amount: parts[1] || '', rest: parts.slice(2) }
}

interface SmartInputProps {
  onAdd: (parsed: ParsedRow) => void
  onOpenModal: () => void
  onOpenImport: () => void
  knownDescriptions: string[]
  categories: string[]
}

function getAllPaymentMethods() {
  return [...PAYMENT_METHODS, ...INCOME_PAYMENT_METHODS]
}

function getSuggestionsForToken(
  tokenIndex: number,
  prefix: string,
  allDescs: string[],
  categories: string[],
): string[] {
  const lower = prefix.toLowerCase()
  if (tokenIndex === 0) {
    const all = [...getAllPaymentMethods().map((p) => PAYMENT_METHOD_LABELS[p])]
    if (!prefix) return all
    return all.filter((label) => label.toLowerCase().includes(lower))
  }
  if (tokenIndex === 1) return []
  if (tokenIndex === 2) {
    const all = allDescs
    if (!prefix) return all.slice(0, 10)
    return all.filter((c) => c.toLowerCase().includes(lower)).slice(0, 10)
  }
  if (tokenIndex === 3) {
    const all = categories
    if (!prefix) return all.slice(0, 10)
    return all.filter((c) => c.toLowerCase().includes(lower)).slice(0, 10)
  }
  if (tokenIndex === 4) {
    const datePresets = ['today', 'yesterday', 'tomorrow']
    if (!prefix) return datePresets
    return datePresets.filter((d) => d.includes(lower))
  }
  return []
}

function buildSuggestionText(suggestion: string, tokens: string[], tokenIndex: number): string {
  const result = [...tokens]
  while (result.length <= tokenIndex) result.push('')
  result[tokenIndex] = suggestion
  const built = result.map((t) => t.trim()).join(', ')
  return tokenIndex < 4 ? `${built}, ` : built
}

export default function SmartTransactionInput({
  onAdd,
  onOpenModal,
  onOpenImport,
  knownDescriptions,
  categories,
}: SmartInputProps) {
  const [raw, setRaw] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const parts = raw.split(',').map((t) => t.trim())
    const idx = Math.min(parts.length - 1, 4)
    const last = parts.length > 0 ? parts[parts.length - 1] || '' : ''
    const matches = getSuggestionsForToken(idx, last, knownDescriptions, categories)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0 && idx <= 4)
    setActiveSuggestion(-1)
  }, [raw, knownDescriptions, categories])

  function parseInput(text: string): ParsedRow {
    const parts = text.split(',').map((t) => t.trim())
    const paymentMethod = parts[0] || null
    const { amount, rest } = splitAmountTokens(parts)
    const description = rest[0] || ''
    const category = rest[1] || null
    const dateText = rest[2] || null

    let date = localYMD()
    let error: string | null = null

    const pmCode = paymentMethod
      ? (Object.entries(PAYMENT_METHOD_LABELS).find(
          ([, label]) => label.toLowerCase() === paymentMethod.toLowerCase(),
        )?.[0] ?? null)
      : null

    const amountValue = parseCurrency(amount)

    if (paymentMethod && !pmCode) error = `Unknown payment method: "${paymentMethod}"`
    else if (!amount || Number.isNaN(amountValue) || amountValue <= 0)
      error = 'Amount must be a positive number'
    else if (!description) error = 'Description is required'
    else {
      if (dateText) {
        const parsed = parseNaturalDate(dateText)
        if (parsed) date = parsed
        else error = `Could not parse date: "${dateText}"`
      }
    }

    return { description, amount, category, paymentMethod: pmCode, date, error }
  }

  function handleSubmit(text: string) {
    const parsed = parseInput(text)
    if (parsed.error) return
    onAdd(parsed)
    setRaw('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  function applySuggestion() {
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      const selected = suggestions[activeSuggestion]
      const parts = raw.split(',').map((t) => t.trim())
      const idx = Math.min(parts.length - 1, 4)
      const built = buildSuggestionText(selected, parts, idx)
      setRaw(built)
      setShowSuggestions(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        applySuggestion()
      } else {
        handleSubmit(raw)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    } else if (e.key === 'Tab') {
      if (showSuggestions && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        e.preventDefault()
        applySuggestion()
      }
    }
  }

  const parsed = raw ? parseInput(raw) : null

  return (
    <div className="relative">
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            placeholder="debit, 25,90, Lunch, Food, today"
            className="h-7 text-xs font-mono"
            aria-label="Quick add transaction"
          />
          {showSuggestions && (
            <div
              ref={suggestionRef}
              className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border border-border shadow-md text-xs max-h-40 overflow-y-auto"
            >
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={`block w-full text-left px-2 py-1 truncate hover:bg-muted ${
                    i === activeSuggestion ? 'bg-muted' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const parts = raw.split(',').map((t) => t.trim())
                    const idx = Math.min(parts.length - 1, 4)
                    const built = buildSuggestionText(s, parts, idx)
                    setRaw(built)
                    setShowSuggestions(false)
                    inputRef.current?.focus()
                  }}
                  onFocus={() => setActiveSuggestion(i)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            onClick={() => handleSubmit(raw)}
            disabled={!parsed || !!parsed.error}
            aria-label="Add transaction from input"
          >
            <PlusIcon />
          </Button>
          <Button variant="outline" size="xs" className="h-7 text-xs" onClick={onOpenModal}>
            Add
          </Button>
          <Button variant="outline" size="xs" className="h-7 text-xs" onClick={onOpenImport}>
            Import CSV
          </Button>
        </div>
      </div>

      {parsed && !parsed.error && (
        <div className="mt-0.5 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 flex flex-wrap gap-x-4 gap-y-0.5">
          <span>
            Pay:{' '}
            <span className="font-medium">
              {parsed.paymentMethod
                ? (PAYMENT_METHOD_LABELS[parsed.paymentMethod] ?? parsed.paymentMethod)
                : '—'}
            </span>
          </span>
          <span>
            Amt:{' '}
            <span className="font-medium font-mono">{parseCurrency(parsed.amount).toFixed(2)}</span>
          </span>
          <span>
            Desc: <span className="font-medium">{parsed.description}</span>
          </span>
          {parsed.category && (
            <span>
              Cat: <span className="font-medium">{parsed.category}</span>
            </span>
          )}
          <span>
            Date: <span className="font-medium">{parsed.date}</span>
          </span>
        </div>
      )}

      {parsed?.error && (
        <div className="mt-0.5 text-[10px] text-destructive bg-destructive/10 px-2 py-1">
          {parsed.error}
        </div>
      )}
    </div>
  )
}
