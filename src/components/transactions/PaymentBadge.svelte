<script lang="ts">
import { Badge } from '@/components/ui/badge'
import { ACCOUNT_LABELS, type Movement, paymentMethodOf } from '@/domain/ledger'
import {
  ACCOUNT_BADGE_COLORS,
  ACCOUNT_BADGE_DARK,
  accountOf,
  PAYMENT_BADGE_COLORS,
} from './movement-display'

let { movement }: { movement: Movement } = $props()

const method = $derived(paymentMethodOf(movement))
const account = $derived(accountOf(movement))
</script>

{#if method}
  <Badge variant="outline" class={PAYMENT_BADGE_COLORS[method]}>{method}</Badge>
{:else if account}
  <Badge variant="outline" class="{ACCOUNT_BADGE_COLORS[account]} {ACCOUNT_BADGE_DARK[account]}"
    >{ACCOUNT_LABELS[account]}</Badge
  >
{/if}
