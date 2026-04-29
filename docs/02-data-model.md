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

ジャンル。任意のログインユーザーが追加可。

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `name` | text | NOT NULL **UNIQUE** |
| `created_by` | uuid | FK → profiles（SET NULL） |
| `created_at` | timestamptz | DEFAULT now() |

挿入時はクライアントで `NFKC` 正規化 + `trim` → 同名衝突は `23505`（UNIQUE 違反）として検知し、UI でエラー表示。

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
| `genres` | invited | invited 且つ `created_by = auth.uid()` | 作成者のみ | × |
| `restaurants` | invited | invited 且つ `created_by = auth.uid()` | 作成者のみ | 作成者のみ |
| `visits` | invited | invited 且つ `user_id = auth.uid()` | 本人のみ | 本人のみ |
| `ratings` | invited | 親 visit が本人のもの | 同左 | 同左 |
| `health` | anon + authenticated | × | × | × |

> `restaurants` の DELETE ポリシーは migration `0004` で追加された。`0001` では SELECT / INSERT / UPDATE のみだったため、UI に削除ボタンはあっても RLS で 0 行影響に silent fail していた可能性がある。

> `genres` には DELETE ポリシーが無い（=削除不可）。`restaurants.genre_id` が `ON DELETE RESTRICT` で守られていることもあり、UI からも削除できない設計。必要になれば別途追加する。

## マイグレーション運用

`supabase/migrations/<timestamp>_<name>.sql` に SQL を追記し、ローカルで `supabase db reset` → `npm run db:types` で型再生成 → main マージで CI が `supabase db push` する。

| ファイル | 内容 |
|---|---|
| `0001_init.sql` | 初期スキーマ + RLS + view + health |
| `0002_add_visit_comment.sql` | `visits.comment` 列追加 |
| `0003_add_restaurant_external_urls.sql` | `restaurants.google_maps_url`, `tabelog_url` 列追加 + 既存 `link` の救済データ移行 |
| `0004_add_restaurants_delete_policy.sql` | `restaurants` の DELETE ポリシー追加（作成者のみ削除可） |

## seed（ローカル専用）

`supabase/seed.sql` は `supabase db reset` 時のみ実行され、`supabase db push` には含まれない（=本番に流れない）。

| Email | Password | display_name |
|---|---|---|
| `dev1@local.test` | `devpass` | 開発ユーザー1 |
| `dev2@local.test` | `devpass` | 開発ユーザー2 |

これらは `auth.users` / `auth.identities` を直接 INSERT し、`allowed_emails` / `profiles` にも投入されるので RLS の招待制ガードを通過する。Login 画面の DEV ONLY パネルから 1 クリックでログインできる。
