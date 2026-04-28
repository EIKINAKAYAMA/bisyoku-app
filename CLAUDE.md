# bisyoku-app

家族・友人グループ向けの飲食店レビュー SPA。完全無料運用が前提。

## プロダクト要件サマリ

- 招待制（Google SSO + 合言葉）の小規模クローズドサービス
- 店舗マスタは共有、訪問・評価はユーザー個別に紐付く
- 評価は 5 軸 × 1〜10 段階（総合・料理・サービス・雰囲気・コスパ）
- 訪問記録なしの「店舗のみ登録」も可（誰も行ったことのない店を先に登録できる）
- 一覧は平均値表示、詳細で個別評価を確認
- 各ユーザーが訪問した店舗の一覧ページを持つ
- スマホ中心利用 → PWA 化必須、レスポンシブ必須
- **写真・動画アップロードは対象外**（無料枠 Storage 容量の制約と、登録ハードルを下げる目的）

詳細仕様は `README.md` を参照。

## 技術スタック

| レイヤ | 採用 |
|---|---|
| 言語 | TypeScript |
| フレームワーク | React 18 + Vite |
| ルーティング | React Router v6（`HashRouter`：GitHub Pages のサブパス配信に最も堅牢） |
| UI | Tailwind CSS + shadcn/ui |
| フォーム/バリデーション | React Hook Form + Zod |
| サーバ状態管理 | TanStack Query |
| データ層 | Supabase（Postgres / Auth / Edge Functions） |
| PWA | `vite-plugin-pwa`（Workbox） |
| ホスティング | GitHub Pages（`actions/deploy-pages`） |
| Lint / Format | ESLint + Prettier |
| テスト | Vitest + React Testing Library（最小限） |

## アーキテクチャ要点

### 認証フロー（招待制）

SPA のコードは全てクライアントに露出するため、**合言葉は絶対にフロントへ埋め込まない**。
また「Google で認証された本人のメール」と「合言葉を通したメール」を一致させるため、**合言葉照合は OAuth の後**に行う。

1. `/signup` で合言葉を入力 → クライアントが `sessionStorage` に保存：
   - `auth_intent = 'signup'`
   - `signup_passphrase = <入力値>`
2. Google OAuth へリダイレクト
3. コールバック後、クライアントは `auth_intent` を見て分岐：
   - `'signup'` の場合：Edge Function `verify-passphrase` を呼び出す（`{ passphrase }` ＋ `Authorization: Bearer <access_token>`）→ 成功時 sessionStorage クリア
   - それ以外（`/login` 経由）：`profiles` 存在チェック → 不在なら `signOut()` ＋ `/login?error=not-invited` へ
4. Edge Function：JWT を検証 → email を抽出（**email 形式 regex で defensive validation**）→ 合言葉ハッシュ照合
   - OK：`allowed_emails` 追加 ＋ `profiles` 作成（`display_name` / `avatar_url` を `auth.users.raw_user_meta_data` の `full_name` / `avatar_url` から自動コピー）
   - NG：`supabase.auth.admin.deleteUser(user_id)` で巻き戻し → クライアント側で `supabase.auth.signOut()` ＋ エラー表示 ＋ `/signup` 再試行へ遷移
5. 通常ログインは `/login` で Google OAuth のみ
6. ログイン後の権限判定は「`profiles` レコードが存在すること」で行う（RLS で `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())` を共通条件にする）

**Edge Function の CORS**：GitHub Pages → `*.supabase.co` は別オリジン。`verify-passphrase` 内で以下を明示する必要がある（書かないとブラウザに弾かれる）：

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// OPTIONS プリフライトには 200 + corsHeaders を即返す
```

**判明しているエッジケース（仕様として割り切る）**：

- **OAuth リダイレクト中にタブを閉じる / 別タブで戻る** → sessionStorage 上の合言葉が失われ、コールバック分岐が `'signup'` でなくなる。クライアントは「`profile` 不在 ＋ 合言葉なし」を検知したらサインアウトし `/signup` に戻す。家族・友人運用前提なので追加対策はしない。
- **孤児 `auth.users`**（OAuth 通過後に `verify-passphrase` 完了せず離脱）はクリーンアップしない。無料枠の DB 容量を圧迫しないため放置。
- **`genres` 同時作成 race（UNIQUE 違反）** → クライアントは挿入失敗を検知したら「すでに存在します。再選択してください」を表示し、`genres` を refetch して既存値を選ばせる。サーバ側は何もしない。

**合言葉ハッシュの方式**：守るべきは単一の固定値（DB のパスワード一覧ではない）。argon2/bcrypt のような外部依存は不要で、Edge Function 内で `crypto.subtle.digest('SHA-256', ...)` ＋ ソルト ＋ 定数時間比較で十分。Secret には `SIGNUP_PASSPHRASE_HASH`（hex 文字列）と `SIGNUP_PASSPHRASE_SALT` を別々に登録する。

**OAuth の URL 設定は 2 箇所**（どちらか片方だけ忘れると確実に動かない）：

1. **Google Cloud Console**（OAuth 2.0 Client の Authorized redirect URIs）
   - `https://<project-ref>.supabase.co/auth/v1/callback`（本番 Supabase）
   - `http://127.0.0.1:54321/auth/v1/callback`（ローカル Supabase）

2. **Supabase ダッシュボード**（Authentication → URL Configuration）
   - Site URL：`https://<github-user>.github.io/bisyoku-app/`
   - Additional Redirect URLs：`http://127.0.0.1:5173/`

### データモデル（初期案）

```
profiles            -- auth.users と 1:1
  id            uuid PK = auth.users.id   ON DELETE CASCADE
  display_name  text NOT NULL
  avatar_url    text
  created_at    timestamptz DEFAULT now()

allowed_emails      -- 招待許諾リスト（Edge Function だけが書き込める）
  email         text PK
  created_at    timestamptz DEFAULT now()

genres              -- ユーザー追加可
  id            uuid PK
  name          text UNIQUE NOT NULL  -- 挿入時に trim + NFKC 正規化
  created_by    uuid FK profiles      ON DELETE SET NULL
  created_at    timestamptz DEFAULT now()

restaurants         -- 店舗マスタ（共有）
  id            uuid PK
  name          text NOT NULL
  link          text
  genre_id      uuid FK genres        ON DELETE RESTRICT
  price_range   price_range_enum NOT NULL
  created_by    uuid FK profiles      ON DELETE SET NULL
  created_at    timestamptz DEFAULT now()
  -- price_range_enum: '〜2000','2000〜5000','5000〜10000','10000〜20000','20000〜'

visits              -- 訪問記録（任意）
  id            uuid PK
  restaurant_id uuid FK restaurants   ON DELETE CASCADE
  user_id       uuid FK profiles      ON DELETE CASCADE
  visit_date    date                  -- nullable
  order_content text
  payment_amount integer              -- 円・小数なし、CHECK >= 0
  created_at    timestamptz DEFAULT now()

ratings             -- 評価（visit に 0..1 で紐付く）
  id            uuid PK
  visit_id      uuid FK visits UNIQUE ON DELETE CASCADE
  overall, food, service, atmosphere, cost_performance
                smallint NOT NULL CHECK (BETWEEN 1 AND 10)

health              -- Pause 防止 cron 用の単一行テーブル
  id            smallint PK CHECK (id = 1)
  pinged_at     timestamptz DEFAULT now()
  -- マイグレーションでは INSERT (id) VALUES (1) ON CONFLICT (id) DO NOTHING で投入する
```

集計用に `restaurant_rating_summary` VIEW を定義し、平均値はクライアントで計算しない。
VIEW には `avg_overall, avg_food, avg_service, avg_atmosphere, avg_cost_performance, rating_count` を含める（未評価店舗も `rating_count = 0` で必ず行が出るよう LEFT JOIN）。

### Row Level Security（RLS）

- `profiles`: 全ログインユーザー読み取り可、本人のみ更新可
- `restaurants` / `genres`: 全ログインユーザー読み取り・作成可、作成者のみ更新可
- `visits` / `ratings`: 全ログインユーザー読み取り可、本人のみ作成・更新・削除可
- `allowed_emails`: クライアントから一切アクセス不可（Service Role のみ）
- `health`: anon ロールでも SELECT 可（Pause 防止 cron が認証なしで叩くため）。INSERT/UPDATE/DELETE は不可
- 全ポリシー共通（`health` 除く）：`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())` を満たすこと（招待制ガード）

### Pause 防止（Free Tier 休眠回避）

Supabase Free Tier は **1 週間 API 無アクセスでプロジェクトが自動 Pause** する。家族・友人のたまの利用では確実に踏むので、外部からの定期アクセスで生存させる。

- GitHub Actions の cron（`.github/workflows/keepalive.yml`）が **毎日 03:00 JST に Supabase REST API を叩く**
- 叩く先：`GET /rest/v1/health?select=id&limit=1`（anon SELECT 可の単一行テーブル）
- Action は publishable key のみ使用（Service Role 不要 → secrets 漏洩リスク最小）
- 失敗しても通知はしない（hobby app）。週次でログを確認できるよう Actions の履歴を見る運用
- pg_cron は使わない（プロジェクト Pause 中は pg_cron も止まるため意味がない）
- **万一 Pause された場合の復旧**：Supabase ダッシュボード → プロジェクト → "Restore project" を**手動で押す**（API からは起こせない）。その後 keepalive を `workflow_dispatch` で 1 度走らせて疎通確認。

### PWA

- `vite-plugin-pwa` の `registerType: 'autoUpdate'`
- Service Worker で静的アセットのみキャッシュ
- **Supabase オリジン（`*.supabase.co` / `127.0.0.1:54321`）はキャッシュ対象外**にする（古い API レスポンス・期限切れ JWT を返さないため）
- アプリシェルだけオフライン対応（API レスポンスのオフライン化はやらない）
- アイコン・スプラッシュ：`public/icons/` に格納、`manifest.webmanifest` で指定

### ルーティング（HashRouter 前提）

```
/                       一覧（フィルタ：店名・ジャンル・価格帯・各評価）
/restaurants/new        店舗登録（評価/訪問なしでも可）
/restaurants/:id        店舗詳細（個別の訪問・評価が並ぶ）
/restaurants/:id/visits/new   訪問・評価を追加
/users/:id              ユーザーが訪問した店舗一覧
/me                     自分のプロフィール
/login                  Google OAuth
/signup                 合言葉入力 → Google OAuth
```

## ディレクトリ構成

```
bisyoku-app/
├── .github/workflows/        CI / Deploy
├── public/                   静的アセット、PWA アイコン
├── src/
│   ├── components/           汎用コンポーネント
│   │   └── ui/               shadcn/ui で生成したもの
│   ├── features/             機能単位のモジュール
│   │   ├── auth/
│   │   ├── restaurants/
│   │   ├── visits/
│   │   ├── ratings/
│   │   └── users/
│   ├── hooks/                グローバルフック
│   ├── lib/
│   │   ├── supabase.ts       クライアント生成
│   │   └── utils.ts
│   ├── pages/                ルートに対応するページ
│   ├── types/                共有型・DB 型（`supabase gen types` 出力）
│   ├── App.tsx
│   ├── main.tsx
│   └── routes.tsx
├── supabase/
│   ├── migrations/           SQL マイグレーション
│   └── functions/
│       └── verify-passphrase/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Supabase 接続戦略

| 接続層 | 用途 | 採否 |
|---|---|---|
| **Framework**（`@supabase/supabase-js`） | クライアント・Edge Function 双方の DB / Auth アクセス（PostgREST 経由） | ✅ 全面採用 |
| **ORM**（Drizzle 等で Postgres 直接） | 型安全な server-side クエリ | ❌ 不要（型は `supabase gen types` 生成、RLS を活用） |
| **Direct**（`postgresql://...` 接続文字列） | マイグレーション適用、運用ツール | ⚠️ Supabase CLI 内部のみ（アプリコードからは使わない） |

サーバが無いアーキテクチャなので、ORM/Direct をアプリから呼ばない。Edge Function も `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` で PostgREST 経由（=Framework）を使い、Direct 接続はしない。

## 環境変数

クライアント側（`VITE_` プレフィクスはビルド時にクライアントへ露出する前提で扱うこと）：

| 変数 | 用途 |
|---|---|
| `VITE_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable Key（旧 anon key の新名称、公開可、RLS 必須） |

Edge Function Secret（クライアントに絶対露出させない）：

| 変数 | 用途 |
|---|---|
| `SIGNUP_PASSPHRASE_HASH` | 合言葉の SHA-256(salt + passphrase) hex 文字列 |
| `SIGNUP_PASSPHRASE_SALT` | 上記ハッシュに使うソルト（ランダム 32 文字） |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase が Edge Function に自動注入。`allowed_emails` への書き込み等に使う |

GitHub Actions secrets：上記の `VITE_*` をビルド時に注入。

## ローカル開発（Docker ベース）

[Supabase CLI](https://supabase.com/docs/guides/local-development) を使い、Postgres / Auth / Storage / Studio を Docker で立ち上げる。

```bash
# 初回のみ
brew install supabase/tap/supabase    # CLI インストール
supabase init                          # supabase/ ディレクトリ生成
supabase login                         # リモートとリンクする場合
supabase link --project-ref <ref>      # 同上

# 日常開発
supabase start                         # Docker stack 起動（postgres, auth, storage, studio 等）
supabase status                        # ローカル URL・publishable key を表示
supabase db reset                      # migrations/seed を再適用
supabase functions serve               # Edge Functions ローカル実行
supabase stop                          # 停止
```

### env ファイルの方針

シンプルに **`.env` 1 本（git 管理外）** で運用する。本番値はリポジトリ Secrets が唯一の正。

| 利用シーン | 値の置き場所 |
|---|---|
| ローカル開発（`npm run dev`） | リポジトリ直下の `.env` |
| CI / GitHub Pages ビルド | リポジトリ Secrets（`.github/workflows/*.yml` から `${{ secrets.* }}` で参照） |
| keepalive ワークフロー | 同上 |

`.env`、`.env.*` は `.gitignore` で全て除外済み。
ローカルで本番ビルド（`npm run build`）を試したい時は、`.env` を一時的に本番値に書き換える運用。

`.env` の値は `supabase start` 後の `supabase status` 出力（API URL / Publishable Key）から埋める。

`supabase/migrations/` と `supabase/functions/` は git 管理。ローカルで作業 → `supabase db push` で本番へ反映。

## 開発コマンド（プロジェクト初期化後）

```bash
npm install              # 依存インストール
npm run dev              # 開発サーバ起動
npm run build            # 本番ビルド
npm run preview          # ビルド成果物のローカル確認
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # Vitest
npm run db:types         # Supabase 型生成（src/types/database.ts）
```

## CI/CD

- `.github/workflows/ci.yml`：PR と main push で lint / typecheck / test / build
- `.github/workflows/deploy.yml`：main push で GitHub Pages へ自動デプロイ
- `.github/workflows/keepalive.yml`：毎日 03:00 JST に Supabase REST を叩いて Free Tier の自動 Pause を防止
- GitHub Pages の設定は **Source = GitHub Actions**
- ビルド時に `VITE_PUBLIC_SUPABASE_URL` / `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を Secrets から注入
- Vite の `base` はリポジトリ名（例: `/bisyoku-app/`）。カスタムドメインを使う場合は `'/'` に変更
- ルータは **HashRouter** 採用のため `404.html` リダイレクトトリックは不要（deploy.yml の `cp dist/index.html dist/404.html` は念のための保険）

## コーディング方針

- 機能は `src/features/<feature>/` に閉じる。横断的な型・関数のみ `src/lib`・`src/types` へ
- Supabase アクセスは feature 内に薄い関数として切り出し、UI から直接 SDK を叩かない
- フォームは React Hook Form + Zod で型と検証を一元化
- 日付は `date-fns`（軽量・tree-shake 可）
- アクセシビリティ：shadcn/ui の Radix ベースを尊重、`aria-*` を欠かさない
- コミットメッセージは Conventional Commits 推奨

## 現在のステータス

リポジトリは **初期化前**。次のセットアップ手順が必要：

1. Vite + React + TS で `package.json` を生成（`npm create vite@latest`）
2. Tailwind CSS / shadcn/ui / TanStack Query / React Router / vite-plugin-pwa 等を導入
3. **既存 `.env` の `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` にリネーム**、`VITE_PUBLIC_SUPABASE_URL` を追加
4. Supabase プロジェクトに `migrations/` で初期スキーマ・RLS・`health` テーブルを投入
5. Edge Function `verify-passphrase` 実装 → `supabase functions deploy verify-passphrase` でデプロイ。Secrets（`SIGNUP_PASSPHRASE_HASH` / `SIGNUP_PASSPHRASE_SALT`）は `supabase secrets set` で登録
6. **Google Cloud Console** で OAuth 2.0 Client を作成 → Authorized redirect URIs に Supabase Auth のコールバック URL を登録
7. **Supabase ダッシュボード**：
   - Authentication → Providers → **Google を Enable**、Client ID / Client Secret を入力
   - Authentication → URL Configuration で Site URL / Additional Redirect URLs を設定
8. GitHub Pages 有効化（Source = GitHub Actions）+ リポジトリ Secrets（`VITE_PUBLIC_SUPABASE_URL` / `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY`）登録 → 初回デプロイ確認
9. `keepalive.yml` を 1 度手動実行（`workflow_dispatch`）して疎通確認

## やらないこと（明示的スコープ外）

- 一般公開・SEO 最適化（招待制クローズド前提）
- ネイティブアプリ化（PWA で十分）
- リアルタイム同期（コラボ性は薄いので Polling/再フェッチで十分）
- 課金や有料機能
- 投稿のモデレーション・編集履歴（信頼ベースの小グループ前提）
- 写真・動画のアップロードと配信（Storage / 帯域の無料枠制約と、登録ハードル軽減のため）

## 運用上の留意点

- **Supabase Free Tier の自動 Pause** は keepalive ワークフローで回避。Supabase 側のポリシーが変わった場合は cron 間隔か叩く対象を見直す。
- **無料枠の上限**：DB 500MB / 帯域 5GB/月 / Edge Function 500K invocations/月。写真機能を持たないので帯域・容量はかなり余裕がある想定。
- 検索は当面 Postgres `ILIKE` で十分。データが増えたら `pg_trgm` GIN インデックスを後付けで検討。
