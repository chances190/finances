import type { DriveFileMeta } from './types'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FILE_NAME = 'finances.json'

export class DriveAuthError extends Error {}
export class DriveConflictError extends Error {}
export class DriveApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

async function throwDriveError(response: Response): Promise<never> {
  let message = `Google Drive request failed (${response.status})`
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    message = body.error?.message ?? message
  } catch {
    // Keep the status-based message when the body is not JSON.
  }
  if (response.status === 401) throw new DriveAuthError(message)
  if (response.status === 412) throw new DriveConflictError(message)
  throw new DriveApiError(message, response.status)
}

async function parseFileMeta(response: Response): Promise<DriveFileMeta> {
  if (!response.ok) await throwDriveError(response)
  const body = (await response.json()) as { id?: string; version?: string }
  if (!body.id || !body.version) {
    throw new DriveApiError('Google Drive did not return a file version', response.status)
  }
  return { id: body.id, version: body.version, etag: response.headers.get('ETag') }
}

export async function findSnapshot(token: string): Promise<DriveFileMeta | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: 'files(id)',
    pageSize: '1',
  })
  const listResponse = await fetch(`${API}/files?${params}`, { headers: authHeaders(token) })
  if (!listResponse.ok) await throwDriveError(listResponse)
  const list = (await listResponse.json()) as { files?: Array<{ id?: string }> }
  const id = list.files?.[0]?.id
  if (!id) return null

  const metaResponse = await fetch(`${API}/files/${id}?fields=id,version`, {
    headers: authHeaders(token),
  })
  return parseFileMeta(metaResponse)
}

export async function downloadSnapshot(token: string, fileId: string): Promise<string> {
  const response = await fetch(`${API}/files/${fileId}?alt=media`, {
    headers: authHeaders(token),
  })
  if (!response.ok) await throwDriveError(response)
  return response.text()
}

function multipartBody(metadata: object, data: string): { body: string; contentType: string } {
  const boundary = `finances-${crypto.randomUUID()}`
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    data,
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return { body, contentType: `multipart/related; boundary=${boundary}` }
}

export async function createSnapshot(token: string, serialized: string): Promise<DriveFileMeta> {
  const { body, contentType } = multipartBody(
    { name: FILE_NAME, parents: ['appDataFolder'] },
    serialized,
  )
  const response = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id,version`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': contentType,
    },
    body,
  })
  return parseFileMeta(response)
}

export async function updateSnapshot(
  token: string,
  file: DriveFileMeta,
  serialized: string,
): Promise<DriveFileMeta> {
  const headers: Record<string, string> = {
    ...authHeaders(token),
    'Content-Type': 'application/json',
  }
  if (file.etag) headers['If-Match'] = file.etag
  const response = await fetch(`${UPLOAD}/files/${file.id}?uploadType=media&fields=id,version`, {
    method: 'PATCH',
    headers,
    body: serialized,
  })
  return parseFileMeta(response)
}
