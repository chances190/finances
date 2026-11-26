<script lang="ts">
import LabIcon from './LabIcon.svelte'
import type { IconName, IconPack } from './types'

interface Props {
  selected: IconPack
}

let { selected }: Props = $props()

const packs: { value: IconPack; label: string; note: string }[] = [
  { value: 'phosphor', label: 'Phosphor', note: 'current · friendly, rounded' },
  { value: 'tabler', label: 'Tabler', note: 'crisp, technical, 1.5px' },
  { value: 'hugeicons', label: 'Hugeicons', note: 'characterful, rounded' },
]

const names: { name: IconName; label: string }[] = [
  { name: 'transactions', label: 'Ledger' },
  { name: 'budgets', label: 'Budget' },
  { name: 'debts', label: 'Debts' },
  { name: 'dashboard', label: 'Panel' },
  { name: 'trends', label: 'Trends' },
  { name: 'actions', label: 'Actions' },
  { name: 'plus', label: 'Add' },
  { name: 'search', label: 'Search' },
  { name: 'filter', label: 'Filter' },
  { name: 'settings', label: 'Settings' },
  { name: 'sun', label: 'Light' },
  { name: 'moon', label: 'Dark' },
]
</script>

<div class="panel lab-icon-gallery">
  <div class="mb-3">
    <span class="lab-eyebrow">Icon sets</span>
    <p class="text-xs text-muted-foreground">
      Same meanings, three drawing styles. Selected: {selected}.
    </p>
  </div>
  <div class="grid gap-3 lg:grid-cols-3">
    {#each packs as pack (pack.value)}
      <div class="lab-icon-pack {selected === pack.value ? 'is-active' : ''}">
        <div class="mb-2 flex items-baseline justify-between gap-2">
          <strong class="text-sm">{pack.label}</strong>
          <span class="text-[10px] text-muted-foreground">{pack.note}</span>
        </div>
        <div class="lab-icon-grid">
          {#each names as item (item.name)}
            <div class="lab-icon-cell">
              <LabIcon pack={pack.value} name={item.name} className="size-4" />
              <span>{item.label}</span>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
