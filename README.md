# FFPF Certifications

Fuwa Fuwa Pomodoro Federationの連邦公認資格を作成・閲覧するWebアプリケーションです。

## 本番環境

- デプロイ先: Cloudflare Workers
- 本番URL: [https://ffpf-certifications.sparklingstadt.workers.dev/](https://ffpf-certifications.sparklingstadt.workers.dev/)
- 動作確認: 2026年9月3日に本番URLをブラウザで開き、連邦公認資格一覧を閲覧し、「認定証を作る」から認定証登録画面を開けることを確認しました。登録データの送信は行っていません。

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

## FFPF IDでのログイン

認定証の登録（`POST /api/certificates`）はFFPF IDでログインしている人だけができます。一覧の閲覧はログインなしでできます。
FFPF IDはffpf-portalのOpenID Connectプロバイダで、このWorkerは認可コードフロー＋PKCEのクライアントです。
IDトークンはportalのJWKSでES256の署名を検証し、ログイン状態は`FFPF_SESSION_SECRET`で署名したCookie（30日）に保持します。

| 名前 | 種類 | 内容 |
| --- | --- | --- |
| `FFPF_ID_ISSUER` | 変数（`wrangler.jsonc`） | portalのissuer（`https://ffpf-portal.vercel.app`） |
| `FFPF_ID_CLIENT_ID` | 変数（`wrangler.jsonc`） | `ffpf-certifications` |
| `FFPF_ID_CLIENT_SECRET` | シークレット | portalで発行したクライアントシークレット |
| `FFPF_SESSION_SECRET` | シークレット | Cookieの署名鍵（32文字以上の乱数） |

4つが揃っていないときはログインできず、認定証も登録できません。

本番の設定手順:

1. ffpf-portalで`pnpm run oidc:client ffpf-certifications`を実行し、出力されたハッシュと
   redirect URI `https://ffpf-certifications.sparklingstadt.workers.dev/api/auth/callback/ffpf`を
   portalの`FFPF_OIDC_CLIENTS`に追加して、portalを再デプロイします。
2. このWorkerにシークレットを設定します。

   ```bash
   pnpm exec wrangler secret put FFPF_ID_CLIENT_SECRET
   openssl rand -base64 48 | pnpm exec wrangler secret put FFPF_SESSION_SECRET
   ```

ローカルで`wrangler dev`を使う場合は、`.dev.vars`（Git管理外）に同じ名前で値を書きます。
redirect URIは`http://localhost:8787/api/auth/callback/ffpf`のように、開いているoriginから作られます。

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
