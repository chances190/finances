<script lang="ts">
import { Button } from '@/components/ui/button'
import { exportJSON } from '@/data/backup/json'
import { exportCSV } from '@/data/exchange/csv'
import { finance } from '@/lib/stores/finance.svelte'
</script>

<div class="flex flex-wrap items-center gap-2">
  <Button
    variant="outline"
    size="xs"
    title="Complete backup of transactions, settlements, and budgets"
    onclick={() =>
      exportJSON({ movements: finance.state.movements, budgets: finance.state.budgets })}
  >
    Export full backup (.json)
  </Button>
  <Button
    variant="outline"
    size="xs"
    title="Exchange purchases and income with other tools"
    onclick={() => exportCSV(finance.state.movements)}
  >
    Export CSV (purchases & income)
  </Button>
</div>
