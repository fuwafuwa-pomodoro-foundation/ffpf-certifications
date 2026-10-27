// FFPF ID（ffpf-portalのOpenID Connectプロバイダ）のクライアント。
// 認可コードフロー＋PKCEで、IDトークンはportalのJWKSでES256の署名を検証する。
// エンドポイントはdiscoveryを使わずFFPF_ID_ISSUERから組み立てる。

export type FfpfIdConfig = {
  issuer: string
  clientId: string
  clientSecret: string
}

export type FfpfUser = {
  sub: string
  email: string
  name: string
}

// portalが断った（コードの誤り、IDトークンが受け入れられないなど）。
export class FfpfRejectedError extends Error {}
// portalに届かない、5xx、JWKSが取れない。
export class FfpfUnavailableError extends Error {}

const JWKS_CACHE_MS = 10 * 60 * 1000
const LEEWAY_SECONDS = 60
const SUB_PATTERN = /^[a-z0-9]{1,64}$/
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/

export function getFfpfIdConfig(env: Env): FfpfIdConfig | null {
  const issuer = env.FFPF_ID_ISSUER?.trim().replace(/\/+$/, '')
  const clientId = env.FFPF_ID_CLIENT_ID?.trim()
  const clientSecret = env.FFPF_ID_CLIENT_SECRET?.trim()
  if (!issuer || !clientId || !clientSecret) return null
  return { issuer, clientId, clientSecret }
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  if (!SEGMENT_PATTERN.test(value)) throw new Error('INVALID_BASE64URL')
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function randomToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

export function authorizeUrl(
  config: FfpfIdConfig,
  params: { state: string, challenge: string, nonce: string, redirectUri: string },
): string {
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
  })
  return `${config.issuer}/oauth/authorize?${query}`
}

// portalから戻ってきたコードをIDトークンに替え、検証して利用者を返す。
export async function exchangeCode(
  config: FfpfIdConfig,
  params: { code: string, verifier: string, redirectUri: string, nonce: string },
): Promise<FfpfUser> {
  const idToken = await requestIdToken(config, params)
  return verifyIdToken(config, idToken, params.nonce)
}

async function requestIdToken(
  config: FfpfIdConfig,
  params: { code: string, verifier: string, redirectUri: string },
): Promise<string> {
  // RFC 6749 §2.3.1: Basic認証の前にclient_idとsecretをフォームの形でエンコードする。
  const credentials = btoa(
    `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`,
  )
  let response: Response
  try {
    response = await fetch(`${config.issuer}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        code_verifier: params.verifier,
        redirect_uri: params.redirectUri,
      }),
      // client_secretを載せた要求をリダイレクト先へ送り直さない。
      redirect: 'manual',
    })
  } catch {
    throw new FfpfUnavailableError('the token request failed')
  }

  if (response.status >= 400 && response.status <= 499) {
    throw new FfpfRejectedError(`the token endpoint answered ${response.status}`)
  }
  if (!response.ok) {
    throw new FfpfUnavailableError(`the token endpoint answered ${response.status}`)
  }

  const body = await response.json().catch(() => null) as unknown
  if (
    typeof body !== 'object' || body === null || !('id_token' in body) ||
    typeof body.id_token !== 'string' || !body.id_token
  ) {
    throw new FfpfRejectedError('the token answer has no id_token')
  }
  return body.id_token
}

type Jwks = { keys: Map<string, CryptoKey>, fetchedAt: number }
let jwksCache: Jwks | undefined

async function fetchJwks(config: FfpfIdConfig): Promise<Jwks> {
  let response: Response
  try {
    response = await fetch(`${config.issuer}/oauth/jwks`, { headers: { Accept: 'application/json' } })
  } catch {
    throw new FfpfUnavailableError('the JWKS request failed')
  }
  if (!response.ok) throw new FfpfUnavailableError(`the JWKS endpoint answered ${response.status}`)

  const body = await response.json().catch(() => null) as { keys?: unknown } | null
  if (!body || !Array.isArray(body.keys)) throw new FfpfUnavailableError('the JWKS is not a key set')

  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys as (JsonWebKey & { kid?: unknown })[]) {
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.kid !== 'string') continue
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      )
      keys.set(jwk.kid, key)
    } catch {
      // 読めない鍵は使わない。
    }
  }
  return { keys, fetchedAt: Date.now() }
}

async function findKey(config: FfpfIdConfig, kid: string): Promise<CryptoKey> {
  const isFresh = jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_MS
  if (isFresh) {
    const key = jwksCache!.keys.get(kid)
    if (key) return key
  }
  // 期限切れ、またはkidが見つからない（鍵の交換）ときに1回だけ取り直す。
  jwksCache = await fetchJwks(config)
  const key = jwksCache.keys.get(kid)
  if (!key) throw new FfpfRejectedError('the ID token is signed by an unknown key')
  return key
}

function decodeJson(segment: string): Record<string, unknown> {
  const value = JSON.parse(new TextDecoder().decode(base64UrlDecode(segment))) as unknown
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('NOT_OBJECT')
  return value as Record<string, unknown>
}

export async function verifyIdToken(
  config: FfpfIdConfig,
  idToken: string,
  nonce: string,
): Promise<FfpfUser> {
  const reject = (reason: string) => new FfpfRejectedError(`the ID token ${reason}`)

  const segments = idToken.split('.')
  if (segments.length !== 3) throw reject('is not a compact JWT')

  let header: Record<string, unknown>
  let claims: Record<string, unknown>
  let signature: Uint8Array<ArrayBuffer>
  try {
    header = decodeJson(segments[0])
    claims = decodeJson(segments[1])
    signature = base64UrlDecode(segments[2])
  } catch {
    throw reject('is not a compact JWT')
  }

  // ヘッダーが何と言おうとES256だけを受け入れる。
  if (header.alg !== 'ES256') throw reject('is not ES256')
  if (header.typ !== undefined && header.typ !== 'JWT') throw reject('is not typed JWT')
  if (typeof header.kid !== 'string' || !header.kid) throw reject('has no kid')
  // ES256の署名はr‖s（各32バイト）で、Web Cryptoが受け取る形と同じ。
  if (signature.length !== 64) throw reject('signature is not 64 bytes')

  const key = await findKey(config, header.kid)
  const isValid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature,
    new TextEncoder().encode(`${segments[0]}.${segments[1]}`),
  )
  if (!isValid) throw reject('signature does not verify')

  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  const now = Math.floor(Date.now() / 1000)
  if (claims.iss !== config.issuer) throw reject('is from another issuer')
  if (!audience.includes(config.clientId)) throw reject('is for another client')
  if (typeof claims.exp !== 'number' || claims.exp + LEEWAY_SECONDS < now) throw reject('has expired')
  if (claims.nonce !== nonce) throw reject('nonce does not match')
  if (claims.email_verified !== true) throw reject('email is not verified')
  if (typeof claims.sub !== 'string' || !SUB_PATTERN.test(claims.sub)) throw reject('sub is malformed')
  if (typeof claims.email !== 'string' || !claims.email) throw reject('has no email')

  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : claims.email
  return { sub: claims.sub, email: claims.email, name }
}
