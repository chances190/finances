<script lang="ts">
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/svelte'
import { dismissToast, toastState } from '@/lib/stores/toast.svelte'
</script>

<div
  aria-live="polite"
  class="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-2"
>
  {#each toastState.list as toast (toast.id)}
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      class="floating-surface flex items-center gap-1 py-1 pr-1 pl-2 text-xs text-foreground"
    >
      {#if toast.action}
        <button
          type="button"
          class="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[3px] px-1 text-left hover:bg-muted/50"
          aria-label={`${toast.action.label}: ${toast.message}`}
          onclick={() => {
            toast.action?.run()
            dismissToast(toast.id)
          }}
        >
          <span class="min-w-0 flex-1">{toast.message}</span>
          <span class="shrink-0 text-[10px] font-semibold tracking-wide text-brand uppercase">
            {toast.action.label}
          </span>
        </button>
      {:else}
        <span class="min-w-0 flex-1 px-1">{toast.message}</span>
      {/if}
      <button
        type="button"
        onclick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
        class="flex size-10 shrink-0 items-center justify-center opacity-70 hover:opacity-100"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={12} class="size-3" />
      </button>
    </div>
  {/each}
</div>
