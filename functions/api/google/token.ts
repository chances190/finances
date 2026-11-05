interface Env {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  ALLOWED_ORIGINS?: string
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  error?: string
  error_description?: string
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const COOKIE_NAME = 'finances_refresh_token'
const COOKIE_PATH = '/api/google'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Content-Type', 'application/json')
  responseHeaders.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers: responseHeaders })
}

function resolveOrigin(request: Request, env: Env): string | null {
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get('Origin') ?? requestOrigin
  if (origin === requestOrigin) return origin
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return allowed.includes(origin) ? origin : null
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      const value = rest.join('=')
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }
  }
  return null
}

function cookieFor(value: string, origin: string): string {
  const secure = origin.startsWith('https://') ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly${secure}; SameSite=Lax; Path=${COOKIE_PATH}; Max-Age=${COOKIE_MAX_AGE}`
}

function clearedCookie(origin: string): string {
  const secure = origin.startsWith('https://') ? '; Secure' : ''
  return `${COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=${COOKIE_PATH}; Max-Age=0`
}

function isCsrfHeaderValid(request: Request): boolean {
  return request.headers.get('X-Requested-With') === 'XmlHttpRequest'
}

async function requestTokens(
  env: Env,
  origin: string,
  code: string | null,
  refreshToken: string | null,
): Promise<{ response: Response; token: TokenResponse }> {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
  })
  if (code) {
    params.set('grant_type', 'authorization_code')
    params.set('code', code)
    params.set('redirect_uri', origin)
  } else if (refreshToken) {
    params.set('grant_type', 'refresh_token')
    params.set('refresh_token', refreshToken)
  }
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  return { response, token: (await response.json()) as TokenResponse }
}

export async function onRequestPost({
  request,
  env,
}: {
  request: Request
  env: Env
}): Promise<Response> {
  const origin = resolveOrigin(request, env)
  if (!origin) return json({ error: 'origin_not_allowed' }, 403)
  if (!isCsrfHeaderValid(request)) return json({ error: 'invalid_request' }, 403)
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json(
      { error: 'not_configured', message: 'Google OAuth is not configured on the server' },
      500,
    )
  }

  let code: string | null = null
  try {
    const body = (await request.json()) as { code?: unknown }
    if (typeof body.code === 'string' && body.code) code = body.code
  } catch {
    // A refresh request has no body.
  }

  const refreshToken = readCookie(request, COOKIE_NAME)
  if (!code && !refreshToken) return json({ error: 'reconnect_required' }, 401)

  const { response, token } = await requestTokens(env, origin, code, refreshToken)
  if (!response.ok || !token.access_token) {
    const status = token.error === 'invalid_grant' ? 401 : 502
    return json(
      { error: token.error ?? 'token_exchange_failed', message: token.error_description },
      status,
    )
  }

  const headers = new Headers()
  if (token.refresh_token) headers.set('Set-Cookie', cookieFor(token.refresh_token, origin))
  return json(
    { access_token: token.access_token, expires_in: token.expires_in ?? 3600 },
    200,
    headers,
  )
}

export async function onRequestDelete({
  request,
  env,
}: {
  request: Request
  env: Env
}): Promise<Response> {
  const origin = resolveOrigin(request, env)
  if (!origin) return json({ error: 'origin_not_allowed' }, 403)
  if (!isCsrfHeaderValid(request)) return json({ error: 'invalid_request' }, 403)

  const refreshToken = readCookie(request, COOKIE_NAME)
  if (refreshToken) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
    }).catch(() => {})
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearedCookie(origin) })
}
