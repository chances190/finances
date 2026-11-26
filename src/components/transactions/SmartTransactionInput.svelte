<script lang="ts">
import PlusIcon from 'phosphor-svelte/lib/PlusIcon'
import { localYMD } from '@/domain/calculations'
import type { PaymentMethod } from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
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
    description: parsed.description || 'New transaction',
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
    class="flex min-w-0 items-center gap-2"
    onsubmit={(event) => {
      event.preventDefault()
      submitOrAccept()
    }}
  >
    <button
      type="button"
      class="tx-quick-add-icon"
      onclick={attemptSubmit}
      aria-label="Add transaction from input"
    >
      <PlusIcon class="size-4" />
    </button>

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
          dismissed = raw
        }}
        onfocus={() => {
          dismissed = null
        }}
        enterkeyhint="go"
        autocomplete="off"
        spellcheck="false"
        placeholder="Description 25,90 #Food @Debit hoje"
        class="min-w-0 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
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

    <button
      type="button"
      class="tx-primary shrink-0 px-3 py-1.5 text-xs font-semibold"
      onclick={onOpenModal}
    >
      Add
    </button>
    <button type="submit" class="sr-only" tabindex={-1} aria-label="Add transaction"></button>
  </form>

  {#if raw.trim()}
    <div class="tx-command-preview">
      <span>{parsed.description || 'New transaction'}</span>
      <span class="font-mono">{formatCurrency(parsed.amount ?? 0)}</span>
      <span>{parsed.category ? `#${parsed.category}` : '#Other'}</span>
      <span>{parsed.paymentMethod ?? (parsed.kind === 'income' ? '@Transfer' : '@Debit/PIX')}</span>
      <span>{parsed.date ?? localYMD()}</span>
      {#if submitError || parsed.error}
        <span class="text-destructive">{submitError ?? parsed.error}</span>
      {/if}
    </div>
  {/if}
</div>
