<script lang="ts">
import { Button } from '@/components/ui/button'

interface Props {
  message: string
  variant?: 'block' | 'cell'
  action?: { label: string; onClick: () => void }
}

let { message, variant = 'block', action }: Props = $props()
</script>

{#if variant === 'cell' && !action}
  <div class="py-8 text-center text-muted-foreground">{message}</div>
{:else if variant === 'cell'}
  <div class="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
    <p>{message}</p>
    {#if action}
      <Button variant="outline" size="sm" onclick={action.onClick}>{action.label}</Button>
    {/if}
  </div>
{:else if !action}
  <div class="flex h-64 items-center justify-center text-sm text-muted-foreground">{message}</div>
{:else}
  <div
    class="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
  >
    <p>{message}</p>
    {#if action}
      <Button variant="outline" size="sm" onclick={action.onClick}>{action.label}</Button>
    {/if}
  </div>
{/if}
