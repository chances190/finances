import {
  ArrowsClockwiseIcon,
  CloudArrowUpIcon,
  CloudCheckIcon,
  CloudSlashIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
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
import { useSync } from '@/ui/context'

const STATUS_LABEL: Record<string, string> = {
  disconnected: 'Not connected',
  'needs-reconnect': 'Reconnect required',
  idle: 'Up to date',
  syncing: 'Syncing…',
  error: 'Sync error',
  conflict: 'Needs review',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'syncing') {
    return <ArrowsClockwiseIcon className="animate-spin" />
  }
  if (status === 'idle') {
    return <CloudCheckIcon />
  }
  if (status === 'error' || status === 'conflict') {
    return <WarningIcon />
  }
  return <CloudSlashIcon />
}

function formatLastSynced(timestamp: number | null): string {
  if (!timestamp) return 'Never'
  return new Date(timestamp).toLocaleString()
}

export default function SyncControl() {
  const {
    configured,
    status,
    meta,
    conflict,
    error,
    connect,
    disconnect,
    syncNow,
    resolveConflict,
    dismissConflict,
  } = useSync()
  const [open, setOpen] = useState(false)
  const connected = meta.fileId !== null

  useEffect(() => {
    preloadGoogleIdentity()
  }, [])

  const busy = status === 'syncing'

  return (
    <>
      <Button
        variant="ghost"
        size="icon-lg"
        className={`size-10 ${status === 'needs-reconnect' ? 'text-muted-foreground' : ''}`}
        aria-label={`Backup and sync: ${STATUS_LABEL[status] ?? status}`}
        onClick={() => setOpen(true)}
      >
        <StatusIcon status={status} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync</DialogTitle>
            <DialogDescription>
              Backup and sync your transactions trough Google Drive.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <span className="flex items-center gap-1 font-medium">
                <StatusIcon status={status} />
                {STATUS_LABEL[status] ?? status}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Last synced</span>
              <span>{formatLastSynced(meta.lastSyncedAt)}</span>
            </div>
            {status === 'needs-reconnect' ? (
              <p className="text-muted-foreground">
                Google sign-in expired. Reconnect to resume syncing — your local data is safe.
              </p>
            ) : (
              error && <p className="text-destructive">{error}</p>
            )}
            {!configured && (
              <p className="text-muted-foreground">
                Set `VITE_GOOGLE_CLIENT_ID` on the client and `GOOGLE_CLIENT_ID` /
                `GOOGLE_CLIENT_SECRET` on the Pages Function to enable sync.
              </p>
            )}
          </div>

          <DialogFooter>
            {connected ? (
              <>
                <Button variant="outline" onClick={disconnect}>
                  Disconnect
                </Button>
                <Button onClick={() => void syncNow()} disabled={busy || !configured}>
                  {busy ? 'Syncing…' : status === 'needs-reconnect' ? 'Reconnect' : 'Sync now'}
                </Button>
              </>
            ) : (
              <Button onClick={() => void connect()} disabled={busy || !configured}>
                <CloudArrowUpIcon data-icon="inline-start" />
                {busy ? 'Connecting…' : 'Connect Google Drive'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={conflict !== null}
        onOpenChange={(next) => {
          if (!next) dismissConflict()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backup changed</DialogTitle>
            <DialogDescription>
              <p>
                The remote backup is newer than the last sync on this device, and you have local
                changes that have not been uploaded.
              </p>
              <p className="mt-2">
                Pull replaces this device's data with the remote backup. Push keeps this device's
                data and replaces the remote backup.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => void resolveConflict('push')} disabled={busy}>
              Push to Remote
            </Button>
            <Button onClick={() => void resolveConflict('pull')} disabled={busy}>
              Pull from Remote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
