export type SyncDecision = 'noop' | 'download' | 'upload' | 'conflict' | 'create'

export interface SyncDecisionInput {
  hasRemote: boolean
  localEmpty: boolean
  dirty: boolean
  remoteVersion: string | null
  lastSyncedVersion: string | null
}

export function compareVersions(a: string, b: string): number {
  try {
    const left = BigInt(a)
    const right = BigInt(b)
    if (left < right) return -1
    if (left > right) return 1
    return 0
  } catch {
    return a === b ? 0 : 1
  }
}

export function decideSyncAction({
  hasRemote,
  localEmpty,
  dirty,
  remoteVersion,
  lastSyncedVersion,
}: SyncDecisionInput): SyncDecision {
  if (!hasRemote) return localEmpty ? 'noop' : 'create'
  if (localEmpty) return 'download'
  if (lastSyncedVersion === null) return 'conflict'
  const remoteMoved =
    remoteVersion !== null && compareVersions(remoteVersion, lastSyncedVersion) > 0
  if (dirty && remoteMoved) return 'conflict'
  if (dirty) return 'upload'
  if (remoteMoved) return 'download'
  return 'noop'
}

export function shouldClearDirty(snapshotSeq: number, currentSeq: number): boolean {
  return snapshotSeq === currentSeq
}

export function classifyPreconditionFailure(
  remoteVersion: string,
  lastSyncedVersion: string | null,
): 'retry' | 'conflict' {
  if (lastSyncedVersion === null) return 'conflict'
  return compareVersions(remoteVersion, lastSyncedVersion) > 0 ? 'conflict' : 'retry'
}

export function isOwnPendingUpload(
  remoteVersion: string,
  lastSyncedVersion: string | null,
  remoteHash: string | null,
  lastSyncedHash: string | null,
): boolean {
  if (lastSyncedVersion === null || !remoteHash || !lastSyncedHash) return false
  return remoteHash === lastSyncedHash && compareVersions(remoteVersion, lastSyncedVersion) > 0
}
