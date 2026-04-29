# bisyoku-app

家族・友人グループ向けの招待制 飲食店レビュー SPA。完全無料運用（GitHub Pages + Supabase Free Tier）。

> **詳細仕様は [`docs/`](./docs/README.md) を正本として参照すること**。本ファイルは AI が最初に踏むエントリ。docs と内容が衝突したら docs を直してから実装する。
> セットアップ・運用手順は [`README.md`](./README.md)。

## 仕様ドキュメント（docs/）の入り口

| 種類 | 何を読むか |
|---|---|
| 全体像・スコープ | [`docs/00-overview.md`](./docs/00-overview.md) / [`docs/11-non-goals.md`](./docs/11-non-goals.md) |
| アーキテクチャ・依存関係 | [`docs/01-architecture.md`](./docs/01-architecture.md) |
| DB / RLS / マイグレーション | [`docs/02-data-model.md`](./docs/02-data-model.md) |
| 認証フロー・Edge Function | [`docs/03-auth.md`](./docs/03-auth.md) |
| ルート構成・ページ責務 | [`docs/04-routing.md`](./docs/04-routing.md) |
| feature モジュール仕様 | [`docs/05-features.md`](./docs/05-features.md) |
| 共通コンポーネント | [`docs/06-components.md`](./docs/06-components.md) |
| TanStack Query / queryKeys | [`docs/07-state-management.md`](./docs/07-state-management.md) |
| ディレクトリ・命名・規約 | [`docs/08-conventions.md`](./docs/08-conventions.md) |
| Vite ビルド・PWA | [`docs/09-pwa-build.md`](./docs/09-pwa-build.md) |
| CI/CD・環境変数・運用 | [`docs/10-infra-ops.md`](./docs/10-infra-ops.md) |

## 技術スタック（要点）

- **言語**：TypeScript / **フレームワーク**：React 18 + Vite 7
- **ルーティング**：React Router v6 `HashRouter`（GitHub Pages サブパス配信のため）
- **UI**：Tailwind CSS + shadcn/ui（Radix）
- **フォーム**：React Hook Form + Zod
- **サーバ状態**：TanStack Query（キーは `src/lib/queryKeys.ts` の `qk` に集約）
- **データ層**：`@supabase/supabase-js`（PostgREST 経由・RLS 必須）
- **PWA**：vite-plugin-pwa（Workbox）
- **ホスティング**：GitHub Pages、**CI/CD**：GitHub Actions

## 作業を始める前のチェックリスト

新機能・修正に着手する前に：

1. [`docs/00-overview.md`](./docs/00-overview.md) と [`docs/11-non-goals.md`](./docs/11-non-goals.md) を読み、スコープに収まる提案かを判断する
2. DB を触るなら [`docs/02-data-model.md`](./docs/02-data-model.md) を読み、RLS の共通条件 `is_invited_user()` を逸脱しないことを確認
3. データ取得・更新を書くなら [`docs/07-state-management.md`](./docs/07-state-management.md) の `qk` ファクトリと `invalidateAfterVisitChange` を必ず使う
4. UI を作るなら [`docs/06-components.md`](./docs/06-components.md) の既存プリミティブを再利用してから新規作成を検討

## ハードルール（絶対に守る）

これらは過去の事故・設計判断に紐付くので、提案・実装の段階で必ず守る：

- **合言葉・Service Role Key などの秘匿値をフロントの `import.meta.env` で読まない**。`VITE_PUBLIC_*` 以外は禁止（[`docs/03-auth.md`](./docs/03-auth.md)、[`docs/10-infra-ops.md`](./docs/10-infra-ops.md)）
- **コンポーネントから `supabase` SDK を直接呼ばない**。必ず `src/features/<x>/api.ts` を経由（[`docs/05-features.md`](./docs/05-features.md)）
- **queryKey を文字列リテラルで書かない**。`qk` ファクトリ経由（[`docs/07-state-management.md`](./docs/07-state-management.md)）
- **訪問・評価変更後の invalidation は `invalidateAfterVisitChange(qc, restaurantId)` 一発**。`invalidateQueries` を 5 連発書かない
- **写真・動画のアップロード機能を追加しない**（Free Tier 容量保護＋登録ハードル抑制、[`docs/11-non-goals.md`](./docs/11-non-goals.md)）
- **集計（avg / count）はクライアントでループしない**。`restaurant_rating_summary` VIEW を使う
- **vendor chunk を細かく分けない**。React 依存パッケージは同一 chunk に集約（過去の `forwardRef` undefined 事故、[`docs/09-pwa-build.md`](./docs/09-pwa-build.md)）

## 開発コマンド

```bash
npm install              # 依存インストール
npm run dev              # 開発サーバ（要 supabase start）
npm run build            # 本番ビルド
npm run preview          # ビルド成果物のローカル確認
npm run lint             # ESLint
npm run typecheck        # tsc -b --noEmit
npm run test             # Vitest
npm run db:types         # Supabase 型生成（src/types/database.ts）
npm run pwa:icons        # public/favicon.svg から PWA アイコン PNG 再生成

supabase start           # ローカル Postgres / Auth / Studio 起動
supabase status          # API URL と publishable key 確認
supabase db reset        # migrations + seed.sql を全適用
supabase functions serve verify-passphrase --env-file supabase/.env
```

## 現在のステータス

実装は一通り完了し、本番（GitHub Pages + Supabase 本番プロジェクト）にデプロイ済み。
今後の作業は通常の機能追加 / 修正フローに乗せる：

- 仕様変更 → コード変更 → PR → main マージで自動デプロイ（`.github/workflows/deploy.yml`）
- DB スキーマ変更 → `supabase migration new` → ローカル `supabase db reset` で確認 → `npm run db:types` 再生成 → main マージで CI が `supabase db push`
- Edge Function 変更 → ローカル `supabase functions serve` で確認 → main マージで CI が `supabase functions deploy verify-passphrase`

詳細手順は [`README.md`](./README.md) を参照。
