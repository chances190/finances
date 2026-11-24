<script lang="ts">
import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Props {
  idPrefix: string
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  count: number
  onToggle: (option: string, on: boolean) => void
  wide: boolean
}

let { idPrefix, label, options, selected, count, onToggle, wide }: Props = $props()
</script>

{#snippet list()}
  <div class="space-y-1">
    {#each options as option (option.value)}
      <label
        for={`${idPrefix}-${option.value}`}
        class="flex min-h-10 cursor-pointer items-center gap-2 py-1"
      >
        <Checkbox
          id={`${idPrefix}-${option.value}`}
          checked={selected.includes(option.value)}
          onCheckedChange={(checked) => onToggle(option.value, checked === true)}
        />
        <span class="text-xs">{option.label}</span>
      </label>
    {/each}
  </div>
{/snippet}

{#if wide}
  <div>
    <p class="mb-1 text-xs text-muted-foreground">
      {label}{count > 0 ? ` (${count})` : ''}
    </p>
    {@render list()}
  </div>
{:else}
  <Popover>
    <PopoverTrigger>
      {#snippet child({ props })}
        <Button variant="outline" size="sm" {...props}>
          <FunnelIcon class="size-3" />
          {label}{count > 0 ? ` (${count})` : ''}
        </Button>
      {/snippet}
    </PopoverTrigger>
    <PopoverContent class="w-48 p-2"> {@render list()} </PopoverContent>
  </Popover>
{/if}
