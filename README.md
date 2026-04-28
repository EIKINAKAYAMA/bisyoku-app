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

## 前提ツール

| ツール | 用途 |
|---|---|
| Node.js 20+ / npm | フロントエンドビルド |
| [Supabase CLI](https://supabase.com/docs/guides/local-development) | ローカル DB / Auth / Functions |
| Docker Desktop | Supabase ローカルスタック起動用 |
| `gh`（GitHub CLI、任意） | Secrets 登録の自動化 |

```bash
# 初回のみ
brew install supabase/tap/supabase
supabase login                         # ブラウザが開いてアクセストークンを取得・保存
```

## 環境変数の方針

| 利用シーン | 値の置き場所 |
|---|---|
| ローカル開発 (`npm run dev`) | リポジトリ直下の `.env`（git 管理外） |
| 本番ビルド（CI / GitHub Pages） | リポジトリ Secrets（GitHub Actions が注入） |

`.env`、`.env.*` は全て `.gitignore` 済み。

クライアント変数（`VITE_PUBLIC_` プレフィクスはビルド時にクライアントへ露出する前提）：

```env
VITE_PUBLIC_SUPABASE_URL=...
VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Edge Function 用 Secret（クライアント露出 NG・`supabase secrets set` で登録）：

```
SIGNUP_PASSPHRASE_HASH    # SHA-256(salt + passphrase) hex
SIGNUP_PASSPHRASE_SALT    # ランダム 32 文字
```

---

# ローカル環境での開発手順

> 日常的な開発作業はこれだけで完結します。

## 1. クローンと依存インストール

```bash
git clone <this-repo>
cd bisyoku-app
npm install
```

## 2. Supabase ローカルスタックを起動

Docker Desktop が動いている状態で：

```bash
supabase start          # 初回は数分かかる（イメージ pull）
supabase status         # API URL と Publishable Key を表示
```

## 3. `.env` を作成

`supabase status` の出力からコピー：

```env
VITE_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<status の "publishable key" or "anon key">
```

## 4. マイグレーションを適用

```bash
supabase db reset       # supabase/migrations/ を全て適用 + health 行 INSERT
```

## 5. DB 型を再生成（推奨）

```bash
npm run db:types        # src/types/database.ts を本物の生成型に差し替え
```

## 6. （任意）Edge Function と Google OAuth をローカル実行

> 「dev login ボタン」だけで UI 開発は完結します。**実際のサインアップフロー**（合言葉 + Google OAuth）をローカルで試したい場合のみ以下を実施してください。

### 6-a. `supabase/.env` を埋める

雛形がリポジトリに含まれています（値は git 管理外）。以下のキーを入力：

```env
# Google OAuth Provider 用
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<Google Cloud Console の Client ID>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<Google Cloud Console の Client Secret>

# 合言葉検証 Edge Function 用
SIGNUP_PASSPHRASE_SALT=<下記スクリプトで生成>
SIGNUP_PASSPHRASE_HASH=<下記スクリプトで生成>
```

ハッシュ生成（fish shell の場合は bash 経由）：

```fish
bash -c '
SALT=$(openssl rand -hex 16)
HASH=$(printf "%s" "${SALT}<合言葉>" | shasum -a 256 | awk "{print \$1}")
echo "SIGNUP_PASSPHRASE_SALT=$SALT"
echo "SIGNUP_PASSPHRASE_HASH=$HASH"
'
```

`<合言葉>` を実際の合言葉に置換してから実行。出力された SALT と HASH を `supabase/.env` に貼り付け。

### 6-b. Supabase を再起動して env を反映

```bash
supabase stop
supabase start          # supabase/.env を自動的に読み直す
```

### 6-c. Edge Function をローカル起動

別ターミナルで：

```bash
supabase functions serve verify-passphrase --env-file supabase/.env
```

## 7. 開発サーバ起動

```bash
npm run dev             # http://localhost:5173
```

ログイン画面下部の **「DEV ONLY · seed されたテストユーザー」**ブロックに **開発ユーザー 1 / 2** ボタンが表示されます（`import.meta.env.DEV` のときのみ）。クリック 1 回で Google OAuth を経由せず即ログインでき、UI を試せます。

`supabase/seed.sql` が用意するテストユーザー：

| Email | Password | display_name |
|---|---|---|
| `dev1@local.test` | `devpass` | 開発ユーザー1 |
| `dev2@local.test` | `devpass` | 開発ユーザー2 |

> seed.sql は `supabase db reset` 時にだけ走ります。`supabase db push` には含まれないので本番には流れません。

## 日常で使うコマンド

| コマンド | 用途 |
|---|---|
| `npm run dev` | Vite 開発サーバ |
| `npm run typecheck` | 型チェック |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 一括フォーマット |
| `npm run test` | Vitest |
| `npm run build` | 本番ビルド（手元での確認用） |
| `npm run preview` | 本番ビルドのローカルプレビュー |
| `npm run db:types` | Supabase の型を再生成（ローカル DB 起動中前提） |
| `supabase db reset` | マイグレーションを全適用し直す |
| `supabase stop` | ローカル Supabase を停止 |

---

# 初回本番デプロイに向けてやること

> 1 度だけ行うセットアップ作業。完了後は「2回目以降のデプロイ」フローに移行します。

## A. Supabase 本番プロジェクトの準備

> migration の適用と Edge Function のデプロイは **CI が自動でやる**ので、ここでは「Supabase 側でしか設定できないこと」だけやります。

### A-1. プロジェクト作成

1. [supabase.com](https://supabase.com) で新規プロジェクトを作成
2. 控えておく値（後で使う）：
   - **Project URL**：`https://<project-ref>.supabase.co`
   - **Project Reference ID**（`<project-ref>` の部分）
   - **Publishable Key**（`sb_publishable_...`）
   - **Database password**（プロジェクト作成時に設定したもの）

### A-2. 合言葉ハッシュを Edge Function Secret に登録

CI は Edge Function コードのみデプロイし、**合言葉ハッシュ Secret は CI に渡さない**（GitHub Secrets に置くと `gh secret list` で見られて事故りやすい）。代わりに Supabase 側に直接登録します。

bash で実行（fish なら `bash -c '...'` で包む）：

```bash
SALT=$(openssl rand -hex 16)
HASH=$(printf "%s" "${SALT}<合言葉>" | shasum -a 256 | awk '{print $1}')
supabase secrets set \
  --project-ref <project-ref> \
  SIGNUP_PASSPHRASE_SALT="$SALT" \
  SIGNUP_PASSPHRASE_HASH="$HASH"
```

> **重要**：この Secret が無いと CI でデプロイされた Edge Function は実行時に `server_misconfigured` で落ちます（=サインアップできない）。**初回デプロイの前に必ずやる**。

## B. Google OAuth Provider の設定（2 箇所必須）

> どちらか片方だけだと OAuth は動きません。

### B-1. Google Cloud Console

[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials：

1. **OAuth 2.0 Client ID** を作成（Application type: Web application）
2. **Authorized redirect URIs** に以下を登録：
   - `https://<project-ref>.supabase.co/auth/v1/callback`（本番）
   - `http://127.0.0.1:54321/auth/v1/callback`（ローカル開発用）
3. 発行された **Client ID** と **Client Secret** を控える

### B-2. Supabase ダッシュボード

該当プロジェクト → **Authentication**：

1. **Providers → Google** を **Enable**
2. B-1 で控えた Client ID / Client Secret を入力 → Save
3. **URL Configuration**：
   - **Site URL**：`https://<github-user>.github.io/bisyoku-app/`
   - **Additional Redirect URLs**：`http://localhost:5173/`、`http://127.0.0.1:5173/`

## C. GitHub Pages の有効化

リポジトリ → **Settings → Pages**：

- **Source = GitHub Actions** を選択

## D. リポジトリ Secrets / Variables を登録

リポジトリ → **Settings → Secrets and variables → Actions**

### Secrets タブ（暗号化）

| Secret 名 | 値 | 取得方法 |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | `sbp_xxxxxxxxxxxxxxx` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → Generate new token |
| `SUPABASE_DB_PASSWORD` | `<DB password>` | プロジェクト作成時のもの。忘れた場合は Database 設定から reset |
| `VITE_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Project Settings → API |
| `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_xxx...` | 同上 |

### Variables タブ（平文）

| Variable 名 | 値 |
|---|---|
| `SUPABASE_PROJECT_REF` | `sokzieoytjuwnloujhne`（URL の `<ref>` 部分） |

### `gh` CLI で一括登録する場合

```bash
gh secret set SUPABASE_ACCESS_TOKEN --body "sbp_xxx"
gh secret set SUPABASE_DB_PASSWORD --body "<password>"
gh secret set VITE_PUBLIC_SUPABASE_URL --body "https://<ref>.supabase.co"
gh secret set VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY --body "<publishable_key>"
gh variable set SUPABASE_PROJECT_REF --body "<ref>"
```

> 本番値はリポジトリ Secrets / Variables が**唯一の正**です。`.env` 系ファイルに置く必要はありません。

## E. 初回デプロイの実行

ここまで A〜D が完了していれば、`main` にコードを push するだけで全自動デプロイされます。

```bash
git push origin main
```

`.github/workflows/deploy.yml` が走り、以下が直列＋部分並列で実行されます：

```
[migrate]  Supabase に migration 適用（supabase db push）
   ├─→ [functions]  verify-passphrase Edge Function を deploy
   └─→ [build]      フロントエンドをビルド（Secrets を env として注入）
                       └─→ [deploy] GitHub Pages に公開
```

Actions タブで進行状況を見られます。各 job が緑になれば完了。
本番 URL：`https://<github-user>.github.io/bisyoku-app/`

### 初回デプロイで失敗しがちなポイント

| 失敗箇所 | 原因 |
|---|---|
| `migrate` job が `password authentication failed` | `SUPABASE_DB_PASSWORD` の値が違う |
| `migrate` job が `Invalid project ref` | `SUPABASE_PROJECT_REF` Variable が未登録または値が違う |
| `functions` job が `Access token not provided` | `SUPABASE_ACCESS_TOKEN` が未登録 |
| サインアップで `server_misconfigured` | A-2 の `supabase secrets set` をやっていない |
| Google ログインで 404 | B-1 の Google Cloud Console 側登録漏れ |

## F. keepalive ワークフローの疎通確認

GitHub Actions タブ → **Supabase Keepalive** → **Run workflow** で手動実行 → ✅ Success を確認。
以降、毎日 03:00 JST に自動実行され、Free Tier の自動 Pause を防ぎます。

## G. 動作確認チェックリスト

- [ ] `https://<github-user>.github.io/bisyoku-app/` にアクセスしてログイン画面が表示される
- [ ] 新規登録で合言葉と Google OAuth を通せる
- [ ] 店舗を新規登録できる
- [ ] 訪問・評価を追加できて、平均値が更新される
- [ ] 別アカウントで同じ店舗に評価を追加できる
- [ ] PWA としてホーム画面に追加できる（スマホで確認）

---

# 2 回目以降のデプロイ手順

> 通常運用。コードを変更したい時はこれだけ。

## 通常フロー

```bash
# 1. 作業ブランチを切る
git checkout -b feature/xxx

# 2. 変更
# ... 編集 ...

# 3. ローカル検証
npm run typecheck
npm run lint
npm run build      # 本番相当のビルドでエラーが出ないことを確認

# 4. コミット & push
git commit -m "<変更内容>"
git push origin feature/xxx

# 5. PR 作成（CI が lint / typecheck / build を走らせる）
gh pr create --fill

# 6. レビュー後 main にマージ
#    → .github/workflows/deploy.yml が自動で GitHub Pages にデプロイ
```

`main` への push だけでデプロイされるので、軽微な修正なら直接 main に commit & push でも OK。

## DB スキーマ変更を伴う場合

```bash
# 1. 新しい migration を作成
supabase migration new <name>             # supabase/migrations/<timestamp>_<name>.sql 生成

# 2. SQL を書く

# 3. ローカルで全適用して動作確認
supabase db reset

# 4. 型を再生成（コミット必須）
npm run db:types

# 5. 通常フローで PR → main マージ
#    → CI が自動で supabase db push を実行
```

> migration は CI で自動適用されます（`.github/workflows/deploy.yml` の `migrate` job）。

## Edge Function を変更する場合

```bash
# ローカルで動作確認
supabase functions serve verify-passphrase --env-file supabase/.env

# main にマージ
#   → CI が自動で supabase functions deploy verify-passphrase を実行
```

## 合言葉を変更したい

bash で実行（fish なら `bash -c '...'` で包む）：

```bash
SALT=$(openssl rand -hex 16)
HASH=$(printf "%s" "${SALT}<新しい合言葉>" | shasum -a 256 | awk '{print $1}')
supabase secrets set SIGNUP_PASSPHRASE_SALT="$SALT" SIGNUP_PASSPHRASE_HASH="$HASH"
```

Edge Function 再デプロイ不要（Secrets を読み直す）。

## ロールバックしたい

```bash
git revert <bad-commit-sha>
git push origin main
# → 自動で前のバージョンが再デプロイされる
```

または GitHub Actions タブから過去の成功した **Deploy to GitHub Pages** ワークフローを **Re-run** でも可能。

---

## 運用メモ

### Supabase が Pause した場合の復旧

毎日の keepalive で防いでいますが、万一 Pause した場合：

1. Supabase ダッシュボード → 該当プロジェクト → **Restore project** をクリック
2. GitHub Actions → **Supabase Keepalive** → **Run workflow** を 1 度走らせて疎通確認

API からは起こせない仕様です（手動 Restore のみ）。

### 招待を増やしたい

合言葉を新メンバーに伝えるだけ。サインアップ画面で合言葉と Google ログインを完了すると `allowed_emails` テーブルに自動追加され、以降は通常ログイン可能。

---

## ディレクトリ構成

```
.
├── .github/workflows/         CI / Deploy / Keepalive
├── public/                    静的アセット・PWA アイコン
├── src/
│   ├── components/            汎用コンポーネント（shadcn/ui を含む）
│   ├── features/              機能単位のモジュール（auth / restaurants / visits / genres / users）
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
| `npm run dev` 起動時に "Supabase env vars missing" | `.env` に値が入っていない／`supabase start` が起動していない／`.env` 編集後に dev サーバを再起動していない |
| 操作がもっさり、古い画面が出る | 過去のビルドで Service Worker が登録された残留。DevTools → Application → Service Workers → Unregister ＋ Clear site data ＋ ハードリロード |
| dev login で「未招待のアカウント」になる | `supabase db reset` で seed.sql が走っていない（profiles に dev ユーザー行が無い） |
| OAuth ログイン後に "未招待のアカウント" | Edge Function が未デプロイ／`SIGNUP_PASSPHRASE_*` 未設定／合言葉が違う |
| ログインボタンを押しても Google に飛ばない | Supabase ダッシュボードで Google Provider が Enable されていない |
| Google から戻ってくると 404 | OAuth Client の Authorized redirect URIs に `https://<ref>.supabase.co/auth/v1/callback` が無い |
| デプロイ後に画面が真っ白 | リポジトリ Secrets 未登録のままビルドされ env が空／`vite.config.ts` の `base` がリポジトリ名と不一致 |
| Pages にアクセスするとアセット 404 | `vite.config.ts` の `base` を `/<repo-name>/` に。カスタムドメイン使用時は `'/'` |
| CI の `migrate` が `password authentication failed` | `SUPABASE_DB_PASSWORD` Secret 未登録 or 値が違う |
| CI の `migrate` が `Invalid project ref` | `SUPABASE_PROJECT_REF` Variable 未登録 or 値が違う |
| CI の `functions` が `Access token not provided` | `SUPABASE_ACCESS_TOKEN` Secret 未登録（[ここで生成](https://supabase.com/dashboard/account/tokens)） |
| migration push が `migration already exists` | 過去にローカルで `supabase db push` 済。CI が再適用しようとして衝突。`supabase migration repair` で履歴を修復するか、CI のキャッシュ消す |
