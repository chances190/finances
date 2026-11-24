<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string
  icon?: Snippet
  valueClass?: string
  class?: string
}

let { label, value, icon, valueClass, class: className }: Props = $props()
</script>

<div class={cn('space-y-1 border bg-card p-3 sm:p-4', className)}>
  <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
    {@render icon?.()}
    {label}
  </div>
  <div class={cn('text-lg font-bold whitespace-nowrap text-foreground sm:text-xl', valueClass)}>
    {value}
  </div>
</div>
