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

interface Props {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}

let { tabs, active, onChange }: Props = $props()
let open = $state(false)
</script>

<Dialog bind:open>
  <DialogTrigger>
    {#snippet child({ props })}
      <Button
        variant="ghost"
        size="icon-lg"
        class="size-10 sm:hidden"
        aria-label="Open navigation"
        {...props}
      >
        <ListIcon />
      </Button>
    {/snippet}
  </DialogTrigger>

  <DialogContent
    showCloseButton={false}
    class="left-auto right-0 top-0 h-full w-72 max-w-none translate-x-0 translate-y-0 gap-0 rounded-l-2xl p-0 sm:max-w-none"
  >
    <DialogHeader class="border-b border-border p-4">
      <DialogTitle>Navigate</DialogTitle>
    </DialogHeader>
    <nav class="flex flex-col p-2">
      {#each tabs as tab (tab.key)}
        <Button
          variant="ghost"
          aria-current={active === tab.key ? 'page' : undefined}
          class={cn(
            'h-11 justify-start px-3 text-sm',
            active === tab.key && 'bg-muted text-foreground',
          )}
          onclick={() => {
            onChange(tab.key)
            open = false
          }}
        >
          {tab.label}
        </Button>
      {/each}
    </nav>
  </DialogContent>
</Dialog>
