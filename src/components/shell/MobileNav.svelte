<script lang="ts">
import ListIcon from 'phosphor-svelte/lib/ListIcon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import NavIcon from './NavIcon.svelte'
import type { NavItem } from './nav'

interface Props {
  items: NavItem[]
  active: string
  onChange: (path: string) => void
}

let { items, active, onChange }: Props = $props()
let open = $state(false)
</script>

<Dialog bind:open>
  <DialogTrigger>
    {#snippet child({ props })}
      <Button
        variant="ghost"
        size="icon-lg"
        class="size-8 lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        {...props}
      >
        <ListIcon class="size-4" />
      </Button>
    {/snippet}
  </DialogTrigger>

  <DialogContent
    class="top-[calc(4rem+env(safe-area-inset-top))] right-2.5 left-2.5 w-auto max-w-none translate-x-0 translate-y-0 gap-0 rounded-[6px] p-0 sm:max-w-none max-sm:top-[calc(4rem+env(safe-area-inset-top))] max-sm:right-2.5 max-sm:bottom-auto max-sm:left-2.5 max-sm:max-h-[calc(100dvh-5rem)] max-sm:w-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-[6px] max-sm:border max-sm:pb-0"
  >
    <div class="flex items-center justify-between border-b border-border px-1 pt-2.5 pr-9 pb-2">
      <DialogTitle class="text-xs font-semibold">Navigate</DialogTitle>
    </div>
    <nav class="flex flex-col gap-[3px] p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      {#each items as item (item.path)}
        <button
          type="button"
          aria-current={active === item.path ? 'page' : undefined}
          class={cn(
            'nav-item nav-item-vertical justify-start',
            active === item.path && 'is-active',
          )}
          onclick={() => {
            onChange(item.path)
            open = false
          }}
        >
          <NavIcon name={item.icon} />
          {item.label}
        </button>
      {/each}
    </nav>
  </DialogContent>
</Dialog>
