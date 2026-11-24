<script lang="ts">
import PlusIcon from 'phosphor-svelte/lib/PlusIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  {#if focused || raw.trim() !== ''}
    <div
      class="mb-0.5 flex flex-nowrap gap-x-3 overflow-x-auto bg-muted/50 px-2 py-1 text-[10px] whitespace-nowrap text-muted-foreground"
    >
      <span> Payment: <span class="font-medium">{parsed.paymentMethod ?? '—'}</span> </span>
      <span>
        Amount:{' '}
        <span class="font-medium font-mono">
          {parsed.amount !== null ? formatPlainCurrency(parsed.amount) : '—'}
        </span>
      </span>
      <span> Description: <span class="font-medium">{parsed.description || '—'}</span> </span>
      <span> Category: <span class="font-medium">{parsed.category || '—'}</span> </span>
      <span> Date: <span class="font-medium">{parsed.date || '—'}</span> </span>
    </div>
  {/if}

  <form
    class="flex items-stretch gap-2"
    onsubmit={(event) => {
      event.preventDefault()
      submitOrAccept()
    }}
  >
    <div class="relative flex-1">
      <Input
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
        placeholder="Description 25,90 #Food @Debit hoje"
        class="h-10 text-xs font-mono sm:h-7"
        aria-label="Quick add transaction"
      />
      {#if showSuggestions}
        <div
          bind:this={suggestionEl}
          class="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border border-border shadow-md text-xs max-h-40 overflow-y-auto"
        >
          {#each suggestions as suggestion, index (suggestion)}
            <button
              type="button"
              class="flex min-h-10 w-full items-center px-2 py-2 text-left truncate hover:bg-muted sm:min-h-6 sm:py-1 {index ===
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

    <div class="flex items-center gap-1">
      <Button
        type="button"
        size="icon-xs"
        class="size-10 sm:size-7"
        onclick={attemptSubmit}
        aria-label="Add transaction from input"
      >
        <PlusIcon />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        class="h-10 text-xs sm:h-7"
        onclick={onOpenModal}
      >
        Add
      </Button>
    </div>
    <button type="submit" class="sr-only" tabindex={-1} aria-label="Add transaction"></button>
  </form>

  {#if !showSuggestions && submitError}
    <div class="mt-0.5 text-[10px] text-destructive bg-destructive/10 px-2 py-1">
      {submitError}
    </div>
  {/if}
</div>
