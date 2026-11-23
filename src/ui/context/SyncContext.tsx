import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { normalizeFinanceData } from '../../data/migration'
import {
  classifyPreconditionFailure,
  compareVersions,
  decideSyncAction,
  isOwnPendingUpload,
  shouldClearDirty,
} from '../../data/sync/decision'
import {
  createSnapshot,
  DriveAuthError,
  DriveConflictError,
  downloadSnapshot,
  findSnapshot,
  getSnapshotMeta,
  updateSnapshot,
} from '../../data/sync/drive'
import {
  clearAccessToken,
  GoogleAuthError,
  getAccessToken,
  isGoogleConfigured,
} from '../../data/sync/googleIdentity'
import { loadDirty, loadSyncMeta, saveDirty, saveSyncMeta } from '../../data/sync/meta'
import type { DriveFileMeta, SyncConflict, SyncMeta, SyncStatus } from '../../data/sync/types'
import type { Budget, FinanceData } from '../../domain/entities'
import type { Movement } from '../../domain/ledger'
import { useFinance } from './FinanceContext'

export interface SyncContextValue {
  configured: boolean
  status: SyncStatus
  meta: SyncMeta
  conflict: SyncConflict | null
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  syncNow: () => Promise<void>
  resolveConflict: (choice: 'pull' | 'push') => Promise<void>
  dismissConflict: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)
const SYNC_DEBOUNCE_MS = 30000

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

function syncMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Sync failed'
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useFinance()
  const [meta, setMeta] = useState<SyncMeta>(() => loadSyncMeta())
  const [status, setStatus] = useState<SyncStatus>(meta.fileId ? 'idle' : 'disconnected')
  const [conflict, setConflict] = useState<SyncConflict | null>(null)
  const [error, setError] = useState<string | null>(null)

  const metaRef = useRef(meta)
  const dirtyRef = useRef(loadDirty())
  const changeSeqRef = useRef(0)
  const financeRef = useRef(state)
  const conflictRef = useRef<SyncConflict | null>(null)
  const syncingRef = useRef(false)
  const retryRef = useRef(false)
  const attemptSyncRef = useRef<(options: { interactive: boolean }) => Promise<void>>(
    async () => {},
  )
  const debounceRef = useRef<number | null>(null)
  const remoteArraysRef = useRef<{
    movements: Movement[]
    budgets: Budget[]
  } | null>(null)

  useEffect(() => {
    financeRef.current = state
  }, [state])

  const updateMeta = useCallback((next: SyncMeta) => {
    metaRef.current = next
    saveSyncMeta(next)
    setMeta(next)
  }, [])

  const updateDirty = useCallback((dirty: boolean) => {
    if (dirtyRef.current === dirty) return
    dirtyRef.current = dirty
    saveDirty(dirty)
  }, [])

  const setConflictState = useCallback((next: SyncConflict | null) => {
    conflictRef.current = next
    setConflict(next)
  }, [])

  const fail = useCallback((cause: unknown) => {
    if (cause instanceof GoogleAuthError || cause instanceof DriveAuthError) {
      setStatus('needs-reconnect')
    } else {
      setStatus('error')
    }
    setError(syncMessage(cause))
  }, [])

  const currentData = useCallback(
    (): FinanceData => ({
      movements: financeRef.current.movements,
      budgets: financeRef.current.budgets,
    }),
    [],
  )

  const applyRemote = useCallback(
    (data: FinanceData, file: DriveFileMeta, hash: string | null) => {
      remoteArraysRef.current = {
        movements: data.movements,
        budgets: data.budgets,
      }
      dispatch({ type: 'APPLY_REMOTE', payload: data })
      updateMeta({
        fileId: file.id,
        version: file.version,
        etag: file.etag,
        lastSyncedAt: Date.now(),
        lastSyncedHash: hash,
      })
      updateDirty(false)
    },
    [dispatch, updateMeta, updateDirty],
  )

  const downloadAndApply = useCallback(
    async (token: string, file: DriveFileMeta) => {
      const text = await downloadSnapshot(token, file.id)
      const result = normalizeFinanceData(JSON.parse(text))
      if (result.skippedMovements.length > 0 || result.skippedBudgets > 0) {
        throw new Error('Remote snapshot contains invalid records; local data was kept')
      }
      const hash = file.sha256Checksum ?? (await hashSnapshot(text))
      applyRemote(result.data, file, hash)
    },
    [applyRemote],
  )

  const upload = useCallback(
    async (
      token: string,
      data: FinanceData,
      file: DriveFileMeta | null,
      ifMatch: string | null,
    ) => {
      const snapshotSeq = changeSeqRef.current
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
      if (shouldClearDirty(snapshotSeq, changeSeqRef.current)) {
        updateDirty(false)
      } else {
        retryRef.current = true
      }
      return saved
    },
    [updateMeta, updateDirty],
  )

  const attemptSync = useCallback(
    async ({ interactive }: { interactive: boolean }) => {
      const currentMeta = metaRef.current
      if (!financeRef.current.loaded) return
      if (!currentMeta.fileId || syncingRef.current || conflictRef.current) return
      if (!navigator.onLine) return
      syncingRef.current = true
      setStatus('syncing')
      setError(null)
      let token = ''
      try {
        token = await getAccessToken(interactive)
        const remote = await findSnapshot(token, currentMeta.fileId)
        let syncedMeta = metaRef.current
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
          syncedMeta = metaRef.current
        }
        const action = decideSyncAction({
          hasRemote: remote !== null,
          localEmpty: isEmpty(currentData()) && !dirtyRef.current,
          dirty: dirtyRef.current,
          remoteVersion: remote?.version ?? null,
          lastSyncedVersion: syncedMeta.version,
        })

        switch (action) {
          case 'create':
            await upload(token, currentData(), null, null)
            setStatus('idle')
            break
          case 'download':
            if (remote) await downloadAndApply(token, remote)
            setStatus('idle')
            break
          case 'upload':
            if (remote) await upload(token, currentData(), remote, syncedMeta.etag ?? remote.etag)
            setStatus('idle')
            break
          case 'conflict':
            if (remote) {
              setConflictState({ remote })
              setStatus('conflict')
            }
            break
          case 'noop':
            setStatus('idle')
            break
        }
      } catch (cause) {
        if (cause instanceof DriveConflictError && token) {
          const latest = await findSnapshot(token, metaRef.current.fileId).catch(() => null)
          if (!latest) {
            fail(cause)
          } else if (
            classifyPreconditionFailure(latest.version, metaRef.current.version) === 'retry'
          ) {
            try {
              await upload(token, currentData(), latest, null)
              setStatus('idle')
            } catch (retryCause) {
              fail(retryCause)
            }
          } else {
            setConflictState({ remote: latest })
            setStatus('conflict')
          }
        } else {
          fail(cause)
        }
      } finally {
        syncingRef.current = false
        if (retryRef.current) {
          retryRef.current = false
          window.setTimeout(() => {
            void attemptSyncRef.current({ interactive: false })
          }, 2000)
        }
      }
    },
    [currentData, downloadAndApply, fail, setConflictState, updateMeta, upload],
  )

  useEffect(() => {
    attemptSyncRef.current = attemptSync
  }, [attemptSync])

  const scheduleSync = useCallback(() => {
    if (!metaRef.current.fileId) return
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      void attemptSync({ interactive: false })
    }, SYNC_DEBOUNCE_MS)
  }, [attemptSync])

  const connect = useCallback(async () => {
    if (!isGoogleConfigured()) {
      setStatus('error')
      setError('Google Drive sync is not configured. Set VITE_GOOGLE_CLIENT_ID.')
      return
    }
    if (syncingRef.current) return
    syncingRef.current = true
    setStatus('syncing')
    setError(null)
    let token = ''
    try {
      token = await getAccessToken(true)
      const remote = await findSnapshot(token, metaRef.current.fileId)
      const local = currentData()

      if (!remote) {
        await upload(token, local, null, null)
        setStatus('idle')
        return
      }
      if (isEmpty(local) && !dirtyRef.current) {
        await downloadAndApply(token, remote)
        setStatus('idle')
        return
      }
      setConflictState({ remote })
      setStatus('conflict')
    } catch (cause) {
      fail(cause)
    } finally {
      syncingRef.current = false
      if (retryRef.current) {
        retryRef.current = false
        window.setTimeout(() => {
          void attemptSyncRef.current({ interactive: false })
        }, 2000)
      }
    }
  }, [currentData, downloadAndApply, fail, setConflictState, upload])

  const disconnect = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    clearAccessToken()
    retryRef.current = false
    updateMeta({
      fileId: null,
      version: null,
      etag: null,
      lastSyncedAt: null,
      lastSyncedHash: null,
    })
    updateDirty(false)
    setConflictState(null)
    setStatus('disconnected')
    setError(null)
  }, [setConflictState, updateDirty, updateMeta])

  const syncNow = useCallback(async () => {
    if (!metaRef.current.fileId) {
      await connect()
      return
    }
    await attemptSync({ interactive: true })
  }, [attemptSync, connect])

  const resolveConflict = useCallback(
    async (choice: 'pull' | 'push') => {
      const current = conflictRef.current
      if (!current || syncingRef.current) return
      syncingRef.current = true
      setStatus('syncing')
      setError(null)
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
        setStatus('idle')
      } catch (cause) {
        if (cause instanceof DriveConflictError && token) {
          const latest = await findSnapshot(token, current.remote.id).catch(() => null)
          if (latest) {
            setConflictState({ remote: latest })
            setStatus('conflict')
          } else {
            fail(cause)
          }
        } else {
          fail(cause)
        }
      } finally {
        syncingRef.current = false
        if (retryRef.current) {
          retryRef.current = false
          window.setTimeout(() => {
            void attemptSyncRef.current({ interactive: false })
          }, 2000)
        }
      }
    },
    [currentData, downloadAndApply, fail, setConflictState, upload],
  )

  const dismissConflict = useCallback(() => {
    setConflictState(null)
    setStatus(metaRef.current.fileId ? 'idle' : 'disconnected')
  }, [setConflictState])

  useEffect(() => {
    if (!state.loaded) return
    if (!metaRef.current.fileId) return
    void attemptSync({ interactive: false })
  }, [state.loaded, attemptSync])

  useEffect(() => {
    function handleOnline() {
      void attemptSync({ interactive: false })
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void attemptSync({ interactive: false })
      }
    }
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [attemptSync])

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const initialArraysRef = useRef<{ movements: Movement[]; budgets: Budget[] } | null>(null)

  useEffect(() => {
    if (!state.loaded) return
    const previous = initialArraysRef.current
    initialArraysRef.current = {
      movements: state.movements,
      budgets: state.budgets,
    }
    if (!previous) return
    if (previous.movements === state.movements && previous.budgets === state.budgets) {
      return
    }
    if (remoteArraysRef.current) {
      const applied = remoteArraysRef.current
      remoteArraysRef.current = null
      if (applied.movements === state.movements && applied.budgets === state.budgets) {
        return
      }
    }
    changeSeqRef.current += 1
    if (!dirtyRef.current) {
      dirtyRef.current = true
      saveDirty(true)
    }
    scheduleSync()
  }, [state.loaded, state.movements, state.budgets, scheduleSync])

  const value = useMemo<SyncContextValue>(
    () => ({
      configured: isGoogleConfigured(),
      status,
      meta,
      conflict,
      error,
      connect,
      disconnect,
      syncNow,
      resolveConflict,
      dismissConflict,
    }),
    [status, meta, conflict, error, connect, disconnect, syncNow, resolveConflict, dismissConflict],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
