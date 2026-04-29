# 01. アーキテクチャ

## システム構成図

```
┌──────────────────────────────────────┐       ┌────────────────────────────┐
│ Browser (PWA)                        │       │ GitHub Actions             │
│  - React 18 + Vite (HashRouter)      │       │  - ci.yml                  │
│  - Tailwind / shadcn-ui              │       │  - deploy.yml              │
│  - TanStack Query                    │       │  - keepalive.yml (cron)    │
│  - @supabase/supabase-js (PKCE)      │       └────────────────────────────┘
└──────────────────────────────────────┘                │  daily ping
            ▲          ▲                                ▼
            │ static   │ REST + Auth + Edge Functions
            │ assets   │
┌───────────┴──────┐  ┌──────────────────────────────────────────┐
│ GitHub Pages     │  │ Supabase                                 │
│  /bisyoku-app/   │  │  - Postgres (RLS 全テーブル有効)          │
└──────────────────┘  │  - Auth (Google OAuth + email/password)  │
                      │  - Edge Functions (verify-passphrase)    │
                      └──────────────────────────────────────────┘
```

サーバ実装はゼロ（フロント = SPA、バックエンド = Supabase の PostgREST と Edge Functions）。

## 技術スタック

| レイヤ | 採用 | 役割 |
|---|---|---|
| 言語 | TypeScript | 型安全 |
| フレームワーク | React 18 + Vite 7 | SPA |
| ルーティング | React Router v6（**HashRouter**） | GitHub Pages のサブパス配信に最も堅牢 |
| UI | Tailwind CSS + shadcn/ui（Radix ベース） | アクセシブルなプリミティブ |
| フォーム | React Hook Form + Zod | 型と検証を一元化 |
| サーバ状態 | TanStack Query | キャッシュ・再取得・invalidation |
| データ層 | `@supabase/supabase-js` | PostgREST 経由の DB / Auth / Functions |
| アイコン | lucide-react | |
| 日付 | date-fns | 軽量・tree-shake 可 |
| PWA | vite-plugin-pwa（Workbox） | autoUpdate / 静的アセットのみキャッシュ |
| ホスティング | GitHub Pages | `actions/deploy-pages` |
| Lint / Format | ESLint + Prettier | |
| テスト | Vitest + React Testing Library | 最小限 |

## Supabase 接続戦略

| 接続層 | 用途 | 採否 |
|---|---|---|
| Framework（`@supabase/supabase-js`） | クライアント・Edge Function 双方の DB / Auth | ✅ 全面採用 |
| ORM（Drizzle 等で Postgres 直接） | 型安全な server-side クエリ | ❌ 不要（型は `supabase gen types`、RLS 活用） |
| Direct（`postgresql://...`） | マイグレーション適用、運用ツール | ⚠️ Supabase CLI 内部のみ |

サーバが無いアーキテクチャなので、ORM/Direct をアプリから呼ばない。Edge Function も `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` で PostgREST 経由（=Framework）を使う。

## クライアントサイドの内部構造

```
main.tsx
  └─ <StrictMode>
      └─ <QueryClientProvider>          ─ TanStack Query デフォルト設定（5分 staleTime）
          └─ <HashRouter>
              └─ <AuthProvider>          ─ session / profile / loading 管理（lib/supabase）
                  └─ <App>               ─ ルート定義（全ページ React.lazy）
                      └─ <RequireAuth>   ─ ログインガード（profile 不在は /login へ）
                          └─ <AppLayout> ─ ヘッダ・ボトムナビ（モバイル）・<Outlet>
                              └─ pages/* ─ ルート単位のページ
```

- 認証必須ルートは `<RequireAuth><AppLayout/></RequireAuth>` の下にぶら下げる。
- 認証不要ルート（`/login`, `/signup`, `/auth/callback`）は外側に置く。

## ビルド戦略

- **route-level code splitting**：`src/App.tsx` は全ページを `React.lazy` で読み込み、ルートごとに別チャンク化する
- **vendor 分離**：`vite.config.ts` の `rollupOptions.output.manualChunks` で `@supabase` を別チャンク（`vendor-supabase`）、それ以外の `node_modules` は単一の `vendor` チャンクに集約
  - ⚠ 過去に react / radix / tanstack を細かく分けたところ、Vite の CJS→ESM interop と ESM 静的 import 解決の組み合わせで `forwardRef` が undefined になる事故が起きた（lucide-react / radix の初期化失敗）。React に依存する node_modules は同一 chunk に置くこと
- **PWA**：vite-plugin-pwa の `registerType: 'autoUpdate'` で静的アセットのみキャッシュ。Supabase オリジン（`*.supabase.co` / `127.0.0.1:54321`）は **NetworkOnly**（古い JWT・レスポンスを返さないため）

詳細は [`09-pwa-build.md`](./09-pwa-build.md) を参照。

## ルーティング選択（HashRouter）

GitHub Pages のサブパス配信（`https://<user>.github.io/bisyoku-app/`）でも 404 にならず最も堅牢なため HashRouter を採用。`BrowserRouter` を使う場合は `404.html` フォールバックの追加・`base` の整合・OAuth リダイレクト URL の調整など露払いが多くなる。

deploy.yml では念のため `cp dist/index.html dist/404.html` で SPA 404 フォールバックも仕込んでいる（保険）。
