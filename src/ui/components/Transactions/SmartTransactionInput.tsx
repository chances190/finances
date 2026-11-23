import { PlusIcon } from '@phosphor-icons/react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { localYMD } from '@/domain/calculations'
import type { FundingAccount } from '@/domain/ledger'
import { formatPlainCurrency } from '@/lib/currency'
import {
  acceptSuggestion,
  detectDateMonth,
  getSuggestions,
  parseSmartInput,
} from '@/lib/parseSmartInput'

type ParsedRow = {
  description: string
  amount: number
  category: string | null
  paymentMethod: FundingAccount | null
  kind: 'income' | 'expense' | null
  date: string
}

interface SmartInputProps {
  onAdd: (parsed: ParsedRow) => void
  onOpenModal: () => void
  knownDescriptions: string[]
  categoriesForMonth: (month: string | null) => string[]
}

export default function SmartTransactionInput({
  onAdd,
  onOpenModal,
  knownDescriptions,
  categoriesForMonth,
}: SmartInputProps) {
  const [raw, setRaw] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const suggestionRef = useRef<HTMLDivElement>(null)

  const categories = useMemo(
    () => categoriesForMonth(detectDateMonth(raw)),
    [categoriesForMonth, raw],
  )
  const parsed = useMemo(() => parseSmartInput(raw, categories), [raw, categories])
  const deferredRaw = useDeferredValue(raw)

  useEffect(() => {
    const matches = getSuggestions(deferredRaw, knownDescriptions, categories)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
    setActiveSuggestion(matches.length > 0 ? 0 : -1)
  }, [deferredRaw, knownDescriptions, categories])

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
    if (parsed.amount === null) return
    onAdd({
      description: parsed.description,
      amount: parsed.amount,
      category: parsed.category,
      paymentMethod: parsed.paymentMethod,
      kind: parsed.kind,
      date: parsed.date ?? localYMD(),
    })
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

  function submitOrAccept() {
    if (showSuggestions && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      acceptActive()
    } else {
      attemptSubmit()
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    submitOrAccept()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Tab') {
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
      {(focused || raw.trim() !== '') && (
        <div className="mb-0.5 flex flex-nowrap gap-x-3 overflow-x-auto bg-muted/50 px-2 py-1 text-[10px] whitespace-nowrap text-muted-foreground">
          <span>
            Payment: <span className="font-medium">{parsed.paymentMethod ?? '—'}</span>
          </span>
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
            Date: <span className="font-medium">{parsed.date || '—'}</span>
          </span>
        </div>
      )}

      <form className="flex items-stretch gap-2" onSubmit={handleSubmit}>
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
              setShowSuggestions(false)
            }}
            onFocus={() => {
              setFocused(true)
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            enterKeyHint="go"
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
                  className={`flex min-h-10 w-full items-center px-2 py-2 text-left truncate hover:bg-muted sm:min-h-6 sm:py-1 ${
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
            type="button"
            size="icon-xs"
            className="size-10 sm:size-6"
            onClick={attemptSubmit}
            aria-label="Add transaction from input"
          >
            <PlusIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="h-10 text-xs sm:h-7"
            onClick={onOpenModal}
          >
            Add
          </Button>
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
      </form>

      {!showSuggestions && submitError && (
        <div className="mt-0.5 text-[10px] text-destructive bg-destructive/10 px-2 py-1">
          {submitError}
        </div>
      )}
    </div>
  )
}
