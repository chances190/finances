import { emptySyncMeta, type SyncMeta } from './types'

const META_KEY = 'finances-sync-meta'
const DIRTY_KEY = 'finances-sync-dirty'

export function loadSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return emptySyncMeta
    const value = JSON.parse(raw) as Record<string, unknown>
    return {
      fileId: typeof value.fileId === 'string' ? value.fileId : null,
      version: typeof value.version === 'string' ? value.version : null,
      etag: typeof value.etag === 'string' ? value.etag : null,
      lastSyncedAt: typeof value.lastSyncedAt === 'number' ? value.lastSyncedAt : null,
    }
  } catch {
    return emptySyncMeta
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function loadDirty(): boolean {
  return localStorage.getItem(DIRTY_KEY) === '1'
}

export function saveDirty(dirty: boolean): void {
  if (dirty) {
    localStorage.setItem(DIRTY_KEY, '1')
  } else {
    localStorage.removeItem(DIRTY_KEY)
  }
}
