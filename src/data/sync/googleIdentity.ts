const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const TOKEN_ENDPOINT = '/api/google/token'

interface CodeResponse {
  code?: string
  error?: string
  error_description?: string
}

interface CodeError {
  type?: string
}

interface CodeClient {
  requestCode: () => void
}

interface OAuth2 {
  initCodeClient: (config: {
    client_id: string
    scope: string
    ux_mode: 'popup'
    callback: (response: CodeResponse) => void
    error_callback?: (response: CodeError) => void
  }) => CodeClient
}

interface TokenPayload {
  access_token?: string
  expires_in?: number
  error?: string
  message?: string
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: OAuth2
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null
let accessToken: string | null = null
let expiresAt = 0

export class GoogleAuthError extends Error {}

export function isGoogleConfigured(): boolean {
  return CLIENT_ID !== ''
}

export function hasAccessToken(): boolean {
  return accessToken !== null && Date.now() < expiresAt - 60_000
}

async function loadIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_URL
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new GoogleAuthError('Could not load Google Identity Services'))
      document.head.appendChild(script)
    })
  }
  await scriptPromise
}

export function preloadGoogleIdentity(): void {
  if (!isGoogleConfigured()) return
  void loadIdentityScript().catch(() => {})
}

async function requestCode(): Promise<string> {
  if (!isGoogleConfigured()) {
    throw new GoogleAuthError('Google Drive sync is not configured')
  }
  await loadIdentityScript()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new GoogleAuthError('Google Identity Services is unavailable')

  return new Promise<string>((resolve, reject) => {
    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }
    const client = oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ux_mode: 'popup',
      callback: (response) => {
        if (response.error || !response.code) {
          settle(() =>
            reject(
              new GoogleAuthError(
                response.error_description ?? response.error ?? 'Google authorization failed',
              ),
            ),
          )
          return
        }
        settle(() => resolve(response.code as string))
      },
      error_callback: (response) => {
        settle(() => reject(new GoogleAuthError(response.type ?? 'Google authorization failed')))
      },
    })
    client.requestCode()
    window.setTimeout(() => {
      settle(() => reject(new GoogleAuthError('Google authorization timed out')))
    }, 60_000)
  })
}

async function exchangeTokens(body: { code: string } | Record<string, never>): Promise<string> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XmlHttpRequest',
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => null)) as TokenPayload | null
  if (!response.ok || !payload?.access_token) {
    const message =
      payload?.message ?? payload?.error ?? `Google token exchange failed (${response.status})`
    if (response.status === 401 || response.status === 403) {
      throw new GoogleAuthError(message)
    }
    throw new Error(message)
  }
  accessToken = payload.access_token
  expiresAt = Date.now() + (payload.expires_in ?? 3600) * 1000
  return payload.access_token
}

async function requestCodeAndExchange(): Promise<string> {
  const code = await requestCode()
  return exchangeTokens({ code })
}

export async function getAccessToken(interactive: boolean): Promise<string> {
  if (hasAccessToken() && accessToken) return accessToken
  return interactive ? requestCodeAndExchange() : exchangeTokens({})
}

export function clearAccessToken(): void {
  accessToken = null
  expiresAt = 0
  void fetch(TOKEN_ENDPOINT, {
    method: 'DELETE',
    headers: { 'X-Requested-With': 'XmlHttpRequest' },
    credentials: 'same-origin',
  }).catch(() => {})
}
