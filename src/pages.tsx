import { Link, Outlet } from '@tanstack/react-router'

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
  return (
    <section className="hero">
      <p className="eyebrow">Fuwa Fuwa Pomodoro Federation</p>
      <h1>あらゆる達成に、連邦公認の証を。</h1>
      <p>実在する資格から、あなたにしか作れない認定まで自由に登録できます。</p>
      <Link to="/certificates/new" className="button">最初の認定証を作る</Link>
    </section>
  )
}
