import { PlusIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_CATEGORIES, INCOME_PAYMENT_METHODS, PAYMENT_METHODS } from '@/domain/constants'
import { parseNaturalDate } from '@/lib/parseDate'

type ParsedRow = {
  description: string
  amount: string
  category: string | null
  paymentMethod: string | null
  date: string
  error: string | null
}

interface SmartInputProps {
  onAdd: (parsed: ParsedRow) => void
  onOpenModal: () => void
  onOpenImport: () => void
  knownDescriptions: string[]
}

function getPaymentMethods(): string[] {
  return [...PAYMENT_METHODS, ...INCOME_PAYMENT_METHODS]
}

function getPaymentMethodLabel(pm: string): string {
  const labels: Record<string, string> = {
    CASH: 'Cash',
    DEBIT: 'Debit',
    CREDIT: 'Credit',
    PIX: 'Pix',
    MEAL_VOUCHER: 'Meal Voucher',
    SALARY: 'Salary',
    TRANSFER: 'Transfer',
    VOUCHER: 'Voucher',
  }
  return labels[pm] ?? pm
}

export default function SmartTransactionInput({
  onAdd,
  onOpenModal,
  onOpenImport,
  knownDescriptions,
}: SmartInputProps) {
  const [raw, setRaw] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tokens = raw.split(',').map((t) => t.trim())
    const lastToken = tokens[tokens.length - 1] || ''
    const tokenIndex = tokens.length - 1

    if (!lastToken || tokenIndex > 4) {
      setShowSuggestions(false)
      return
    }

    const lower = lastToken.toLowerCase()
    let matches: string[] = []

    if (tokenIndex === 0) {
      matches = knownDescriptions
        .filter((d) => d.toLowerCase().includes(lower))
        .slice(0, 6)
        .map((d) => {
          const rest = tokens.slice(1).join(', ')
          return rest ? `${d}, ${rest}` : d
        })
    } else if (tokenIndex === 2) {
      const allCats = Array.from(new Set([...DEFAULT_CATEGORIES, ...knownDescriptions]))
        .filter((d) => d.toLowerCase().includes(lower))
        .slice(0, 8)
      matches = allCats.map((cat) => {
        const prefix = tokens.slice(0, 2).join(', ')
        return `${prefix}, ${cat}`
      })
    } else if (tokenIndex === 3) {
      matches = getPaymentMethods()
        .filter(
          (pm) =>
            pm.toLowerCase().includes(lower) ||
            getPaymentMethodLabel(pm).toLowerCase().includes(lower),
        )
        .slice(0, 6)
        .map((pm) => {
          const prefix = tokens.slice(0, 3).join(', ')
          return `${prefix}, ${pm}`
        })
    }

    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
    setActiveSuggestion(-1)
  }, [raw, knownDescriptions])

  function parseInput(text: string): ParsedRow {
    const tokens = text.split(',').map((t) => t.trim())
    const description = tokens[0] || ''
    const amount = tokens[1] || ''
    const category = tokens[2] || null
    const paymentMethod = tokens[3] || null
    const dateText = tokens[4] || null

    let date = new Date().toISOString().slice(0, 10)
    let error: string | null = null

    if (!description) error = 'Description is required'
    else if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0)
      error = 'Amount must be a positive number'
    else {
      if (dateText) {
        const parsed = parseNaturalDate(dateText)
        if (parsed) date = parsed
        else error = `Could not parse date: "${dateText}"`
      }
    }

    return { description, amount, category, paymentMethod, date, error }
  }

  function handleSubmit(text: string) {
    const parsed = parseInput(text)
    if (parsed.error) return
    onAdd(parsed)
    setRaw('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        setRaw(suggestions[activeSuggestion])
        setShowSuggestions(false)
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
    } else if (e.key === 'Tab' && showSuggestions) {
      e.preventDefault()
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        setRaw(suggestions[activeSuggestion])
        setShowSuggestions(false)
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
              if (raw && suggestions.length > 0) setShowSuggestions(true)
            }}
            placeholder="Lunch, 25.90, Food, debit"
            className="h-7 text-xs font-mono"
            aria-label="Quick add transaction"
          />
          {showSuggestions && (
            <div
              ref={suggestionRef}
              className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border border-border shadow-md text-xs"
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
                    setRaw(s)
                    setShowSuggestions(false)
                    inputRef.current?.focus()
                  }}
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
            Desc: <span className="font-medium">{parsed.description}</span>
          </span>
          <span>
            Amt: <span className="font-medium font-mono">{Number(parsed.amount).toFixed(2)}</span>
          </span>
          {parsed.category && (
            <span>
              Cat: <span className="font-medium">{parsed.category}</span>
            </span>
          )}
          {parsed.paymentMethod && (
            <span>
              Pay:{' '}
              <span className="font-medium">{getPaymentMethodLabel(parsed.paymentMethod)}</span>
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
