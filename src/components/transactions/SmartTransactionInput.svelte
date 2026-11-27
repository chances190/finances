<script lang="ts">
import { PlusSignIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/svelte'
import { localYMD } from '@/domain/calculations'
import type { PaymentMethod } from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import { detectDateMonth, parseSmartInput } from '@/lib/parseSmartInput'

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
  categoriesForMonth: (month: string | null) => string[]
}

let { onAdd, onOpenModal, categoriesForMonth }: Props = $props()

let raw = $state('')

const categories = $derived(categoriesForMonth(detectDateMonth(raw)))
const parsed = $derived(parseSmartInput(raw, categories))

function attemptSubmit() {
  if (!raw.trim() || parsed.error || parsed.amount === null) return
  onAdd({
    description: parsed.description || 'New transaction',
    amount: parsed.amount,
    category: parsed.category,
    paymentMethod: parsed.paymentMethod,
    kind: parsed.kind,
    date: parsed.date ?? localYMD(),
  })
  raw = ''
}
</script>

<div>
  <form
    class="flex min-w-0 items-center gap-2"
    onsubmit={(event) => {
      event.preventDefault()
      attemptSubmit()
    }}
  >
    <button type="submit" class="tx-quick-add-icon" aria-label="Add from input">
      <HugeiconsIcon icon={PlusSignIcon} size={16} class="size-4" />
    </button>

    <input
      value={raw}
      oninput={(event) => {
        raw = event.currentTarget.value
      }}
      enterkeyhint="go"
      autocomplete="off"
      spellcheck="false"
      placeholder="iFood 34,90 #Food @Debit hoje"
      class="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      aria-label="Quick add"
    >

    <button
      type="button"
      class="tx-primary shrink-0 px-3 py-1.5 text-xs font-semibold"
      onclick={onOpenModal}
    >
      Add
    </button>
  </form>

  {#if raw.trim()}
    <div class="tx-command-preview">
      <span>{parsed.description || 'New transaction'}</span>
      <span class="font-mono">{formatCurrency(parsed.amount ?? 0)}</span>
      <span>{parsed.category ? `#${parsed.category}` : '#Other'}</span>
      <span>{parsed.paymentMethod ?? (parsed.kind === 'income' ? '@Transfer' : '@Debit/PIX')}</span>
      <span>{parsed.date ?? localYMD()}</span>
      {#if parsed.error}
        <span class="text-destructive">{parsed.error}</span>
      {/if}
    </div>
  {/if}
</div>
