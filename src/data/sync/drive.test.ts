import { describe, expect, test } from 'bun:test'
import { DriveApiError, findSnapshot, readFileMeta } from './drive'

function fileResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers })
}

describe('readFileMeta', () => {
  test('normalizes a numeric version to the string used by later comparisons', async () => {
    const meta = await readFileMeta(fileResponse({ id: 'file', version: 7 }, { ETag: '"abc"' }))
    expect(meta).toEqual({ id: 'file', version: '7', etag: '"abc"', trashed: false })
  })

  test('carries the trashed flag from the resource', async () => {
    const meta = await readFileMeta(fileResponse({ id: 'file', version: '7', trashed: true }))
    expect(meta.trashed).toBe(true)
  })

  test('rejects a response without a version', async () => {
    await expect(readFileMeta(fileResponse({ id: 'file' }))).rejects.toBeInstanceOf(DriveApiError)
  })
})

describe('findSnapshot', () => {
  test('reads the stored file id directly instead of listing by name', async () => {
    const originalFetch = globalThis.fetch
    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return fileResponse({ id: 'known', version: '3' }, { ETag: '"e"' })
    }) as typeof fetch

    try {
      const meta = await findSnapshot('token', 'known')
      expect(meta?.id).toBe('known')
      expect(calls).toHaveLength(1)
      expect(calls[0]).toContain('/files/known')
      expect(calls[0]).toContain('fields=*')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
