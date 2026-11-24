<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements'
import { Input } from '@/components/ui/input'
import { formatPlainCurrency, maskMoneyInput, parseCurrency } from '@/lib/currency'

type Props = Omit<HTMLInputAttributes, 'type' | 'inputmode' | 'value' | 'oninput' | 'files'> & {
  value: string
  onValueChange: (value: string) => void
}

let { value, onValueChange, ...rest }: Props = $props()

const display = $derived(value === '' ? '' : formatPlainCurrency(parseCurrency(value)))

function handleInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const masked = maskMoneyInput(input.value)
  input.value = masked
  onValueChange(masked)
}
</script>

<Input
  {...rest}
  type="text"
  inputmode="numeric"
  pattern="[0-9]*"
  value={display}
  oninput={handleInput}
/>
