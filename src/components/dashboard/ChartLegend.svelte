<script lang="ts">
interface Item {
  label: string
  color: string
  dashed?: boolean
}

interface Props {
  items: Item[]
  class?: string
}

let { items, class: className = '' }: Props = $props()
</script>

<div
  class={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground ${className}`}
>
  {#each items as item (item.label)}
    <span class="inline-flex items-center gap-1.5">
      {#if item.dashed}
        <span
          class="inline-block w-3 border-t-2 border-dashed"
          style="border-color: {item.color}"
        ></span>
      {:else}
        <span class="inline-block size-2 rounded-[2px]" style="background: {item.color}"></span>
      {/if}
      {item.label}
    </span>
  {/each}
</div>
