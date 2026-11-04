export interface SyncMeta {
  fileId: string | null
  version: string | null
  etag: string | null
  lastSyncedAt: number | null
}

export interface DriveFileMeta {
  id: string
  version: string
  etag: string | null
}

export type SyncStatus =
  | 'disconnected'
  | 'needs-reconnect'
  | 'idle'
  | 'syncing'
  | 'error'
  | 'conflict'

export interface SyncConflict {
  remote: DriveFileMeta
}

export const emptySyncMeta: SyncMeta = {
  fileId: null,
  version: null,
  etag: null,
  lastSyncedAt: null,
}
