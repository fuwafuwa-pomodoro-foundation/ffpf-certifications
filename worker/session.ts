// FFPF_SESSION_SECRETで署名したCookie。サーバーに状態を持たない。
// 中身はbase64url(JSON).base64url(HMAC-SHA256)で、用途（purpose）と有効期限（exp、秒）を含む。

import { base64UrlDecode, base64UrlEncode, type FfpfUser } from './ffpf-id'

export const SESSION_COOKIE = 'ffpf_session'
export const OAUTH_COOKIE = 'ffpf_oauth'
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60
export const OAUTH_MAX_AGE = 10 * 60

export type OAuthState = {
  state: string
  verifier: string
  nonce: string
  next: string
}

type Purpose = 'session' | 'oauth'

const encoder = new TextEncoder()

export function getSessionSecret(env: Env): string | null {
  const secret = env.FFPF_SESSION_SECRET?.trim()
  // HMACの鍵として32文字未満は弱すぎるので、設定されていないものとして扱う。
  return secret && secret.length >= 32 ? secret : null
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function seal(secret: string, purpose: Purpose, data: object, maxAge: number): Promise<string> {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    ...data,
    purpose,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  })))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload))
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function unseal(secret: string, purpose: Purpose, value: string | undefined): Promise<Record<string, unknown> | null> {
  if (!value) return null
  const [payload, signature, ...rest] = value.split('.')
  if (!payload || !signature || rest.length > 0) return null

  try {
    const isValid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      base64UrlDecode(signature),
      encoder.encode(payload),
    )
    if (!isValid) return null

    const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as unknown
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
    const record = data as Record<string, unknown>
    if (record.purpose !== purpose) return null
    if (typeof record.exp !== 'number' || record.exp < Math.floor(Date.now() / 1000)) return null
    return record
  } catch {
    return null
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return undefined
}

export function serializeCookie(
  request: Request,
  name: string,
  value: string,
  options: { maxAge: number, path: string },
): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${name}=${value}; Max-Age=${options.maxAge}; Path=${options.path}; HttpOnly; SameSite=Lax${secure}`
}

export function sealSession(secret: string, user: FfpfUser): Promise<string> {
  return seal(secret, 'session', { sub: user.sub, email: user.email, name: user.name }, SESSION_MAX_AGE)
}

export async function readSession(request: Request, secret: string): Promise<FfpfUser | null> {
  const data = await unseal(secret, 'session', readCookie(request, SESSION_COOKIE))
  if (
    !data || typeof data.sub !== 'string' || typeof data.email !== 'string' ||
    typeof data.name !== 'string'
  ) {
    return null
  }
  return { sub: data.sub, email: data.email, name: data.name }
}

export function sealOAuthState(secret: string, state: OAuthState): Promise<string> {
  return seal(secret, 'oauth', state, OAUTH_MAX_AGE)
}

export async function readOAuthState(request: Request, secret: string): Promise<OAuthState | null> {
  const data = await unseal(secret, 'oauth', readCookie(request, OAUTH_COOKIE))
  if (
    !data || typeof data.state !== 'string' || typeof data.verifier !== 'string' ||
    typeof data.nonce !== 'string' || typeof data.next !== 'string'
  ) {
    return null
  }
  return { state: data.state, verifier: data.verifier, nonce: data.nonce, next: data.next }
}
