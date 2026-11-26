<script lang="ts">
import ListIcon from 'phosphor-svelte/lib/ListIcon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
        class="size-10 lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        {...props}
      >
        <ListIcon />
      </Button>
    {/snippet}
  </DialogTrigger>

  <DialogContent
    class="content-start left-auto right-0 top-0 h-full w-72 max-w-none translate-x-0 translate-y-0 gap-0 rounded-l-[6px] p-0 sm:max-w-none max-sm:top-0 max-sm:right-0 max-sm:bottom-auto max-sm:left-auto max-sm:h-full max-sm:max-h-none max-sm:w-72 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:rounded-l-[6px] max-sm:border-y-0 max-sm:border-r-0"
  >
    <DialogHeader class="border-b border-border p-4">
      <DialogTitle>Navigate</DialogTitle>
    </DialogHeader>
    <nav class="flex flex-col gap-0.5 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
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
