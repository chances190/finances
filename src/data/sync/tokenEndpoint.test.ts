import { afterEach, describe, expect, test } from 'bun:test'
import { onRequestDelete, onRequestPost } from '../../../functions/api/google/token'

const originalFetch = globalThis.fetch
const env = { GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret' }

function makeRequest(
  init: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Request {
  return new Request('https://app.example.com/api/google/token', {
    method: init.method ?? 'POST',
    headers: {
      Origin: 'https://app.example.com',
      'X-Requested-With': 'XmlHttpRequest',
      'Content-Type': 'application/json',
      ...init.headers,
    },
    body: init.body,
  })
}

function googleResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('onRequestPost', () => {
  test('exchanges a code and stores the refresh token in an HttpOnly cookie', async () => {
    const captured: { body: URLSearchParams | null } = { body: null }
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured.body = new URLSearchParams(String(init?.body))
      return googleResponse({
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 3600,
      })
    }) as unknown as typeof fetch

    const response = await onRequestPost({
      request: makeRequest({ body: JSON.stringify({ code: 'code' }) }),
      env,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ access_token: 'access', expires_in: 3600 })
    const cookie = response.headers.get('Set-Cookie') ?? ''
    expect(cookie).toContain('finances_refresh_token=refresh')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Path=/api/google')
    expect(captured.body?.get('grant_type')).toBe('authorization_code')
    expect(captured.body?.get('redirect_uri')).toBe('https://app.example.com')
    expect(captured.body?.get('client_secret')).toBe('secret')
  })

  test('refreshes with the cookie when no code is sent', async () => {
    const captured: { body: URLSearchParams | null } = { body: null }
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured.body = new URLSearchParams(String(init?.body))
      return googleResponse({ access_token: 'access2', expires_in: 1800 })
    }) as unknown as typeof fetch

    const response = await onRequestPost({
      request: makeRequest({ headers: { Cookie: 'finances_refresh_token=refresh' } }),
      env,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ access_token: 'access2', expires_in: 1800 })
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(captured.body?.get('grant_type')).toBe('refresh_token')
    expect(captured.body?.get('refresh_token')).toBe('refresh')
  })

  test('returns reconnect_required without a code or cookie', async () => {
    const response = await onRequestPost({ request: makeRequest(), env })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'reconnect_required' })
  })

  test('rejects requests without the CSRF header', async () => {
    const response = await onRequestPost({
      request: makeRequest({ headers: { 'X-Requested-With': 'fetch' } }),
      env,
    })
    expect(response.status).toBe(403)
  })

  test('rejects a different origin unless it is allowlisted', async () => {
    const rejected = await onRequestPost({
      request: makeRequest({ headers: { Origin: 'https://evil.example' } }),
      env,
    })
    expect(rejected.status).toBe(403)

    globalThis.fetch = (async () =>
      googleResponse({ access_token: 'access' })) as unknown as typeof fetch
    const allowed = await onRequestPost({
      request: makeRequest({
        headers: { Origin: 'http://localhost:5173' },
        body: JSON.stringify({ code: 'code' }),
      }),
      env: { ...env, ALLOWED_ORIGINS: 'http://localhost:5173' },
    })
    expect(allowed.status).toBe(200)
  })
})

describe('onRequestDelete', () => {
  test('clears the refresh cookie and revokes the token', async () => {
    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return googleResponse({})
    }) as unknown as typeof fetch

    const response = await onRequestDelete({
      request: makeRequest({
        method: 'DELETE',
        headers: { Cookie: 'finances_refresh_token=refresh' },
      }),
      env,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(calls[0]).toContain('oauth2.googleapis.com/revoke')
  })
})
