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

## D1

認定証はCloudflare D1の`ffpf-certifications-db`に保存されます。

```bash
pnpm exec wrangler d1 migrations apply ffpf-certifications-db --local
pnpm exec wrangler d1 migrations apply ffpf-certifications-db --remote
```

ローカルでWorker APIとD1を含めて確認する場合は、先に`pnpm build`を実行してから
`pnpm exec wrangler dev`を使用します。

## Cloudflare Builds

Cloudflare WorkersのGit連携では、次の設定を使用します。

- Production branch: `main`
- Build command: `pnpm build`
- Deploy command: `pnpm wrangler deploy`
- Root directory: `/`

`main`ブランチへのpushはCloudflare Buildsによって自動的に本番へデプロイされます。

初回のE2E実行前にChromiumをインストールしてください。

```bash
pnpm exec playwright install chromium
```
