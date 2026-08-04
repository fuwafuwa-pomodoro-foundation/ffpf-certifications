# FFPF Certifications

Fuwa Fuwa Pomodoro Federationの連邦公認資格を作成・閲覧するWebアプリケーションです。

## 開発

```bash
pnpm install
pnpm dev
```

## コマンド

- `pnpm dev` — 開発サーバー
- `pnpm build` — 型チェックと本番ビルド
- `pnpm lint` — ESLint
- `pnpm test:e2e` — Playwright E2Eテスト
- `pnpm deploy` — ビルドしてCloudflare Workersへデプロイ

## Cloudflare Builds

Cloudflare WorkersのGit連携では、次の設定を使用します。

- Production branch: `main`
- Build command: `pnpm build`
- Deploy command: `pnpm wrangler deploy`
- Root directory: `/`

初回のE2E実行前にChromiumをインストールしてください。

```bash
pnpm exec playwright install chromium
```
