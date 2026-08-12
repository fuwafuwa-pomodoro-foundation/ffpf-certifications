import type { Certificate, CertificateInput } from '../src/features/certificates/types'

const MAX_BODY_BYTES = 16 * 1024
const MAX_CERTIFICATES = 100

type CertificateRow = Certificate

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return Response.json(data, { ...init, headers })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateCertificateInput(value: unknown): CertificateInput | null {
  if (!isRecord(value)) return null

  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const recipient = typeof value.recipient === 'string' ? value.recipient.trim() : ''
  const description = typeof value.description === 'string' ? value.description.trim() : ''
  const issuedAt = typeof value.issuedAt === 'string' ? value.issuedAt : ''
  const parsedIssuedAt = new Date(`${issuedAt}T00:00:00Z`)
  const today = new Date().toISOString().slice(0, 10)

  if (
    title.length < 1 || title.length > 100 ||
    recipient.length < 1 || recipient.length > 100 ||
    description.length < 1 || description.length > 500 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(issuedAt) ||
    Number.isNaN(parsedIssuedAt.getTime()) ||
    parsedIssuedAt.toISOString().slice(0, 10) !== issuedAt ||
    issuedAt > today
  ) {
    return null
  }

  return { title, recipient, description, issuedAt }
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE')
  if (!request.body) throw new Error('INVALID_JSON')

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let body = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE')
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new Error('INVALID_JSON')
  }
}

async function listCertificates(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT "id", "title", "recipient", "description", "issuedAt", "createdAt"
     FROM "Certificate"
     ORDER BY "createdAt" DESC
     LIMIT ?`,
  ).bind(MAX_CERTIFICATES).all<CertificateRow>()

  return json({ certificates: result.results })
}

async function insertCertificate(request: Request, env: Env): Promise<Response> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'JSON形式で送信してください。' }, { status: 415 })
  }

  let input: CertificateInput | null
  try {
    input = validateCertificateInput(await readLimitedJson(request))
  } catch (error) {
    const isTooLarge = error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE'
    return json(
      { error: isTooLarge ? '入力内容が大きすぎます。' : 'JSONを読み取れませんでした。' },
      { status: isTooLarge ? 413 : 400 },
    )
  }

  if (!input) {
    return json({ error: '入力内容を確認してください。' }, { status: 422 })
  }

  const certificate: Certificate = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  }

  await env.DB.prepare(
    `INSERT INTO "Certificate"
      ("id", "title", "recipient", "description", "issuedAt", "createdAt")
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    certificate.id,
    certificate.title,
    certificate.recipient,
    certificate.description,
    certificate.issuedAt,
    certificate.createdAt,
  ).run()

  return json(certificate, { status: 201 })
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/certificates') {
      try {
        if (request.method === 'GET') return await listCertificates(env)
        if (request.method === 'POST') return await insertCertificate(request, env)
        return json(
          { error: '許可されていないメソッドです。' },
          { status: 405, headers: { Allow: 'GET, POST' } },
        )
      } catch (error) {
        console.error(JSON.stringify({
          event: 'certificate_api_error',
          method: request.method,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
        return json({ error: 'サーバーで問題が発生しました。' }, { status: 500 })
      }
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
