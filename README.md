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

初回のE2E実行前にChromiumをインストールしてください。

```bash
pnpm exec playwright install chromium
```
