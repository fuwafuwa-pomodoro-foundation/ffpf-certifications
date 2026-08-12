import { Link, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getCertificates } from './features/certificates/api'

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

export function RootLayout() {
  return (
    <div className="app-shell">
      <header>
        <Link to="/" className="brand">FFPF Certifications</Link>
        <nav aria-label="メインナビゲーション">
          <Link to="/" activeOptions={{ exact: true }}>資格一覧</Link>
          <Link to="/certificates/new">認定証を登録</Link>
        </nav>
      </header>
      <main><Outlet /></main>
    </div>
  )
}

export function HomePage() {
  const certificates = useQuery({
    queryKey: ['certificates'],
    queryFn: getCertificates,
  })

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Fuwa Fuwa Pomodoro Federation</p>
        <h1>あらゆる達成に、連邦公認の証を。</h1>
        <p>実在する資格から、あなたにしか作れない認定まで自由に登録できます。</p>
        <Link to="/certificates/new" className="button">認定証を作る</Link>
      </section>

      <section className="certificates-section" aria-labelledby="certificates-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Federal registry</p>
            <h2 id="certificates-heading">連邦公認資格一覧</h2>
          </div>
          {certificates.data && <p className="certificate-count">登録数 {certificates.data.length}</p>}
        </div>

        {certificates.isPending && <p role="status" className="notice">資格を読み込んでいます…</p>}
        {certificates.isError && (
          <div className="notice notice-error" role="alert">
            <p>{certificates.error.message}</p>
            <button type="button" onClick={() => certificates.refetch()}>もう一度読み込む</button>
          </div>
        )}
        {certificates.data?.length === 0 && (
          <div className="empty-state">
            <p>まだ認定証は登録されていません。</p>
            <Link to="/certificates/new" className="button">最初の認定証を作る</Link>
          </div>
        )}
        {certificates.data && certificates.data.length > 0 && (
          <div className="certificate-grid">
            {certificates.data.map((certificate) => (
              <article className="certificate-card" key={certificate.id}>
                <div className="certificate-seal" aria-hidden="true">FFPF</div>
                <p className="certificate-label">Certificate of achievement</p>
                <h3>{certificate.title}</h3>
                <p className="recipient">{certificate.recipient}</p>
                <p className="description">{certificate.description}</p>
                <footer>
                  <span>認定日 {dateFormatter.format(new Date(`${certificate.issuedAt}T00:00:00Z`))}</span>
                  <span className="certificate-id">No. {certificate.id.slice(0, 8).toUpperCase()}</span>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
