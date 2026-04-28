# bisyoku-app

家族・友人グループ向けの招待制 飲食店レビュー SPA。完全無料運用（GitHub Pages + Supabase Free Tier）。

- 招待制サインアップ：Google SSO + 合言葉
- 店舗マスタは共有、訪問・5 軸 10 段階評価はユーザー個別
- 訪問なしの「店舗だけ登録」も可
- 店名 / ジャンル / 価格帯 / 評価でフィルタ
- スマホ中心利用 → PWA + レスポンシブ
- 写真・動画アップロードは対象外（Free Tier 容量保護のため）

> 設計方針・データモデル・RLS・認証フローの詳細は [`CLAUDE.md`](./CLAUDE.md) を参照してください。

---

## 技術スタック

- **Frontend**：React 18 + Vite 5 + TypeScript / Tailwind CSS + shadcn/ui / TanStack Query / React Hook Form + Zod / React Router (HashRouter)
- **PWA**：vite-plugin-pwa（Workbox）
- **Backend**：Supabase（Postgres + Auth + Edge Functions）
- **Hosting**：GitHub Pages
- **CI/CD**：GitHub Actions

---

## 前提

| ツール | 用途 |
|---|---|
| Node.js 20+ | フロントエンドビルド |
| npm | パッケージマネージャ |
| [Supabase CLI](https://supabase.com/docs/guides/local-development) | ローカル DB / Auth / Functions |
| Docker Desktop | Supabase ローカルスタック起動用 |
| `gh` (GitHub CLI) | （任意）Secrets 登録の自動化に便利 |

```bash
# 初回のみ
brew install supabase/tap/supabase
```

---

## 環境変数

Vite の env 読み込み規約を使い分け、本番値が dev に漏れない構成にしています。

| ファイル | いつ読まれるか | 中身 | git |
|---|---|---|---|
| `.env.development.local` | `npm run dev` | ローカル Supabase の URL ＋ Publishable Key | 管理外 |
| `.env.production.local` | ローカルで `npm run build` する時 | 本番 Supabase の URL ＋ Publishable Key | 管理外 |
| GitHub Actions Secrets | CI ビルド・keepalive 実行時 | 本番値 | リポジトリ Secrets |

クライアント側変数（`VITE_PUBLIC_*` プレフィクスはクライアントへ露出する前提）：

```env
VITE_PUBLIC_SUPABASE_URL=...
VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Edge Function Secret（クライアントに露出させない／`supabase secrets set` で登録）：

```
SIGNUP_PASSPHRASE_HASH    # SHA-256(salt + passphrase) hex
SIGNUP_PASSPHRASE_SALT    # ランダム 32 文字
```

---

## ローカル開発手順

### 1. リポジトリを取得して依存をインストール

```bash
git clone <this-repo>
cd bisyoku-app
npm install
```

### 2. Supabase ローカルスタックを起動

Docker Desktop が起動している状態で：

```bash
supabase start          # 初回は数分かかる
supabase status         # 出力された URL と anon/publishable key をメモ
```

### 3. `.env.development.local` を埋める

`supabase status` の出力からコピー：

```env
VITE_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
```

### 4. マイグレーションを適用

```bash
supabase db reset       # supabase/migrations/ を全て適用 + health 行 INSERT
```

### 5. DB 型を再生成（推奨）

```bash
npm run db:types        # src/types/database.ts を本物に置き換える
```

### 6. Edge Function をローカルで動かす（任意）

```bash
# 別ターミナル
supabase functions serve verify-passphrase --env-file ./supabase/functions/.env.local
```

`./supabase/functions/.env.local`（git 管理外）：

```env
SIGNUP_PASSPHRASE_HASH=...
SIGNUP_PASSPHRASE_SALT=...
```

ハッシュ生成例：

```bash
SALT=$(openssl rand -hex 16)
HASH=$(printf "%s" "${SALT}<合言葉>" | shasum -a 256 | awk '{print $1}')
echo "SALT=$SALT"
echo "HASH=$HASH"
```

### 7. 開発サーバ起動

```bash
npm run dev             # http://localhost:5173 で起動
```

---

## 利用可能なスクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | Vite 開発サーバ |
| `npm run build` | 本番ビルド（型チェック → vite build） |
| `npm run preview` | 本番ビルドのローカル確認 |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 一括フォーマット |
| `npm run test` | Vitest |
| `npm run db:types` | Supabase の型を生成（ローカル DB 起動中前提） |

---

## 本番デプロイ手順（初回セットアップ）

> ローカル開発が動いた後の作業です。

### 1. Supabase 本番プロジェクトを作成

[supabase.com](https://supabase.com) で新規プロジェクトを作成 → プロジェクト URL と Publishable Key を控える。

### 2. ローカルからリンクしてマイグレーションを反映

```bash
supabase link --project-ref <project-ref>
supabase db push                                    # migrations/ を本番へ
```

### 3. Edge Function を本番にデプロイ

```bash
# Secrets 登録（本番）
supabase secrets set SIGNUP_PASSPHRASE_SALT="$SALT" SIGNUP_PASSPHRASE_HASH="$HASH"

# デプロイ
supabase functions deploy verify-passphrase
```

### 4. Google OAuth Provider を設定

両方の登録が必要です（片方だけだと OAuth が動きません）。

**Google Cloud Console**（OAuth 2.0 Client → Authorized redirect URIs）：
- `https://<project-ref>.supabase.co/auth/v1/callback`（本番）
- `http://127.0.0.1:54321/auth/v1/callback`（ローカル開発用）

**Supabase ダッシュボード** → **Authentication**：
- **Providers → Google** を Enable し、上記で取得した Client ID / Client Secret を入力
- **URL Configuration**：
  - Site URL：`https://<github-user>.github.io/bisyoku-app/`
  - Additional Redirect URLs：`http://localhost:5173/`、`http://127.0.0.1:5173/`

### 5. GitHub Pages を有効化

GitHub リポジトリ → **Settings → Pages**：
- **Source = GitHub Actions** に設定

### 6. リポジトリ Secrets を登録

**Settings → Secrets and variables → Actions** → **New repository secret**：

| Name | Value |
|---|---|
| `VITE_PUBLIC_SUPABASE_URL` | 本番 Supabase URL |
| `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 本番 Publishable Key |

`gh` CLI を使う場合：

```bash
gh secret set VITE_PUBLIC_SUPABASE_URL --body "https://<ref>.supabase.co"
gh secret set VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY --body "<key>"
```

### 7. main へ push して初回デプロイ

```bash
git push origin main
# → .github/workflows/deploy.yml が走り GitHub Pages へ反映
```

`https://<github-user>.github.io/bisyoku-app/` でアクセス確認。

### 8. keepalive ワークフローの疎通確認

GitHub Actions タブ → **Supabase Keepalive** → **Run workflow** で手動実行 → 成功を確認。
以降、毎日 03:00 JST に自動で叩かれて Supabase の自動 Pause を防ぎます。

---

## 通常のデプロイフロー

`main` に push すると自動で GitHub Pages へデプロイされます。

```bash
git checkout -b feature/xxx
# ... 変更
npm run typecheck && npm run lint && npm run build
git commit -m "..."
git push origin feature/xxx
# PR → main へマージ → 自動デプロイ
```

PR には CI（lint / typecheck / build）が走ります。

---

## 運用メモ

### Supabase が Pause した場合

毎日の keepalive で防止していますが、万一 Pause した場合は手動復旧が必要：

1. Supabase ダッシュボード → 該当プロジェクト → **Restore project**
2. Actions の **Supabase Keepalive** を `workflow_dispatch` で 1 度走らせて疎通確認

### 合言葉を変更したい

```bash
SALT=$(openssl rand -hex 16)
HASH=$(printf "%s" "${SALT}<新しい合言葉>" | shasum -a 256 | awk '{print $1}')
supabase secrets set SIGNUP_PASSPHRASE_SALT="$SALT" SIGNUP_PASSPHRASE_HASH="$HASH"
```

Edge Function は再デプロイ不要（Secrets を読み直す）。

### マイグレーションを追加する

```bash
supabase migration new <name>             # supabase/migrations/<timestamp>_<name>.sql 生成
# SQL を書く
supabase db reset                          # ローカル全適用で動作確認
supabase db push                           # 本番反映
npm run db:types                           # 型再生成
```

---

## ディレクトリ構成

```
.
├── .github/workflows/         CI / Deploy / Keepalive
├── public/                    静的アセット・PWA アイコン
├── src/
│   ├── components/            汎用コンポーネント（shadcn/ui を含む）
│   ├── features/              機能単位のモジュール（auth / restaurants / visits / genres / users）
│   ├── hooks/                 グローバルフック
│   ├── lib/                   Supabase クライアント等
│   ├── pages/                 ルートに対応するページ
│   ├── types/                 共有型・DB 型
│   └── App.tsx, main.tsx, ...
├── supabase/
│   ├── migrations/            SQL マイグレーション
│   ├── functions/
│   │   └── verify-passphrase/ 招待制サインアップの合言葉検証 Edge Function
│   └── config.toml            ローカル開発設定
├── CLAUDE.md                  設計方針・アーキテクチャ・データモデル・RLS の詳細
└── README.md                  本ファイル
```

---

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `npm run dev` 起動時に "Supabase env vars missing" | `.env.development.local` に値が入っていない／`supabase start` が起動していない |
| OAuth ログイン後に "未招待のアカウント" になる | Edge Function が未デプロイ／`SIGNUP_PASSPHRASE_*` 未設定／合言葉が違う |
| ログイン押しても Google に飛ばない | Supabase ダッシュボードで Google Provider が Enable されていない |
| Google から戻ってくると 404 | OAuth 2.0 Client の Authorized redirect URIs に `https://<ref>.supabase.co/auth/v1/callback` が無い |
| デプロイ後アセットが 404 | `vite.config.ts` の `base` がリポジトリ名と一致していない（カスタムドメイン使用時は `'/'` に） |
| Pages が真っ白 | リポジトリ Secrets 未登録のままビルドされ、env が空 |
