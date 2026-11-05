import { describe, expect, test } from 'bun:test'
import {
  classifyPreconditionFailure,
  compareVersions,
  decideSyncAction,
  isOwnPendingUpload,
  shouldClearDirty,
} from './decision'

const base = {
  hasRemote: true,
  localEmpty: false,
  dirty: false,
  remoteVersion: '2',
  lastSyncedVersion: '1',
}

describe('decideSyncAction', () => {
  test('creates the remote snapshot when the remote file is missing', () => {
    expect(decideSyncAction({ ...base, hasRemote: false })).toBe('create')
  })

  test('does nothing when both sides are empty', () => {
    expect(decideSyncAction({ ...base, hasRemote: false, localEmpty: true })).toBe('noop')
  })

  test('downloads when local data is empty and a remote snapshot exists', () => {
    expect(decideSyncAction({ ...base, localEmpty: true })).toBe('download')
  })

  test('downloads when clean and the remote version moved', () => {
    expect(decideSyncAction(base)).toBe('download')
  })

  test('uploads when dirty and the remote version is still the last synced one', () => {
    expect(decideSyncAction({ ...base, dirty: true, remoteVersion: '1' })).toBe('upload')
  })

  test('prompts when both sides moved', () => {
    expect(decideSyncAction({ ...base, dirty: true })).toBe('conflict')
  })

  test('prompts when a remote snapshot exists but this device has never synced', () => {
    expect(decideSyncAction({ ...base, lastSyncedVersion: null })).toBe('conflict')
  })

  test('does nothing when clean and the versions match', () => {
    expect(decideSyncAction({ ...base, remoteVersion: '1' })).toBe('noop')
  })

  test('uploads when dirty and the remote read is older than the last sync', () => {
    expect(
      decideSyncAction({ ...base, dirty: true, remoteVersion: '1', lastSyncedVersion: '2' }),
    ).toBe('upload')
  })

  test('does nothing when clean and the remote read is older than the last sync', () => {
    expect(decideSyncAction({ ...base, remoteVersion: '1', lastSyncedVersion: '2' })).toBe('noop')
  })
})

describe('compareVersions', () => {
  test('compares numeric versions numerically instead of lexicographically', () => {
    expect(compareVersions('10', '2')).toBe(1)
    expect(compareVersions('2', '10')).toBe(-1)
    expect(compareVersions('2', '2')).toBe(0)
  })
})

describe('shouldClearDirty', () => {
  test('clears only when no local mutation landed during the upload', () => {
    expect(shouldClearDirty(4, 4)).toBe(true)
    expect(shouldClearDirty(4, 5)).toBe(false)
  })
})

describe('classifyPreconditionFailure', () => {
  test('retries when the precondition failed but the remote version is unchanged', () => {
    expect(classifyPreconditionFailure('3', '3')).toBe('retry')
  })

  test('prompts when the remote version actually changed', () => {
    expect(classifyPreconditionFailure('4', '3')).toBe('conflict')
  })

  test('prompts when this device has never synced', () => {
    expect(classifyPreconditionFailure('4', null)).toBe('conflict')
  })

  test('retries when the remote read is older than the last sync', () => {
    expect(classifyPreconditionFailure('2', '3')).toBe('retry')
  })
})

describe('isOwnPendingUpload', () => {
  test('recognizes a newer remote version carrying our last uploaded content', () => {
    expect(isOwnPendingUpload('16', '15', 'hash', 'hash')).toBe(true)
  })

  test('does not treat different content as our own write', () => {
    expect(isOwnPendingUpload('16', '15', 'other', 'hash')).toBe(false)
  })

  test('does not adopt the same version', () => {
    expect(isOwnPendingUpload('15', '15', 'hash', 'hash')).toBe(false)
  })

  test('does not adopt without a stored hash', () => {
    expect(isOwnPendingUpload('16', '15', 'hash', null)).toBe(false)
  })
})
