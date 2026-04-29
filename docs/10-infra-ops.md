# 10. インフラ・CI/CD・運用

セットアップ手順は [`README.md`](../README.md) を参照。本ドキュメントは**何がなぜそうなっているか**を記録する。

## 環境変数

### クライアント側（`VITE_` プレフィクス、ビルド時にバンドル）

| 変数 | 値の取得元 |
|---|---|
| `VITE_PUBLIC_SUPABASE_URL` | Supabase Project Settings → API |
| `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 同上（旧 anon key の新名称） |

公開前提なので RLS 必須。Service Role Key を絶対に使わない。

### Edge Function Secret（Supabase 側に保管）

| 変数 | 用途 | 設定方法 |
|---|---|---|
| `SIGNUP_PASSPHRASE_HASH` | 合言葉の SHA-256(salt + passphrase) hex 文字列 | `supabase secrets set` で投入 |
| `SIGNUP_PASSPHRASE_SALT` | ランダム 32 文字 | 同上 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | Supabase が Edge Function 実行時に自動注入 | 不要（自動） |

**`SIGNUP_PASSPHRASE_*` は GitHub Secrets に置かない**。`gh secret list` で見えると事故りやすい。Supabase 側に直接登録する：

```bash
SALT=$(openssl rand -hex 16)
HASH=$(printf "%s" "${SALT}<合言葉>" | shasum -a 256 | awk '{print $1}')
supabase secrets set --project-ref <ref> \
  SIGNUP_PASSPHRASE_SALT="$SALT" \
  SIGNUP_PASSPHRASE_HASH="$HASH"
```

### GitHub Actions Secrets

| Secret 名 | 用途 |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | `supabase` CLI が link / push / functions deploy するため |
| `SUPABASE_DB_PASSWORD` | `supabase db push` の DB 認証 |
| `VITE_PUBLIC_SUPABASE_URL` | フロントビルド時 |
| `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 同上 |

### GitHub Actions Variables（平文）

| Variable 名 | 値 |
|---|---|
| `SUPABASE_PROJECT_REF` | プロジェクト参照 ID（URL の `<ref>` 部分） |

### env ファイルの方針

- **`.env` 1 本（git 管理外）** で運用。`.gitignore` で `.env`、`.env.*` を全て除外
- 本番値はリポジトリ Secrets が**唯一の正**
- ローカル開発：`supabase start` 後の `supabase status` 出力を `.env` に書き写す
- 本番ビルドをローカルで試す時：`.env` を一時的に本番値に書き換える

## ローカル Supabase スタック

`supabase/config.toml`：
- API：54321、DB：54322（shadow 54320）、Studio：54323、Inbucket：54324、Edge Runtime inspector：8083
- `[auth]` site_url は `http://localhost:5173`、redirect URLs は `localhost:5173/` と `127.0.0.1:5173/`
- `[auth.external.google]` は `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` / `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)` を `supabase/.env` から読む（リアルな OAuth をローカルで通したい場合のみ必要）

dev login だけで UI 開発が完結するなら Google OAuth のローカル設定は不要。

## CI/CD ワークフロー

### `.github/workflows/ci.yml`（PR + main push）

`Lint / Typecheck / Test / Build` を 1 ジョブで連続実行。Build 時に `VITE_PUBLIC_SUPABASE_*` を Secrets から注入（無くてもエラーにはせず警告のみ）。
- `concurrency.group: ci-${{ github.ref }}` で同一ブランチの古い CI をキャンセル
- `actions/setup-node@v4` Node 20 + npm キャッシュ

### `.github/workflows/deploy.yml`（main push）

```
[migrate]  Supabase に migration 適用（supabase db push）
   ├─→ [functions]  verify-passphrase Edge Function を deploy
   └─→ [build]      フロントエンドをビルド + 404.html フォールバック
                       └─→ [deploy] GitHub Pages に公開
```

- `concurrency.group: deploy` + `cancel-in-progress: false`：同時 deploy を直列化（migration 競合防止）
- `migrate` job：`supabase/setup-cli@v1 with: version: latest` で CLI 取得 → `supabase link --project-ref` → `supabase db push`
- `functions` job：`supabase functions deploy verify-passphrase --project-ref ...`（`migrate` に depends）
- `build` job：`npm ci` → Secrets を env に流して `npm run build` → `cp dist/index.html dist/404.html` → `actions/upload-pages-artifact@v3`
- `deploy` job：`actions/deploy-pages@v4`（`build` と `functions` 両方の完了後）

GitHub Pages の Source は **GitHub Actions** に設定しておく。

### `.github/workflows/keepalive.yml`（毎日 03:00 JST）

```yaml
on:
  schedule:
    - cron: '0 18 * * *'    # 18:00 UTC = 03:00 JST
  workflow_dispatch:
```

`curl` で `${SUPABASE_URL}/rest/v1/health?select=id&limit=1` を叩く。
- `apikey` / `Authorization` ヘッダに publishable key を渡す（Service Role 不要）
- `--retry 3 --retry-delay 5 --retry-all-errors`、`--max-time 30`、`timeout-minutes: 2`
- 失敗しても通知はしない（hobby app）。週次で Actions の履歴を見る運用
- pg_cron は使わない（プロジェクト Pause 中は pg_cron も止まるため意味がない）

万一 Pause された場合：Supabase ダッシュボード → プロジェクト → "Restore project" を**手動で押す**（API からは起こせない）。その後 keepalive を `workflow_dispatch` で 1 度走らせて疎通確認。

## 初回セットアップでハマりやすいポイント

| 失敗箇所 | 原因 |
|---|---|
| `migrate` job が `password authentication failed` | `SUPABASE_DB_PASSWORD` Secret 未登録 or 値が違う |
| `migrate` job が `Invalid project ref` | `SUPABASE_PROJECT_REF` Variable 未登録 or 値が違う |
| `functions` job が `Access token not provided` | `SUPABASE_ACCESS_TOKEN` Secret 未登録 |
| サインアップで `server_misconfigured` | `supabase secrets set SIGNUP_PASSPHRASE_*` をやっていない |
| Google ログインで 404 | Google Cloud Console 側 Authorized redirect URIs 漏れ |
| デプロイ後画面が真っ白 | Secrets 未登録のままビルドされ env が空、または `vite.config.ts` の `base` がリポジトリ名と不一致 |
| Pages にアクセスするとアセット 404 | `vite.config.ts` の `base` を `/<repo-name>/` に。カスタムドメイン使用時は `'/'` |

## 本番運用で起こりうること

| 症状 | 対応 |
|---|---|
| 操作がもっさり、古い画面が出る | DevTools → Application → Service Workers → Unregister + Clear site data + ハードリロード |
| 「未招待のアカウント」になる | Edge Function 未デプロイ／`SIGNUP_PASSPHRASE_*` 未設定／合言葉が違う |
| migration push が `migration already exists` | 過去にローカルで `supabase db push` 済。`supabase migration repair` で履歴を修復 |
| 招待を増やしたい | 合言葉を新メンバーに伝えるだけ（サインアップで自動的に `allowed_emails` に追加される） |
| 合言葉を変えたい | `supabase secrets set` で再投入。Edge Function 再デプロイ不要 |
| ロールバックしたい | `git revert <bad-commit-sha>` → main push、または Actions タブから過去成功した workflow を Re-run |

## ジャンルマスターの管理

`genres` テーブルは migration `0008` で **クライアントからの INSERT / UPDATE を禁止** している（表記ブレ防止）。
追加・改名・削除は admin が **Supabase Studio → SQL Editor** から直接 SQL を打って行う。

### 追加

```sql
INSERT INTO public.genres (name) VALUES ('お好み焼き')
ON CONFLICT (name) DO NOTHING;
```

`name` は **NFKC 正規化済 + trim 済** の表記で揃える（例：`イタリアン` ＋ 半角スペース無し）。
複数追加する場合は VALUES を並べる。

### 改名

```sql
UPDATE public.genres SET name = '焼肉・ホルモン' WHERE name = '焼肉';
```

参照中の `restaurants.genre_id` はそのまま追従する（FK は id 参照のため）。

### 削除（マージ運用）

`genre_id` は `ON DELETE RESTRICT` なので、削除前に **参照を別ジャンルに付け替える必要がある**。

```sql
-- 例: 旧「ハンバーグ」を「洋食・ビストロ」に統合してから削除
WITH src AS (SELECT id FROM public.genres WHERE name = 'ハンバーグ'),
     dst AS (SELECT id FROM public.genres WHERE name = '洋食・ビストロ')
UPDATE public.restaurants r
   SET genre_id = (SELECT id FROM dst)
 WHERE r.genre_id = (SELECT id FROM src);

DELETE FROM public.genres WHERE name = 'ハンバーグ';
```

UI は `qk.genres.all` でキャッシュしているので、ユーザー側はリロードかセッション再起動で反映。

### 本番デプロイ後の初回クリーンアップ手順

1. `0008` 適用直後はデフォルト 25 件 + 既存ユーザー追加分が混在する
2. Restaurant 一覧で旧ジャンルが付いている店舗を、編集画面から正しいデフォルトジャンルに付け替え
3. 上記「削除（マージ運用）」で旧ジャンルを `DELETE`
4. 完了後、`SELECT name FROM public.genres ORDER BY name;` でデフォルト 25 件のみになっていることを確認

## 無料枠のキャパ感

| リソース | Free Tier 上限 | 当アプリでの想定 |
|---|---|---|
| DB | 500 MB | 写真ナシなのでテキストのみ → 余裕 |
| 帯域 | 5 GB / 月 | 同上 |
| Edge Function 呼び出し | 500K / 月 | サインアップ時のみ呼ばれる → 無視できる |
| 月次 active user | 50K MAU | 家族・友人 → 関係なし |

データが増えたら検索の `ILIKE` を `pg_trgm` GIN インデックスに切り替えるのは後付けで OK。
