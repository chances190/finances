import { PlusIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPlainCurrency } from '@/lib/currency'
import type { SmartParseResult } from '@/lib/parseSmartInput'
import { acceptSuggestion, getSuggestions, parseSmartInput } from '@/lib/parseSmartInput'

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
  knownDescriptions: string[]
  categories: string[]
}

function toDisplayResult(r: SmartParseResult): ParsedRow {
  return {
    description: r.description,
    amount: r.amount !== null ? String(r.amount) : '',
    category: r.category,
    paymentMethod: r.paymentMethod,
    date: r.date ?? '',
    error: r.error,
  }
}

export default function SmartTransactionInput({
  onAdd,
  onOpenModal,
  knownDescriptions,
  categories,
}: SmartInputProps) {
  const [raw, setRaw] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const suggestionRef = useRef<HTMLDivElement>(null)

  const parsed = parseSmartInput(raw, categories)

  useEffect(() => {
    const matches = getSuggestions(raw, knownDescriptions, categories)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
    setActiveSuggestion(matches.length > 0 ? 0 : -1)
  }, [raw, knownDescriptions, categories])

  useEffect(() => {
    if (activeSuggestion < 0 || !suggestionRef.current) return
    const item = suggestionRef.current.children[activeSuggestion] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeSuggestion])

  function attemptSubmit() {
    if (!raw.trim()) return
    if (parsed.error) {
      setSubmitError(parsed.error)
      return
    }
    onAdd(toDisplayResult(parsed))
    setRaw('')
    setShowSuggestions(false)
    setSubmitError(null)
  }

  function acceptActive() {
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      setRaw(acceptSuggestion(raw, suggestions[activeSuggestion]))
      setShowSuggestions(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        acceptActive()
      } else {
        attemptSubmit()
      }
    } else if (e.key === 'Tab') {
      if (showSuggestions && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        e.preventDefault()
        acceptActive()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSubmitError(null)
    }
  }

  return (
    <div className="relative">
      {focused && (
        <div className="mb-0.5 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 flex flex-wrap gap-x-4 gap-y-0.5">
          <span>
            Amount:{' '}
            <span className="font-medium font-mono">
              {parsed.amount !== null ? formatPlainCurrency(parsed.amount) : '—'}
            </span>
          </span>
          <span>
            Description: <span className="font-medium">{parsed.description || '—'}</span>
          </span>
          <span>
            Category: <span className="font-medium">{parsed.category || '—'}</span>
          </span>
          <span>
            Payment: <span className="font-medium">{parsed.paymentMethod ?? '—'}</span>
          </span>
          <span>
            Date: <span className="font-medium">{parsed.date || '—'}</span>
          </span>
        </div>
      )}

      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <Input
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value)
              setSubmitError(null)
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setFocused(false)
              setTimeout(() => setShowSuggestions(false), 200)
            }}
            onFocus={() => {
              setFocused(true)
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            placeholder="Description 25,90 #Food @Debit hoje"
            className="h-10 text-xs font-mono sm:h-7"
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
                    setRaw(acceptSuggestion(raw, s))
                    setShowSuggestions(false)
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
            className="size-10 sm:size-6"
            onClick={attemptSubmit}
            aria-label="Add transaction from input"
          >
            <PlusIcon />
          </Button>
          <Button variant="outline" size="xs" className="h-10 text-xs sm:h-7" onClick={onOpenModal}>
            Add
          </Button>
        </div>
      </div>

      {!showSuggestions && submitError && (
        <div className="mt-0.5 text-[10px] text-destructive bg-destructive/10 px-2 py-1">
          {submitError}
        </div>
      )}
    </div>
  )
}
