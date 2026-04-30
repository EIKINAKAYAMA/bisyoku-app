# 02. データモデル

DB は Supabase の Postgres 1 個。すべて `public` schema。RLS は全テーブルで有効。

## ER 図（概略）

```
auth.users ─┬─ profiles (1:1, ON DELETE CASCADE)
            │
profiles ───┼─< genres.created_by         (SET NULL)
            ├─< restaurants.created_by    (SET NULL)
            └─< visits.user_id            (CASCADE)

genres ─────< restaurants.genre_id        (RESTRICT)
restaurants ─< visits.restaurant_id       (CASCADE)
visits ─────< ratings.visit_id  UNIQUE    (CASCADE, 0..1)
```

`allowed_emails` と `health` は他テーブルと FK を持たない独立テーブル。

```
awards ─────< restaurant_awards.award_id     (SET NULL)
restaurants ─< restaurant_awards.restaurant_id  (CASCADE)
```

## テーブル定義

### `profiles`

`auth.users` と 1:1。招待制ガードの判定に使われる（プロフィール行が存在 = 招待済）。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | PK = `auth.users.id`（ON DELETE CASCADE） |
| `display_name` | text | NOT NULL |
| `avatar_url` | text | nullable |
| `created_at` | timestamptz | DEFAULT now() |

`display_name` の初期値は Edge Function `verify-passphrase` が `auth.users.raw_user_meta_data` の `full_name` / `name` から、`avatar_url` は `avatar_url` / `picture` から自動コピー。
ログイン後、Google 側 avatar に変化があれば `AuthProvider.syncFromAuthMeta` が更新する（`display_name` は同期しない＝ユーザー編集を尊重）。

### `allowed_emails`

招待許諾リスト。**Edge Function（Service Role）だけが書き込む**。クライアントから読めない・書けない。

| 列 | 型 | 制約 |
|---|---|---|
| `email` | text | PK |
| `created_at` | timestamptz | DEFAULT now() |

RLS：ポリシー無し ＋ RLS 有効 ＝ Service Role 以外は何もできない。

### `genres`

ジャンル。**管理者が編集する固定マスター**。クライアント（招待ユーザー）からは
SELECT のみ可能で、追加・編集はできない。表記ブレ（「イタリアン」「イタリアン料理」「ピザ」など）
が起きないよう、migration `0008` で INSERT / UPDATE ポリシーを撤去している。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `name` | text | NOT NULL **UNIQUE** |
| `created_by` | uuid | FK → profiles（SET NULL） |
| `created_at` | timestamptz | DEFAULT now() |

`name` は **`NFKC` 正規化 + `trim`** 済み前提（migration の seed 値もこの規約に従う）。
`created_by` は履歴上の互換のために残しているだけで、admin が SQL から追加した行は NULL になる。
管理者作業は [`10-infra-ops.md`](./10-infra-ops.md#ジャンルマスターの管理) を参照。

### `restaurants`

店舗マスタ（共有）。訪問・評価が無くても登録できる。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | NOT NULL |
| `link` | text | nullable（その他リンク：公式サイト / 予約ページ等） |
| `genre_id` | uuid | NOT NULL FK → genres（RESTRICT） |
| `price_range` | `price_range_enum` | NOT NULL |
| `google_maps_url` | text | nullable（Google Maps の店舗ページ URL） |
| `tabelog_url` | text | nullable（食べログの店舗ページ URL） |
| `created_by` | uuid | FK → profiles（SET NULL） |
| `created_at` | timestamptz | DEFAULT now() |

インデックス：`(genre_id)`、`(created_at DESC)`。

### `visits`

訪問記録。任意（なくても店舗だけ登録可）。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | PK |
| `restaurant_id` | uuid | NOT NULL FK → restaurants（CASCADE） |
| `user_id` | uuid | NOT NULL FK → profiles（CASCADE） |
| `visit_date` | date | nullable |
| `order_content` | text | nullable |
| `payment_amount` | integer | nullable, CHECK >= 0 |
| `comment` | text | nullable |
| `created_at` | timestamptz | DEFAULT now() |

インデックス：`(restaurant_id)`、`(user_id)`。

### `ratings`

評価。`visits` に対して 0..1 の関係（評価なしの訪問もある）。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | PK |
| `visit_id` | uuid | NOT NULL **UNIQUE** FK → visits（CASCADE） |
| `overall` | smallint | NOT NULL CHECK 1〜10 |
| `food` | smallint | 同上 |
| `service` | smallint | 同上 |
| `atmosphere` | smallint | 同上 |
| `cost_performance` | smallint | 同上 |

UNIQUE 制約があるので、編集時は `upsert(..., { onConflict: 'visit_id' })`、評価を外す時は `DELETE WHERE visit_id = ?` でよい。

### `awards`

称号マスター（ミシュラン・食べログ百名店等）。**ジャンルと同じ管理思想**で、
クライアントは SELECT のみ、admin が Supabase Studio から直接 SQL で管理する。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `name` | text | NOT NULL **UNIQUE** |
| `category` | `award_category_enum` | NOT NULL（`michelin` / `tabelog` / `global` / `japan_media` / `other`） |
| `sort_order` | integer | NOT NULL DEFAULT 100（カテゴリ内の表示順） |
| `created_at` | timestamptz | DEFAULT now() |

migration `0010` で 30 件の初期マスター（ミシュラン 5 件 / 食べログ 19 件 / 国際 3 件 / 日本メディア 3 件）を seed 済。
管理者作業は [`10-infra-ops.md`](./10-infra-ops.md#称号マスターの管理) を参照。

### `restaurant_awards`

店舗 ↔ 称号の中間テーブル。1 店舗が複数称号を持てる。
マスターから選んだ場合は `award_id`、自由入力（その他）の場合は `custom_label` を持つ。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | PK |
| `restaurant_id` | uuid | NOT NULL FK → restaurants（CASCADE） |
| `award_id` | uuid | nullable FK → awards（SET NULL） |
| `custom_label` | text | nullable（マスター不採用時の自由入力） |
| `year` | smallint | nullable, CHECK 1900〜2100（取得年度） |
| `created_at` | timestamptz | DEFAULT now() |

CHECK 制約：`award_id` か `custom_label` のどちらかは NOT NULL（両方 NULL は不可）。
インデックス：`(restaurant_id)`、`(award_id)`。

店舗マスタと同じ哲学で、**invited ユーザー全員が CRUD 可能**（共有データとして育てる）。

### `health`

Pause 防止 cron 用の単一行テーブル。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | smallint | PK CHECK (id = 1) |
| `pinged_at` | timestamptz | DEFAULT now() |

マイグレーションで `INSERT (id) VALUES (1) ON CONFLICT (id) DO NOTHING` で投入する。
**RLS は anon ロールでも SELECT のみ許可**（keepalive cron が認証なしで叩くため）。INSERT/UPDATE/DELETE は不可。

### Enum

```sql
CREATE TYPE price_range_enum AS ENUM (
  '〜2000', '2000〜5000', '5000〜10000', '10000〜20000', '20000〜'
);

CREATE TYPE award_category_enum AS ENUM (
  'michelin', 'tabelog', 'global', 'japan_media', 'other'
);
```

TS 側は `src/lib/constants.ts` の `PRICE_RANGES` と同期。**追加・順序変更は両方を必ず合わせること**。

## VIEW: `restaurant_rating_summary`

平均値・件数の集計はクライアントではなく VIEW で計算する。

```sql
CREATE OR REPLACE VIEW restaurant_rating_summary AS
SELECT
  r.id                                        AS restaurant_id,
  COUNT(rt.id)                                AS rating_count,
  ROUND(AVG(rt.overall)::numeric, 1)          AS avg_overall,
  ROUND(AVG(rt.food)::numeric, 1)             AS avg_food,
  ROUND(AVG(rt.service)::numeric, 1)          AS avg_service,
  ROUND(AVG(rt.atmosphere)::numeric, 1)       AS avg_atmosphere,
  ROUND(AVG(rt.cost_performance)::numeric, 1) AS avg_cost_performance
FROM restaurants r
LEFT JOIN visits  v  ON v.restaurant_id = r.id
LEFT JOIN ratings rt ON rt.visit_id     = v.id
GROUP BY r.id;
```

`LEFT JOIN` なので**未評価店舗も `rating_count = 0` で行が出る**。
PostgREST の自動 embed が VIEW に対しては効かないため、一覧 API は `restaurants` と `restaurant_rating_summary` を並列取得しクライアントで merge している（`features/restaurants/api.ts` の `listRestaurants`）。

## Row Level Security

RLS は全テーブルで `ENABLE`。共通条件は SQL 関数 `is_invited_user()`。

```sql
CREATE OR REPLACE FUNCTION public.is_invited_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
$$;
```

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | invited | （Edge Function のみ） | 本人のみ | （ON DELETE CASCADE で auth.users 削除に追従） |
| `allowed_emails` | × | × | × | × |
| `genres` | invited | × | × | × |
| `awards` | invited | × | × | × |
| `restaurant_awards` | invited | invited（全員） | invited（全員） | invited（全員） |
| `restaurants` | invited | invited 且つ `created_by = auth.uid()` | invited（全員） | invited 且つ 訪問記録 0 件 |
| `visits` | invited | invited 且つ `user_id = auth.uid()` | 本人のみ | 本人のみ |
| `ratings` | invited | 親 visit が本人のもの | 同左 | 同左 |
| `health` | anon + authenticated | × | × | × |

> `restaurants` の DELETE ポリシーは migration `0004` で追加された。`0001` では SELECT / INSERT / UPDATE のみだったため、UI に削除ボタンはあっても RLS で 0 行影響に silent fail していた可能性がある。

> `restaurants` の UPDATE / DELETE は migration `0006` / `0007` で「作成者のみ」から「招待ユーザー全員」に緩和された。店舗マスタは家族・友人グループで共有して育てるデータなので、編集は誰でも可能。削除は他人の訪問記録・評価が CASCADE で巻き込まれる事故を防ぐため、**訪問記録が 1 件もぶら下がっていない店舗に限り**全員可（visits 削除は引き続き本人のみなので、他人の記録が残っているかぎり店舗は消せない）。

> `genres` は **SELECT のみクライアントに開放**。INSERT / UPDATE / DELETE はポリシー無し ＝ Service Role 以外不可。admin は Supabase Studio の SQL Editor から直接 SQL を打って管理する（[`10-infra-ops.md`](./10-infra-ops.md#ジャンルマスターの管理)）。`restaurants.genre_id` が `ON DELETE RESTRICT` なので、参照されている genre は admin でも DELETE できない（先に restaurants.genre_id を別ジャンルに付け替える必要がある）。

## マイグレーション運用

`supabase/migrations/<timestamp>_<name>.sql` に SQL を追記し、ローカルで `supabase db reset` → `npm run db:types` で型再生成 → main マージで CI が `supabase db push` する。

| ファイル | 内容 |
|---|---|
| `0001_init.sql` | 初期スキーマ + RLS + view + health |
| `0002_add_visit_comment.sql` | `visits.comment` 列追加 |
| `0003_add_restaurant_external_urls.sql` | `restaurants.google_maps_url`, `tabelog_url` 列追加 + 既存 `link` の救済データ移行 |
| `0004_add_restaurants_delete_policy.sql` | `restaurants` の DELETE ポリシー追加（作成者のみ削除可） |
| `0005_add_restaurants_area.sql` | `restaurants.area` 列追加 + インデックス |
| `0006_relax_restaurants_update_policy.sql` | `restaurants` の UPDATE ポリシーを invited ユーザー全員に緩和（DELETE は据え置き） |
| `0007_restaurants_delete_when_no_visits.sql` | `restaurants` の DELETE ポリシーも invited ユーザー全員に緩和、ただし訪問記録 0 件のときのみ |
| `0008_genres_admin_managed.sql` | `genres` の INSERT / UPDATE ポリシー撤去 + デフォルト 25 件のジャンルを seed（既存と重複は ON CONFLICT DO NOTHING でスキップ） |
| `0009_genres_canonical_25.sql` | `genres` を canonical な 25 件のみに固定（本番手動クリーンアップ済の状態をコード側でも正としてソース化） |
| `0010_awards.sql` | 称号マスター `awards`（admin 管理）と中間テーブル `restaurant_awards`（invited 全員 CRUD）を新設 + デフォルト 30 件の称号 seed |

## seed（ローカル専用）

`supabase/seed.sql` は `supabase db reset` 時のみ実行され、`supabase db push` には含まれない（=本番に流れない）。

| Email | Password | display_name |
|---|---|---|
| `dev1@local.test` | `devpass` | 開発ユーザー1 |
| `dev2@local.test` | `devpass` | 開発ユーザー2 |

これらは `auth.users` / `auth.identities` を直接 INSERT し、`allowed_emails` / `profiles` にも投入されるので RLS の招待制ガードを通過する。Login 画面の DEV ONLY パネルから 1 クリックでログインできる。
