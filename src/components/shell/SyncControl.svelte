<script lang="ts">
import ArrowsClockwiseIcon from 'phosphor-svelte/lib/ArrowsClockwiseIcon'
import CloudArrowUpIcon from 'phosphor-svelte/lib/CloudArrowUpIcon'
import CloudCheckIcon from 'phosphor-svelte/lib/CloudCheckIcon'
import CloudSlashIcon from 'phosphor-svelte/lib/CloudSlashIcon'
import WarningIcon from 'phosphor-svelte/lib/WarningIcon'
import { onMount } from 'svelte'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { preloadGoogleIdentity } from '@/data/sync/googleIdentity'
import { startSync, sync } from '@/lib/stores/sync.svelte'

const STATUS_LABEL: Record<string, string> = {
  disconnected: 'Not connected',
  'needs-reconnect': 'Reconnect required',
  idle: 'Up to date',
  syncing: 'Syncing…',
  error: 'Sync error',
  conflict: 'Needs review',
}

const stopSync = startSync()
onMount(() => {
  preloadGoogleIdentity()
  return stopSync
})

let open = $state(false)
const connected = $derived(sync.meta.fileId !== null)
const busy = $derived(sync.status === 'syncing')

function formatLastSynced(timestamp: number | null): string {
  if (!timestamp) return 'Never'
  return new Date(timestamp).toLocaleString()
}
</script>

{#snippet statusIcon(value: string)}
  {#if value === 'syncing'}
    <ArrowsClockwiseIcon class="animate-spin" />
  {:else if value === 'idle'}
    <CloudCheckIcon />
  {:else if value === 'error' || value === 'conflict'}
    <WarningIcon />
  {:else}
    <CloudSlashIcon />
  {/if}
{/snippet}

<Button
  variant="ghost"
  size="icon-lg"
  class="size-8 {sync.status === 'needs-reconnect' ? 'text-muted-foreground' : ''}"
  aria-label={`Backup and sync: ${STATUS_LABEL[sync.status] ?? sync.status}`}
  onclick={() => {
    open = true
  }}
>
  {@render statusIcon(sync.status)}
</Button>

<Dialog bind:open>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Sync</DialogTitle>
      <DialogDescription>Backup and sync your transactions through Google Drive.</DialogDescription>
    </DialogHeader>

    <div class="panel grid gap-2 p-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-muted-foreground">Status</span>
        <span class="flex items-center gap-1 font-medium">
          {@render statusIcon(sync.status)}
          {STATUS_LABEL[sync.status] ?? sync.status}
        </span>
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-muted-foreground">Last synced</span>
        <span>{formatLastSynced(sync.meta.lastSyncedAt)}</span>
      </div>
      {#if sync.status === 'needs-reconnect'}
        <p class="text-muted-foreground">
          Google sign-in expired. Reconnect to resume syncing — your local data is safe.
        </p>
      {:else if sync.error}
        <p class="text-destructive">{sync.error}</p>
      {/if}
      {#if !sync.configured}
        <p class="text-muted-foreground">
          Set `VITE_GOOGLE_CLIENT_ID` on the client and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
          on the Pages Function to enable sync.
        </p>
      {/if}
    </div>

    <DialogFooter>
      {#if connected}
        <Button variant="outline" onclick={sync.disconnect}>Disconnect</Button>
        <Button onclick={() => void sync.syncNow()} disabled={busy || !sync.configured}>
          {busy ? 'Syncing…' : sync.status === 'needs-reconnect' ? 'Reconnect' : 'Sync now'}
        </Button>
      {:else}
        <Button onclick={() => void sync.connect()} disabled={busy || !sync.configured}>
          <CloudArrowUpIcon data-icon="inline-start" />
          {busy ? 'Connecting…' : 'Connect Google Drive'}
        </Button>
      {/if}
    </DialogFooter>
  </DialogContent>
</Dialog>

{#if sync.conflict}
  <Dialog
    open
    onOpenChange={(next) => {
      if (!next) sync.dismissConflict()
    }}
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Backup changed</DialogTitle>
        <DialogDescription>
          <span class="block">
            The remote backup is newer than the last sync on this device, and you have local changes
            that have not been uploaded.
          </span>
          <span class="mt-2 block">
            Pull replaces this device's data with the remote backup. Push keeps this device's data
            and replaces the remote backup.
          </span>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button variant="outline" onclick={() => void sync.resolveConflict('push')} disabled={busy}>
          Push to Remote
        </Button>
        <Button onclick={() => void sync.resolveConflict('pull')} disabled={busy}>
          Pull from Remote
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
