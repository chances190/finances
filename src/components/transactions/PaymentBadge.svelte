<script lang="ts">
import { Badge } from '@/components/ui/badge'
import { ACCOUNT_LABELS, type Movement, paymentMethodOf } from '@/domain/ledger'
import { accountOf } from './movement-display'

let { movement }: { movement: Movement } = $props()

const method = $derived(paymentMethodOf(movement))
const account = $derived(accountOf(movement))
const label = $derived(method ?? (account ? ACCOUNT_LABELS[account] : null))
</script>

{#if label}
  <Badge variant="outline" class="border-border bg-transparent font-normal text-muted-foreground"
    >{label}</Badge
  >
{/if}
