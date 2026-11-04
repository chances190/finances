import { describe, expect, test } from 'bun:test'
import { decideSyncAction, shouldClearDirty } from './decision'

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
})

describe('shouldClearDirty', () => {
  test('clears only when no local mutation landed during the upload', () => {
    expect(shouldClearDirty(4, 4)).toBe(true)
    expect(shouldClearDirty(4, 5)).toBe(false)
  })
})
