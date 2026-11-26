<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
  icon?: Snippet
}

interface Props {
  options: Option[]
  value: string
  onValueChange: (value: string) => void
  class?: string
  'aria-label'?: string
}

let { options, value, onValueChange, class: className, 'aria-label': ariaLabel }: Props = $props()
</script>

<div
  role="radiogroup"
  aria-label={ariaLabel}
  class={cn(
    'inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted p-1',
    className,
  )}
>
  {#each options as option (option.value)}
    {@const selected = option.value === value}
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onclick={() => onValueChange(option.value)}
      class={cn(
        'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors sm:min-h-6',
        selected
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {@render option.icon?.()}
      {option.label}
    </button>
  {/each}
</div>
