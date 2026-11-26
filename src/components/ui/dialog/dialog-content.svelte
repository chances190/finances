<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui'
import XIcon from 'phosphor-svelte/lib/XIcon'
import type { ComponentProps, Snippet } from 'svelte'
import { Button } from '@/components/ui/button/index.js'
import { cn, type WithoutChildrenOrChild } from '@/lib/utils.js'
import DialogOverlay from './dialog-overlay.svelte'
import DialogPortal from './dialog-portal.svelte'

let {
  ref = $bindable(null),
  class: className,
  portalProps,
  children,
  showCloseButton = true,
  ...restProps
}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
  portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>
  children: Snippet
  showCloseButton?: boolean
} = $props()
</script>

<DialogPortal {...portalProps}>
  <DialogOverlay />
  <DialogPrimitive.Content
    bind:ref
    data-slot="dialog-content"
    class={cn(
      'dialog-surface text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 grid max-w-[calc(100%_-_2rem)] gap-4 p-4 text-sm duration-100 sm:max-w-sm fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none',
      'max-sm:top-auto max-sm:right-0 max-sm:bottom-[var(--sheet-lift)] max-sm:left-0 max-sm:max-h-[calc(var(--sheet-height)-1rem)] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-t-[6px] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))]',
      className,
    )}
    {...restProps}
  >
    {@render children?.()}
    {#if showCloseButton}
      <DialogPrimitive.Close data-slot="dialog-close">
        {#snippet child({ props })}
          <Button variant="ghost" class="absolute top-2 right-2" size="icon-sm" {...props}>
            <XIcon />
            <span class="sr-only">Close</span>
          </Button>
        {/snippet}
      </DialogPrimitive.Close>
    {/if}
  </DialogPrimitive.Content>
</DialogPortal>
