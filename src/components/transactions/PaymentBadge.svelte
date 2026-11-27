<script lang="ts">
import { Badge } from '@/components/ui/badge'
import { ACCOUNT_LABELS, type Movement, paymentMethodOf } from '@/domain/ledger'
import { cn } from '@/lib/utils'
import { accountOf, paymentColorVar } from './movement-display'

let { movement }: { movement: Movement } = $props()

const method = $derived(paymentMethodOf(movement))
const account = $derived(accountOf(movement))
const label = $derived(method ?? (account ? ACCOUNT_LABELS[account] : null))
const color = $derived(paymentColorVar(method))
</script>

{#if label}
  <Badge
    variant="outline"
    class={cn(
      'border-border bg-transparent font-normal text-muted-foreground',
      color && 'tx-pay-badge',
    )}
    style={color ? `--pay: ${color}` : undefined}
    >{label}</Badge
  >
{/if}
