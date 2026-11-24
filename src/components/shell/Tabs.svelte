<script lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}

let { tabs, active, onChange }: Props = $props()
</script>

<div class="-mx-4 mb-6 overflow-x-auto px-4">
  <div class="flex w-max min-w-full gap-1 border-b border-border">
    {#each tabs as tab (tab.key)}
      <button
        type="button"
        onclick={() => onChange(tab.key)}
        class={cn(
          'min-h-10 shrink-0 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
          active === tab.key
            ? 'bg-card text-foreground border border-b-card border-border -mb-px'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
      >
        {tab.label}
      </button>
    {/each}
  </div>
</div>
