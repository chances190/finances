<script lang="ts">
import ArrowClockwiseIcon from 'phosphor-svelte/lib/ArrowClockwiseIcon'
import ArrowCounterClockwiseIcon from 'phosphor-svelte/lib/ArrowCounterClockwiseIcon'
import ClockIcon from 'phosphor-svelte/lib/ClockIcon'
import TrashIcon from 'phosphor-svelte/lib/TrashIcon'
import ConfirmDialog from '@/components/common/ConfirmDialog.svelte'
import ExportImport from '@/components/common/ExportImport.svelte'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { finance } from '@/lib/stores/finance.svelte'
import { type ThemePreference, theme } from '@/lib/stores/theme.svelte'

const financeState = $derived(finance.state)
let showImport = $state(false)
let showClearConfirm = $state(false)
</script>

<div>
  <div class="mb-2 flex items-center justify-between">
    <h2 class="flex items-center gap-1 text-lg font-semibold text-foreground">
      <ClockIcon /> Actions
    </h2>
    <div class="flex gap-2">
      <Button
        variant="ghost"
        size="xs"
        onclick={() => finance.dispatch({ type: 'REDO' })}
        disabled={financeState.redoStack.length === 0}
        aria-label="Redo"
      >
        <ArrowClockwiseIcon /> Redo
      </Button>
      {#if financeState.auditLog.length > 0}
        <Button
          variant="ghost"
          size="xs"
          onclick={() => {
            showClearConfirm = true
          }}
          aria-label="Clear history"
        >
          <TrashIcon /> Clear
        </Button>
      {/if}
    </div>
  </div>

  <p class="mb-2 text-[10px] text-muted-foreground">Tip: Ctrl+Z to undo, Ctrl+Shift+Z to redo</p>

  {#if financeState.auditLog.length === 0}
    <p class="py-4 text-center text-xs text-muted-foreground">
      No actions recorded yet. Actions are recorded when you add, edit, or delete transactions and
      budgets.
    </p>
  {:else}
    <div class="max-h-48 space-y-1 overflow-y-auto">
      {#each financeState.auditLog as entry (entry.id)}
        <div
          class="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted"
        >
          <div class="min-w-0 flex-1">
            <span class="block truncate">{entry.description}</span>
            <span class="text-[10px] text-muted-foreground">
              {new Date(entry.timestamp).toLocaleString()}
            </span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onclick={() => finance.dispatch({ type: 'UNDO', payload: entry.id })}
            aria-label="Undo this action"
          >
            <ArrowCounterClockwiseIcon /> Undo
          </Button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="mt-6 space-y-3 border-t pt-4">
    <h3 class="text-sm font-semibold text-foreground">Appearance</h3>
    <div class="flex flex-wrap items-center gap-3">
      <SegmentedControl
        aria-label="Theme"
        value={theme.preference}
        onValueChange={(value) => theme.setPreference(value as ThemePreference)}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
      <p class="text-xs text-muted-foreground">System follows your device’s appearance.</p>
    </div>
  </div>

  <div class="mt-6 space-y-3 border-t pt-4">
    <h3 class="text-sm font-semibold text-foreground">Data</h3>
    <div>
      <p class="mb-1 text-xs text-muted-foreground">Export</p>
      <ExportImport />
    </div>
    <div>
      <p class="mb-1 text-xs text-muted-foreground">Import</p>
      <Button
        variant="outline"
        size="xs"
        onclick={() => {
          showImport = true
        }}
      >
        Import Backup (.json)
      </Button>
    </div>
    {#if showImport}
      {#await import('@/components/common/ImportDialog.svelte') then module}
        {@const ImportDialog = module.default}
        <ImportDialog
          open
          onOpenChange={(value) => {
            showImport = value
          }}
          mode="backup"
        />
      {/await}
    {/if}
  </div>

  {#if showClearConfirm}
    <ConfirmDialog
      open
      title="Clear action history?"
      message="This removes the history used to undo past actions. It does not change transactions or budgets."
      confirmLabel="Clear history"
      onConfirm={() => finance.dispatch({ type: 'CLEAR_AUDIT' })}
      onOpenChange={(open) => {
        if (!open) showClearConfirm = false
      }}
    />
  {/if}
</div>
