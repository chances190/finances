export type SyncDecision = 'noop' | 'download' | 'upload' | 'conflict' | 'create'

export interface SyncDecisionInput {
  hasRemote: boolean
  localEmpty: boolean
  dirty: boolean
  remoteVersion: string | null
  lastSyncedVersion: string | null
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
  if (dirty && remoteVersion !== lastSyncedVersion) return 'conflict'
  if (dirty) return 'upload'
  if (remoteVersion !== lastSyncedVersion) return 'download'
  return 'noop'
}

export function shouldClearDirty(snapshotSeq: number, currentSeq: number): boolean {
  return snapshotSeq === currentSeq
}

export function classifyPreconditionFailure(
  remoteVersion: string,
  lastSyncedVersion: string | null,
): 'retry' | 'conflict' {
  return remoteVersion === lastSyncedVersion ? 'retry' : 'conflict'
}
