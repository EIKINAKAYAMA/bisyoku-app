# bisyoku-app — 仕様ドキュメント

家族・友人グループ向け 飲食店レビュー SPA の仕様一式。
**AI による開発を前提に、コードを読まなくても全体像と意図が伝わる粒度で書く**。

セットアップ手順・運用手順は [`README.md`](../README.md) を参照（このディレクトリでは扱わない）。

## 目次

| # | ファイル | 内容 |
|---|---|---|
| 00 | [overview.md](./00-overview.md) | プロダクト概要・対象ユーザー・コア機能・スコープ |
| 01 | [architecture.md](./01-architecture.md) | 技術スタック・システム構成・依存関係の方針 |
| 02 | [data-model.md](./02-data-model.md) | DB スキーマ・VIEW・RLS・マイグレーション |
| 03 | [auth.md](./03-auth.md) | 招待制サインアップ・OAuth・Edge Function |
| 04 | [routing.md](./04-routing.md) | ルート定義・各ページの責務 |
| 05 | [features.md](./05-features.md) | feature モジュールごとの API・UI 仕様 |
| 06 | [components.md](./06-components.md) | 共通コンポーネント・UI プリミティブ |
| 07 | [state-management.md](./07-state-management.md) | TanStack Query・queryKeys・invalidation |
| 08 | [conventions.md](./08-conventions.md) | ディレクトリ・命名・コーディング規約 |
| 09 | [pwa-build.md](./09-pwa-build.md) | Vite ビルド・PWA・コード分割 |
| 10 | [infra-ops.md](./10-infra-ops.md) | CI/CD・環境変数・keepalive・運用 |
| 11 | [non-goals.md](./11-non-goals.md) | やらないこと・設計判断の根拠 |

## このドキュメントの使い方（AI 開発者向け）

- **新機能を作る前に**：`00-overview.md` と `11-non-goals.md` を読み、スコープに収まる提案かを判断する。
- **DB を触る前に**：`02-data-model.md`（スキーマと RLS）を読む。RLS の共通条件 `is_invited_user()` を逸脱しないこと。
- **画面を作る前に**：`04-routing.md`（ルート構成）と `06-components.md`（既存プリミティブ）を確認し、再利用を優先する。
- **データ取得・更新を書く前に**：`07-state-management.md` の `qk` ファクトリと `invalidateAfterVisitChange` を必ず使う。
- **デプロイ・環境設定を変える前に**：`10-infra-ops.md` を読み、Secrets / Variables の整合性を確認する。

矛盾が見つかった場合の優先順位：**コード > docs > CLAUDE.md > README.md**。
docs と現状コードに乖離があれば、まず docs を直してから実装に入る。
