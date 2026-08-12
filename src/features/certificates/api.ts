import type {
  Certificate,
  CertificateInput,
  CertificatesResponse,
} from './types'

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as unknown

  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body &&
      typeof body.error === 'string'
      ? body.error
      : '通信に失敗しました。'
    throw new Error(message)
  }

  return body as T
}

export async function getCertificates(): Promise<Certificate[]> {
  const response = await fetch('/api/certificates', {
    headers: { Accept: 'application/json' },
  })
  const body = await parseResponse<CertificatesResponse>(response)
  return body.certificates
}

export async function createCertificate(input: CertificateInput): Promise<Certificate> {
  const response = await fetch('/api/certificates', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  return parseResponse<Certificate>(response)
}
