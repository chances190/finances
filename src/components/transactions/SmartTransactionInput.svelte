<script lang="ts">
import PlusIcon from 'phosphor-svelte/lib/PlusIcon'
import { Button } from '@/components/ui/button'
import { localYMD } from '@/domain/calculations'
import type { PaymentMethod } from '@/domain/ledger'
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
  paymentMethod: PaymentMethod | null
  kind: 'income' | 'expense' | null
  date: string
}

interface Props {
  onAdd: (parsed: ParsedRow) => void
  onOpenModal: () => void
  knownDescriptions: string[]
  categoriesForMonth: (month: string | null) => string[]
}

let { onAdd, onOpenModal, knownDescriptions, categoriesForMonth }: Props = $props()

let raw = $state('')
let dismissed = $state<string | null>(null)
let activeSuggestion = $state(0)
let submitError = $state<string | null>(null)
let focused = $state(false)
let suggestionEl = $state<HTMLDivElement | null>(null)

const categories = $derived(categoriesForMonth(detectDateMonth(raw)))
const parsed = $derived(parseSmartInput(raw, categories))
const suggestions = $derived(getSuggestions(raw, knownDescriptions, categories))
const showSuggestions = $derived(suggestions.length > 0 && dismissed !== raw)
const activeIndex = $derived(Math.min(activeSuggestion, suggestions.length - 1))

$effect(() => {
  if (activeIndex < 0 || !suggestionEl) return
  const item = suggestionEl.children[activeIndex] as HTMLElement | undefined
  item?.scrollIntoView({ block: 'nearest' })
})

function attemptSubmit() {
  if (!raw.trim()) return
  if (parsed.error) {
    submitError = parsed.error
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
  raw = ''
  dismissed = null
  submitError = null
}

function acceptActive() {
  const suggestion = suggestions[activeIndex]
  if (activeIndex >= 0 && suggestion) {
    const next = acceptSuggestion(raw, suggestion)
    raw = next
    dismissed = next
  }
}

function submitOrAccept() {
  if (showSuggestions && suggestions[activeIndex]) {
    acceptActive()
  } else {
    attemptSubmit()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    if (showSuggestions && suggestions[activeIndex]) {
      event.preventDefault()
      acceptActive()
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeSuggestion = Math.min(activeIndex + 1, suggestions.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeSuggestion = Math.max(activeIndex - 1, 0)
  } else if (event.key === 'Escape') {
    dismissed = raw
    submitError = null
  }
}
</script>

<div class="relative">
  <form
    class="flex items-stretch gap-1.5"
    onsubmit={(event) => {
      event.preventDefault()
      submitOrAccept()
    }}
  >
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="size-10 shrink-0 sm:size-8"
      onclick={attemptSubmit}
      aria-label="Add transaction from input"
    >
      <PlusIcon class="size-4" />
    </Button>

    <div class="relative min-w-0 flex-1">
      <input
        value={raw}
        oninput={(event) => {
          raw = event.currentTarget.value
          dismissed = null
          activeSuggestion = 0
          submitError = null
        }}
        onkeydown={handleKeydown}
        onblur={() => {
          focused = false
          dismissed = raw
        }}
        onfocus={() => {
          focused = true
          dismissed = null
        }}
        enterkeyhint="go"
        autocomplete="off"
        spellcheck="false"
        placeholder="Description 25,90 #Food @Debit hoje"
        class="h-10 min-w-0 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground sm:h-8"
        aria-label="Quick add transaction"
      >
      {#if showSuggestions}
        <div
          bind:this={suggestionEl}
          class="floating-surface absolute top-full right-0 left-0 z-50 mt-1 max-h-40 overflow-y-auto text-xs"
        >
          {#each suggestions as suggestion, index (suggestion)}
            <button
              type="button"
              class="flex min-h-10 w-full items-center truncate px-2 py-1.5 text-left hover:bg-muted sm:min-h-7 {index ===
              activeIndex
                ? 'bg-muted'
                : ''}"
              onmousedown={(event) => {
                event.preventDefault()
                const next = acceptSuggestion(raw, suggestion)
                raw = next
                dismissed = next
              }}
              onfocus={() => {
                activeSuggestion = index
              }}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <Button
      type="button"
      variant="outline"
      size="sm"
      class="h-10 shrink-0 text-xs sm:h-8"
      onclick={onOpenModal}
    >
      Add
    </Button>
    <button type="submit" class="sr-only" tabindex={-1} aria-label="Add transaction"></button>
  </form>

  {#if focused || raw.trim() !== ''}
    <div
      class="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px] text-muted-foreground"
    >
      <span
        >Payment:
        <span class="font-medium text-foreground">{parsed.paymentMethod ?? '—'}</span></span
      >
      <span>
        Amount:
        <span class="font-mono font-medium text-foreground">
          {parsed.amount !== null ? formatPlainCurrency(parsed.amount) : '—'}
        </span>
      </span>
      <span>
        Description:
        <span class="font-medium text-foreground">{parsed.description || '—'}</span>
      </span>
      <span
        >Category: <span class="font-medium text-foreground">{parsed.category || '—'}</span></span
      >
      <span>Date: <span class="font-medium text-foreground">{parsed.date || '—'}</span></span>
    </div>
  {/if}

  {#if !showSuggestions && submitError}
    <div
      class="mt-1 rounded-[3px] bg-destructive/10 px-2 py-1 text-[10px] text-destructive"
      role="alert"
    >
      {submitError}
    </div>
  {/if}
</div>
