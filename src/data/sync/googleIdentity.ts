const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface OAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
  }) => TokenClient
  revoke?: (token: string, callback?: () => void) => void
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

async function requestToken(interactive: boolean): Promise<string> {
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
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          settle(() =>
            reject(
              new GoogleAuthError(
                response.error_description ?? response.error ?? 'Google authorization failed',
              ),
            ),
          )
          return
        }
        accessToken = response.access_token
        expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
        settle(() => resolve(response.access_token as string))
      },
    })
    client.requestAccessToken({ prompt: interactive ? '' : 'none' })
    window.setTimeout(() => {
      settle(() => reject(new GoogleAuthError('Google authorization timed out')))
    }, 60_000)
  })
}

export async function getAccessToken(interactive: boolean): Promise<string> {
  if (hasAccessToken() && accessToken) return accessToken
  return requestToken(interactive)
}

export function clearAccessToken(): void {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(accessToken)
  }
  accessToken = null
  expiresAt = 0
}
