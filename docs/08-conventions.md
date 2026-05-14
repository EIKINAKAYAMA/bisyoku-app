# 08. ディレクトリ・命名・コーディング規約

## ディレクトリ構成

```
bisyoku-app/
├── .github/workflows/        CI / Deploy / Keepalive
├── public/                   静的アセット、PWA アイコン
├── src/
│   ├── components/           汎用コンポーネント
│   │   └── ui/               shadcn/ui ベースのプリミティブ
│   ├── features/             機能単位のモジュール（API + UI 両方を含める）
│   │   ├── auth/
│   │   ├── restaurants/
│   │   ├── visits/
│   │   ├── genres/
│   │   └── users/
│   ├── hooks/                useDebounced 等の汎用フック
│   ├── lib/                  Supabase クライアント / TanStack Query / queryKeys / 定数 / utils
│   ├── pages/                ルートに対応するページ
│   ├── test/                 Vitest setup
│   ├── types/                共有型・DB 型（supabase gen types 出力）
│   ├── App.tsx               ルーティング定義
│   ├── main.tsx              ルート（Provider 構成 + dev 用 SW クリア）
│   └── vite-env.d.ts
├── supabase/
│   ├── migrations/           SQL マイグレーション
│   ├── functions/
│   │   ├── _shared/cors.ts
│   │   └── verify-passphrase/
│   ├── seed.sql              ローカル専用：dev1 / dev2 ユーザーを seed
│   └── config.toml
├── docs/                     本仕様ドキュメント
├── index.html
├── vite.config.ts            Vite + PWA + base=/bisyoku-app/（本番のみ）
├── tailwind.config.ts
├── tsconfig.json
├── CLAUDE.md                 AI 開発のための要点（短く保つ）
├── README.md                 セットアップ・運用手順
└── package.json
```

## ファイル分類の判断基準

| 配置 | 何を置くか |
|---|---|
| `src/lib/` | サーバ依存しない純粋関数・定数・SDK ラッパー（Supabase client、QueryClient、utils 等） |
| `src/hooks/` | 汎用 React フック（feature 非依存） |
| `src/components/` | 2 つ以上の feature から使われる UI コンポーネント |
| `src/components/ui/` | shadcn/ui ベースのプリミティブ（Radix ラッパー） |
| `src/features/<feature>/` | feature ごとの API + UI（再利用される feature コンポーネントもここ） |
| `src/pages/` | ルート 1 つに対応するページコンポーネント |

迷ったら `src/features/` から始めて、他 feature でも使うようになったら `src/components/` に昇格。

## 命名

- ファイル：`PascalCase.tsx`（コンポーネント）、`camelCase.ts`（関数・hook・型のみのファイル）
- React コンポーネント：`PascalCase`、named export 推奨（lazy import で揃いやすい）
- Hook：`useXxx`
- Zod スキーマ：`schema`（ローカル変数）、エクスポートする場合は `xxxSchema`
- DB 関連型：`Restaurant` / `Visit` / `Rating` / `Profile` / `RatingSummary` 等。複合型は `XxxWithYyy`
- queryKey：必ず `qk` ファクトリ経由

## TypeScript

- パスエイリアス `@/*` → `./src/*`（`vite.config.ts` と `tsconfig.json` で同期）
- DB 型は `src/types/database.ts`（**手書きしない**、`npm run db:types` で再生成）
- DB 行型を使う時は `Database['public']['Tables']['xxx']['Row']` を `type` alias で再エクスポート
- `as` キャストは PostgREST の embed 型で配列／単体が型上揺れる時に限る（`pickRating` など）

## React / フォーム

- フォームは React Hook Form + Zod に統一。`zodResolver` を `useForm({ resolver })` に渡す
- `defaultValues` には null を入れず空文字 `''` か対応する型の初期値を入れる（uncontrolled 警告回避）
- 数値入力は Zod の `preprocess` で空文字 → null / undefined に変換
- フォーム表面の汎用エラー（API 失敗等）は `useState<string | null>(topError)` で表示

## Supabase アクセス

- **コンポーネントから直接 `supabase` を呼ばない**。必ず `features/<x>/api.ts` 経由
- `@supabase/supabase-js` の `select('*, rel:table(...)')` 構文で embed する
- VIEW に対しては embed が効かないので並列 fetch + `Map` で merge（`listRestaurants` 参照）
- エラーハンドリングは `if (error) throw error` で TanStack Query の onError に委譲

## CSS / Tailwind

- スタイルは Tailwind ユーティリティが基本
- `cn()`（`clsx + tailwind-merge`）でクラス合成（`src/lib/utils.ts`）
- カラーは `hsl(var(--xxx))` 経由（テーマ変数は `src/index.css`）
- レスポンシブ：モバイル first（PC は `md:` `lg:` で上書き）。現状ボトムナビはモバイルのみ表示

## アクセシビリティ

- shadcn/ui の Radix ベースを尊重し `aria-*` を欠かさない
- アイコンのみのボタンには `aria-label` を必ず付ける（`<Button aria-label="編集">`）
- フォームの `<Label htmlFor>` と `<Input id>` を必ずペアにする

## コミットメッセージ

- Conventional Commits 推奨（`feat:`、`fix:`、`refactor:` 等）
- 日本語 OK
- 強い理由がない限り 1 PR 1 トピック

## エディタ・コードスタイル

- Prettier（`.prettierrc.json`）でフォーマット
- ESLint（`eslint.config.js`）：`@eslint/js` + `typescript-eslint` + `react-hooks` + `react-refresh`
- 行末セミコロン無し（Prettier 設定参照）

## やってはいけないこと

- 文字列リテラルでクエリキーを書く（`['visits', 'restaurant', id]` を直接書かない、`qk.visits.forRestaurant(id)` 経由）
- ページごとに 5 連発の `invalidateQueries` を書く（`invalidateAfterVisitChange` を使う）
- `supabase` クライアントをコンポーネントから直接 import する
- `email` / `passphrase` / `service_role_key` などの秘匿値をフロントの import.meta.env でクライアントへ露出させる（`VITE_PUBLIC_*` 以外は使わない）
- 写真・動画のアップロード機能を追加する（[`11-non-goals.md`](./11-non-goals.md) 参照）
- 新規 `public` テーブルの migration で GRANT を書き忘れる（2026-10-30 以降、暗黙 GRANT が無くなり Data API から `42501` で弾かれる。詳細は [`02-data-model.md`](./02-data-model.md#新規テーブルは-grant-を明示する2026-10-30-以降必須)）
