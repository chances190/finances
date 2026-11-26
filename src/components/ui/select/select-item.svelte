<script lang="ts">
import { Select as SelectPrimitive } from 'bits-ui'
import CheckIcon from 'phosphor-svelte/lib/CheckIcon'
import { cn, type WithoutChild } from '@/lib/utils.js'

let {
  ref = $bindable(null),
  class: className,
  value,
  label,
  children: childrenProp,
  ...restProps
}: WithoutChild<SelectPrimitive.ItemProps> = $props()
</script>

<SelectPrimitive.Item
  bind:ref
  {value}
  {label}
  data-slot="select-item"
  class={cn(
    "focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-2 pl-1.5 text-xs [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 relative flex w-full cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
    className,
  )}
  {...restProps}
>
  {#snippet children({ selected, highlighted })}
    <span class="flex flex-1 gap-2 shrink-0 items-center whitespace-nowrap">
      {#if childrenProp}
        {@render childrenProp({ selected, highlighted })}
      {:else}
        {label || value}
      {/if}
      {#if selected}
        <CheckIcon class="size-3.5 shrink-0 text-primary" />
      {/if}
    </span>
  {/snippet}
</SelectPrimitive.Item>
