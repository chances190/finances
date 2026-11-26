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
  <div class="w-full space-y-1.5">
    <p class="text-xs text-muted-foreground">
      {label}{count > 0 ? ` (${count})` : ''}
    </p>
    <div class="flex flex-wrap gap-1.5">
      {#each options as option (option.value)}
        {@const selectedOption = selected.includes(option.value)}
        <button
          type="button"
          aria-pressed={selectedOption}
          onclick={() => onToggle(option.value, !selectedOption)}
          class={selectedOption
            ? 'rounded-md border border-primary bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground'
            : 'rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground'}
        >
          {option.label}
        </button>
      {/each}
    </div>
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
