<script lang="ts">
import { Badge } from '@/components/ui/badge'
import type { OutstandingMovement } from '@/domain/ledger'
import { debtStatusOf } from './movement-display'

let { rows }: { rows: OutstandingMovement[] } = $props()

const status = $derived(debtStatusOf(rows))
</script>

{#if status}
  <Badge
    variant="outline"
    class={status === 'Paid' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'}
  >
    {status}
  </Badge>
{/if}
