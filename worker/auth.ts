import {
  authorizeUrl,
  codeChallenge,
  exchangeCode,
  FfpfRejectedError,
  getFfpfIdConfig,
  randomToken,
  type FfpfUser,
} from './ffpf-id'
import {
  getSessionSecret,
  OAUTH_COOKIE,
  OAUTH_MAX_AGE,
  readOAuthState,
  readSession,
  sealOAuthState,
  sealSession,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from './session'

const CALLBACK_PATH = '/api/auth/callback/ffpf'
const AUTH_COOKIE_PATH = '/api/auth'

// FFPF IDのクライアントと、セッションの署名鍵が揃っているときだけログインできる。
function getAuthConfig(env: Env) {
  const ffpf = getFfpfIdConfig(env)
  const secret = getSessionSecret(env)
  return ffpf && secret ? { ffpf, secret } : null
}

const SAME_SITE_BASE = 'https://same-site.invalid'

// このサイト内のパスだけを戻り先にする（//example.comなどで外へ出さない）。
// ブラウザはURL中のタブや改行を取り除くため（/\t/evil.com → //evil.com）、
// 文字列で判定せずURLとして解釈し、解釈後のパスだけを返す。
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || [...value].some((c) => c <= ' ' || c === '\\')) return '/'
  let parsed: URL
  try {
    parsed = new URL(value, SAME_SITE_BASE)
  } catch {
    return '/'
  }
  if (parsed.origin !== SAME_SITE_BASE) return '/'
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

function withLoginFailed(next: string): string {
  const url = new URL(next, 'https://placeholder.invalid')
  url.searchParams.set('login', 'failed')
  return `${url.pathname}${url.search}${url.hash}`
}

export async function getCurrentUser(request: Request, env: Env): Promise<FfpfUser | null> {
  const config = getAuthConfig(env)
  if (!config) return null
  return readSession(request, config.secret)
}

export async function handleSession(request: Request, env: Env): Promise<Response> {
  const config = getAuthConfig(env)
  const user = config ? await readSession(request, config.secret) : null
  return Response.json(
    { enabled: config !== null, user: user && { name: user.name, email: user.email } },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function handleSignIn(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  const config = getAuthConfig(env)
  if (!config) return redirect(withLoginFailed(next))

  const state = randomToken()
  const verifier = randomToken()
  const nonce = randomToken()
  const location = authorizeUrl(config.ffpf, {
    state,
    nonce,
    challenge: await codeChallenge(verifier),
    redirectUri: `${url.origin}${CALLBACK_PATH}`,
  })
  const cookie = await sealOAuthState(config.secret, { state, verifier, nonce, next })
  return redirect(location, [
    serializeCookie(request, OAUTH_COOKIE, cookie, { maxAge: OAUTH_MAX_AGE, path: AUTH_COOKIE_PATH }),
  ])
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const clearOAuth = serializeCookie(request, OAUTH_COOKIE, '', { maxAge: 0, path: AUTH_COOKIE_PATH })
  const config = getAuthConfig(env)
  if (!config) return redirect(withLoginFailed('/'), [clearOAuth])

  const saved = await readOAuthState(request, config.secret)
  const code = url.searchParams.get('code')
  if (!saved || !code || url.searchParams.get('state') !== saved.state) {
    return redirect(withLoginFailed(saved?.next ?? '/'), [clearOAuth])
  }

  try {
    const user = await exchangeCode(config.ffpf, {
      code,
      verifier: saved.verifier,
      nonce: saved.nonce,
      redirectUri: `${url.origin}${CALLBACK_PATH}`,
    })
    const session = await sealSession(config.secret, user)
    return redirect(saved.next, [
      clearOAuth,
      serializeCookie(request, SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE, path: '/' }),
    ])
  } catch (error) {
    // トークンやコードはログに出さない。
    console.error(JSON.stringify({
      event: error instanceof FfpfRejectedError ? 'ffpf_id_rejected' : 'ffpf_id_unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
    }))
    return redirect(withLoginFailed(saved.next), [clearOAuth])
  }
}

export function handleSignOut(request: Request): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  headers.append('Set-Cookie', serializeCookie(request, SESSION_COOKIE, '', { maxAge: 0, path: '/' }))
  return new Response(null, { status: 204, headers })
}
