export type Certificate = {
  id: string
  title: string
  recipient: string
  description: string
  issuedAt: string
  createdAt: string
}

export type CertificateInput = Pick<
  Certificate,
  'title' | 'recipient' | 'description' | 'issuedAt'
>

export type CertificatesResponse = {
  certificates: Certificate[]
}
