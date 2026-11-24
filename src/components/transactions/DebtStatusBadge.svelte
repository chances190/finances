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
    class={status === 'Paid'
      ? 'text-green-700 bg-green-50 border-green-200 dark:text-green-200 dark:bg-green-500/15 dark:border-green-400/30'
      : 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-500/15 dark:border-amber-400/30'}
  >
    {status}
  </Badge>
{/if}
