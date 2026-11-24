<script lang="ts">
import XIcon from 'phosphor-svelte/lib/XIcon'
import { dismissToast, toastState } from '@/lib/stores/toast.svelte'
</script>

<div
  aria-live="polite"
  class="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-2"
>
  {#each toastState.list as toast (toast.id)}
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      class="flex items-center gap-2 border border-border bg-popover px-3 py-2 text-xs text-foreground shadow-lg"
    >
      <span class="flex-1">{toast.message}</span>
      <button
        type="button"
        onclick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
        class="-my-2 -mr-2 flex size-10 shrink-0 items-center justify-center opacity-70 hover:opacity-100 sm:-my-1 sm:-mr-1 sm:size-6"
      >
        <XIcon class="size-3" />
      </button>
    </div>
  {/each}
</div>
