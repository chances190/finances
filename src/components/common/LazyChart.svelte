<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  class?: string
  children: Snippet
}

let { class: className, children }: Props = $props()

let node = $state<HTMLDivElement | null>(null)
let visible = $state(false)

$effect(() => {
  if (!node) return
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return
      visible = true
      observer.disconnect()
    },
    { rootMargin: '200px' },
  )
  observer.observe(node)
  return () => observer.disconnect()
})
</script>

<div bind:this={node} class={className}>
  {#if visible}
    {@render children()}
  {/if}
</div>
