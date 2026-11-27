<script lang="ts">
import { HugeiconsIcon } from '@hugeicons/svelte'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  CATEGORY_ICON_OPTIONS,
  type CategoryIconName,
  resolveCategoryIcon,
  resolveCategoryIconName,
} from '@/lib/category-icons'

interface Props {
  category: string
  value?: string
  onSelect: (name: CategoryIconName) => void
}

let { category, value, onSelect }: Props = $props()

let open = $state(false)
const selected = $derived(resolveCategoryIconName(category, value))
</script>

<Popover bind:open>
  <PopoverTrigger
    class="grid size-7 shrink-0 place-items-center rounded-[4px] border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
    aria-label={`Choose icon for ${category}`}
  >
    <HugeiconsIcon icon={resolveCategoryIcon(category, value)} size={14} />
  </PopoverTrigger>
  <PopoverContent class="w-56 p-2" align="start">
    <div class="grid grid-cols-6 gap-1">
      {#each CATEGORY_ICON_OPTIONS as option (option.name)}
        <button
          type="button"
          class="grid aspect-square place-items-center rounded-[4px] {selected === option.name
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          aria-label={option.name}
          aria-pressed={selected === option.name}
          onclick={() => {
            onSelect(option.name)
            open = false
          }}
        >
          <HugeiconsIcon icon={option.icon} size={16} />
        </button>
      {/each}
    </div>
  </PopoverContent>
</Popover>
