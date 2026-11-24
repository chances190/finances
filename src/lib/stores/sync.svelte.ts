import { untrack } from 'svelte'
import { normalizeFinanceData } from '@/data/migration'
import {
  classifyPreconditionFailure,
  compareVersions,
  decideSyncAction,
  isOwnPendingUpload,
  shouldClearDirty,
} from '@/data/sync/decision'
import {
  createSnapshot,
  DriveAuthError,
  DriveConflictError,
  downloadSnapshot,
  findSnapshot,
  getSnapshotMeta,
  updateSnapshot,
} from '@/data/sync/drive'
import {
  clearAccessToken,
  GoogleAuthError,
  getAccessToken,
  isGoogleConfigured,
} from '@/data/sync/googleIdentity'
import { loadDirty, loadSyncMeta, saveDirty, saveSyncMeta } from '@/data/sync/meta'
import type { DriveFileMeta, SyncConflict, SyncMeta, SyncStatus } from '@/data/sync/types'
import type { Budget, FinanceData } from '@/domain/entities'
import type { Movement } from '@/domain/ledger'
import { finance } from './finance.svelte'

const SYNC_DEBOUNCE_MS = 30000

const initialMeta = loadSyncMeta()
let meta = $state<SyncMeta>(initialMeta)
let status = $state<SyncStatus>(initialMeta.fileId ? 'idle' : 'disconnected')
let conflict = $state<SyncConflict | null>(null)
let error = $state<string | null>(null)

let dirty = loadDirty()
let changeSeq = 0
let syncing = false
let retry = false
let debounce: number | null = null
let remoteArrays: { movements: Movement[]; budgets: Budget[] } | null = null
let initialArrays: { movements: Movement[]; budgets: Budget[] } | null = null
let started = false

function isEmpty(data: FinanceData): boolean {
  return data.movements.length === 0 && data.budgets.length === 0
}

function serializeWhenIdle(data: FinanceData): Promise<string> {
  return new Promise((resolve) => {
    const work = () => resolve(JSON.stringify(data))
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(work)
    } else {
      window.setTimeout(work, 0)
    }
  })
}

async function hashSnapshot(text: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function syncMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message
  return 'Sync failed'
}

function updateMeta(next: SyncMeta) {
  meta = next
  saveSyncMeta(next)
}

function updateDirty(next: boolean) {
  if (dirty === next) return
  dirty = next
  saveDirty(next)
}

function setConflictState(next: SyncConflict | null) {
  conflict = next
}

function fail(cause: unknown) {
  status =
    cause instanceof GoogleAuthError || cause instanceof DriveAuthError
      ? 'needs-reconnect'
      : 'error'
  error = syncMessage(cause)
}

function currentData(): FinanceData {
  return {
    movements: finance.state.movements,
    budgets: finance.state.budgets,
  }
}

function applyRemote(data: FinanceData, file: DriveFileMeta, hash: string | null) {
  remoteArrays = { movements: data.movements, budgets: data.budgets }
  finance.dispatch({ type: 'APPLY_REMOTE', payload: data })
  updateMeta({
    fileId: file.id,
    version: file.version,
    etag: file.etag,
    lastSyncedAt: Date.now(),
    lastSyncedHash: hash,
  })
  updateDirty(false)
}

async function downloadAndApply(token: string, file: DriveFileMeta) {
  const text = await downloadSnapshot(token, file.id)
  const result = normalizeFinanceData(JSON.parse(text))
  if (result.skippedMovements.length > 0 || result.skippedBudgets > 0) {
    throw new Error('Remote snapshot contains invalid records; local data was kept')
  }
  const hash = file.sha256Checksum ?? (await hashSnapshot(text))
  applyRemote(result.data, file, hash)
}

async function upload(
  token: string,
  data: FinanceData,
  file: DriveFileMeta | null,
  ifMatch: string | null,
) {
  const snapshotSeq = changeSeq
  const serialized = await serializeWhenIdle(data)
  const hash = await hashSnapshot(serialized)
  const saved = file
    ? await updateSnapshot(token, file, serialized, ifMatch)
    : await createSnapshot(token, serialized)
  const confirmed = await getSnapshotMeta(token, saved.id).catch(() => saved)
  const useConfirmed = compareVersions(confirmed.version, saved.version) === 0
  updateMeta({
    fileId: saved.id,
    version: useConfirmed ? confirmed.version : saved.version,
    etag: useConfirmed ? confirmed.etag : saved.etag,
    lastSyncedAt: Date.now(),
    lastSyncedHash: hash,
  })
  if (shouldClearDirty(snapshotSeq, changeSeq)) {
    updateDirty(false)
  } else {
    retry = true
  }
  return saved
}

async function attemptSync({ interactive }: { interactive: boolean }) {
  if (!finance.state.loaded) return
  if (!meta.fileId || syncing || conflict) return
  if (!navigator.onLine) return
  syncing = true
  status = 'syncing'
  error = null
  let token = ''
  try {
    token = await getAccessToken(interactive)
    const remote = await findSnapshot(token, meta.fileId)
    let syncedMeta = meta
    if (
      remote &&
      isOwnPendingUpload(
        remote.version,
        syncedMeta.version,
        remote.sha256Checksum,
        syncedMeta.lastSyncedHash,
      )
    ) {
      updateMeta({
        ...syncedMeta,
        version: remote.version,
        etag: remote.etag,
        lastSyncedAt: Date.now(),
      })
      syncedMeta = meta
    }
    const action = decideSyncAction({
      hasRemote: remote !== null,
      localEmpty: isEmpty(currentData()) && !dirty,
      dirty,
      remoteVersion: remote?.version ?? null,
      lastSyncedVersion: syncedMeta.version,
    })

    switch (action) {
      case 'create':
        await upload(token, currentData(), null, null)
        status = 'idle'
        break
      case 'download':
        if (remote) await downloadAndApply(token, remote)
        status = 'idle'
        break
      case 'upload':
        if (remote) await upload(token, currentData(), remote, syncedMeta.etag ?? remote.etag)
        status = 'idle'
        break
      case 'conflict':
        if (remote) {
          setConflictState({ remote })
          status = 'conflict'
        }
        break
      case 'noop':
        status = 'idle'
        break
    }
  } catch (cause) {
    if (cause instanceof DriveConflictError && token) {
      const latest = await findSnapshot(token, meta.fileId).catch(() => null)
      if (!latest) {
        fail(cause)
      } else if (classifyPreconditionFailure(latest.version, meta.version) === 'retry') {
        try {
          await upload(token, currentData(), latest, null)
          status = 'idle'
        } catch (retryCause) {
          fail(retryCause)
        }
      } else {
        setConflictState({ remote: latest })
        status = 'conflict'
      }
    } else {
      fail(cause)
    }
  } finally {
    syncing = false
    if (retry) {
      retry = false
      window.setTimeout(() => {
        void attemptSync({ interactive: false })
      }, 2000)
    }
  }
}

function scheduleSync() {
  if (!meta.fileId) return
  if (debounce !== null) window.clearTimeout(debounce)
  debounce = window.setTimeout(() => {
    debounce = null
    void attemptSync({ interactive: false })
  }, SYNC_DEBOUNCE_MS)
}

async function connect() {
  if (!isGoogleConfigured()) {
    status = 'error'
    error = 'Google Drive sync is not configured. Set VITE_GOOGLE_CLIENT_ID.'
    return
  }
  if (syncing) return
  syncing = true
  status = 'syncing'
  error = null
  let token = ''
  try {
    token = await getAccessToken(true)
    const remote = await findSnapshot(token, meta.fileId)
    const local = currentData()

    if (!remote) {
      await upload(token, local, null, null)
      status = 'idle'
      return
    }
    if (isEmpty(local) && !dirty) {
      await downloadAndApply(token, remote)
      status = 'idle'
      return
    }
    setConflictState({ remote })
    status = 'conflict'
  } catch (cause) {
    fail(cause)
  } finally {
    syncing = false
    if (retry) {
      retry = false
      window.setTimeout(() => {
        void attemptSync({ interactive: false })
      }, 2000)
    }
  }
}

function disconnect() {
  if (debounce !== null) {
    window.clearTimeout(debounce)
    debounce = null
  }
  clearAccessToken()
  retry = false
  updateMeta({
    fileId: null,
    version: null,
    etag: null,
    lastSyncedAt: null,
    lastSyncedHash: null,
  })
  updateDirty(false)
  setConflictState(null)
  status = 'disconnected'
  error = null
}

async function syncNow() {
  if (!meta.fileId) {
    await connect()
    return
  }
  await attemptSync({ interactive: true })
}

async function resolveConflict(choice: 'pull' | 'push') {
  const current = conflict
  if (!current || syncing) return
  syncing = true
  status = 'syncing'
  error = null
  let token = ''
  try {
    token = await getAccessToken(true)
    const latest = (await findSnapshot(token, current.remote.id)) ?? current.remote
    if (choice === 'pull') {
      await downloadAndApply(token, latest)
    } else {
      await upload(token, currentData(), latest, null)
    }
    setConflictState(null)
    status = 'idle'
  } catch (cause) {
    if (cause instanceof DriveConflictError && token) {
      const latest = await findSnapshot(token, current.remote.id).catch(() => null)
      if (latest) {
        setConflictState({ remote: latest })
        status = 'conflict'
      } else {
        fail(cause)
      }
    } else {
      fail(cause)
    }
  } finally {
    syncing = false
    if (retry) {
      retry = false
      window.setTimeout(() => {
        void attemptSync({ interactive: false })
      }, 2000)
    }
  }
}

function dismissConflict() {
  setConflictState(null)
  status = meta.fileId ? 'idle' : 'disconnected'
}

function handleOnline() {
  void attemptSync({ interactive: false })
}

function handleVisibility() {
  if (document.visibilityState === 'visible') {
    void attemptSync({ interactive: false })
  }
}

export function startSync(): () => void {
  if (started) return () => {}
  started = true
  window.addEventListener('online', handleOnline)
  document.addEventListener('visibilitychange', handleVisibility)

  const dispose = $effect.root(() => {
    $effect(() => {
      if (!finance.state.loaded) return
      untrack(() => {
        if (meta.fileId) void attemptSync({ interactive: false })
      })
    })

    $effect(() => {
      const loaded = finance.state.loaded
      const movements = finance.state.movements
      const budgets = finance.state.budgets
      if (!loaded) return
      const previous = initialArrays
      initialArrays = { movements, budgets }
      if (!previous) return
      if (previous.movements === movements && previous.budgets === budgets) return
      if (remoteArrays) {
        const applied = remoteArrays
        remoteArrays = null
        if (applied.movements === movements && applied.budgets === budgets) return
      }
      changeSeq += 1
      if (!dirty) updateDirty(true)
      untrack(() => scheduleSync())
    })
  })

  return () => {
    dispose()
    window.removeEventListener('online', handleOnline)
    document.removeEventListener('visibilitychange', handleVisibility)
    if (debounce !== null) window.clearTimeout(debounce)
  }
}

export const sync = {
  get configured() {
    return isGoogleConfigured()
  },
  get status() {
    return status
  },
  get meta() {
    return meta
  },
  get conflict() {
    return conflict
  },
  get error() {
    return error
  },
  connect,
  disconnect,
  syncNow,
  resolveConflict,
  dismissConflict,
}
