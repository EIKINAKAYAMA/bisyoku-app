-- 称号（awards）機能。
--
-- 設計：
--  - `awards`           ：admin 管理の固定マスター（ジャンルと同じ運用思想で
--                          INSERT/UPDATE/DELETE はクライアント不可、admin が Studio から）
--  - `restaurant_awards`：店舗 ↔ award の中間テーブル。custom_label を持つ事で
--                          マスターに無いローカル賞も自由入力できる。
--                          award_id か custom_label のどちらかは必須（CHECK）。
--                          year は任意（取得年度／例：「2024 年版ミシュラン1つ星」）。
--                          店舗マスタ同様に invited ユーザー全員が編集可能。

-- ============================================================
-- ENUM / TABLES
-- ============================================================

CREATE TYPE public.award_category_enum AS ENUM (
  'michelin',
  'tabelog',
  'global',
  'japan_media',
  'other'
);

CREATE TABLE public.awards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  category   public.award_category_enum NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.restaurant_awards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  award_id      uuid REFERENCES public.awards(id) ON DELETE SET NULL,
  custom_label  text,
  year          smallint CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_awards_target_required
    CHECK (award_id IS NOT NULL OR (custom_label IS NOT NULL AND length(btrim(custom_label)) > 0))
);

CREATE INDEX idx_restaurant_awards_restaurant ON public.restaurant_awards(restaurant_id);
CREATE INDEX idx_restaurant_awards_award      ON public.restaurant_awards(award_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.awards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_awards ENABLE ROW LEVEL SECURITY;

-- awards: SELECT のみクライアントに開放。INSERT/UPDATE/DELETE は admin (Service Role) のみ
CREATE POLICY "awards select for invited"
  ON public.awards FOR SELECT
  TO authenticated
  USING (public.is_invited_user());

-- restaurant_awards: 店舗マスタと同じ哲学で invited 全員が CRUD 可能
CREATE POLICY "restaurant_awards select for invited"
  ON public.restaurant_awards FOR SELECT
  TO authenticated
  USING (public.is_invited_user());

CREATE POLICY "restaurant_awards insert for invited"
  ON public.restaurant_awards FOR INSERT
  TO authenticated
  WITH CHECK (public.is_invited_user());

CREATE POLICY "restaurant_awards update for invited"
  ON public.restaurant_awards FOR UPDATE
  TO authenticated
  USING (public.is_invited_user())
  WITH CHECK (public.is_invited_user());

CREATE POLICY "restaurant_awards delete for invited"
  ON public.restaurant_awards FOR DELETE
  TO authenticated
  USING (public.is_invited_user());

-- ============================================================
-- デフォルトマスター 30 件
-- ============================================================

INSERT INTO public.awards (name, category, sort_order) VALUES
  -- ミシュラン
  ('ミシュラン3つ星',                 'michelin',    10),
  ('ミシュラン2つ星',                 'michelin',    20),
  ('ミシュラン1つ星',                 'michelin',    30),
  ('ビブグルマン',                    'michelin',    40),
  ('ミシュランセレクテッド',          'michelin',    50),
  -- 食べログ The Tabelog Award
  ('The Tabelog Award Gold',          'tabelog',    100),
  ('The Tabelog Award Silver',        'tabelog',    110),
  ('The Tabelog Award Bronze',        'tabelog',    120),
  -- 食べログ百名店
  ('食べログ百名店 ラーメン',         'tabelog',    200),
  ('食べログ百名店 寿司',             'tabelog',    210),
  ('食べログ百名店 焼肉',             'tabelog',    220),
  ('食べログ百名店 中華',             'tabelog',    230),
  ('食べログ百名店 そば',             'tabelog',    240),
  ('食べログ百名店 天ぷら',           'tabelog',    250),
  ('食べログ百名店 ハンバーガー',     'tabelog',    260),
  ('食べログ百名店 カレー',           'tabelog',    270),
  ('食べログ百名店 とんかつ',         'tabelog',    280),
  ('食べログ百名店 うどん',           'tabelog',    290),
  ('食べログ百名店 イタリアン',       'tabelog',    300),
  ('食べログ百名店 フレンチ',         'tabelog',    310),
  ('食べログ百名店 カフェ',           'tabelog',    320),
  ('食べログ百名店 スイーツ',         'tabelog',    330),
  ('食べログ百名店 パン',             'tabelog',    340),
  ('食べログ百名店 居酒屋',           'tabelog',    350),
  -- 国際
  ('World''s 50 Best Restaurants',    'global',     400),
  ('Asia''s 50 Best Restaurants',     'global',     410),
  ('ゴ・エ・ミヨ',                    'global',     420),
  -- 日本メディア
  ('Retty TOP100',                    'japan_media',500),
  ('一休.com レストラン Gold',        'japan_media',510),
  ('ぐるなびシェフ・オブ・ザ・イヤー','japan_media',520)
ON CONFLICT (name) DO NOTHING;
