-- bisyoku-app: 初期スキーマ + RLS + view + health table

-- ============================================================
-- ENUM
-- ============================================================
CREATE TYPE public.price_range_enum AS ENUM (
  '〜2000',
  '2000〜5000',
  '5000〜10000',
  '10000〜20000',
  '20000〜'
);

-- ============================================================
-- TABLES
-- ============================================================

-- profiles: auth.users と 1:1
CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- allowed_emails: 招待許諾リスト（Edge Function だけが書き込む）
CREATE TABLE public.allowed_emails (
  email      text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- genres: ユーザー追加可
CREATE TABLE public.genres (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- restaurants: 店舗マスタ（共有）
CREATE TABLE public.restaurants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  link        text,
  genre_id    uuid NOT NULL REFERENCES public.genres(id) ON DELETE RESTRICT,
  price_range public.price_range_enum NOT NULL,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_restaurants_genre   ON public.restaurants(genre_id);
CREATE INDEX idx_restaurants_created ON public.restaurants(created_at DESC);

-- visits: 訪問記録（任意）
CREATE TABLE public.visits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visit_date      date,
  order_content   text,
  payment_amount  integer CHECK (payment_amount IS NULL OR payment_amount >= 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_visits_restaurant ON public.visits(restaurant_id);
CREATE INDEX idx_visits_user       ON public.visits(user_id);

-- ratings: 評価（visit に 0..1）
CREATE TABLE public.ratings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id         uuid NOT NULL UNIQUE REFERENCES public.visits(id) ON DELETE CASCADE,
  overall          smallint NOT NULL CHECK (overall          BETWEEN 1 AND 10),
  food             smallint NOT NULL CHECK (food             BETWEEN 1 AND 10),
  service          smallint NOT NULL CHECK (service          BETWEEN 1 AND 10),
  atmosphere       smallint NOT NULL CHECK (atmosphere       BETWEEN 1 AND 10),
  cost_performance smallint NOT NULL CHECK (cost_performance BETWEEN 1 AND 10)
);

-- health: Pause 防止 cron が叩く単一行テーブル
CREATE TABLE public.health (
  id        smallint PRIMARY KEY CHECK (id = 1),
  pinged_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.health (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VIEW: 集計値
-- ============================================================
CREATE OR REPLACE VIEW public.restaurant_rating_summary AS
SELECT
  r.id                                        AS restaurant_id,
  COUNT(rt.id)                                AS rating_count,
  ROUND(AVG(rt.overall)::numeric, 1)          AS avg_overall,
  ROUND(AVG(rt.food)::numeric, 1)             AS avg_food,
  ROUND(AVG(rt.service)::numeric, 1)          AS avg_service,
  ROUND(AVG(rt.atmosphere)::numeric, 1)       AS avg_atmosphere,
  ROUND(AVG(rt.cost_performance)::numeric, 1) AS avg_cost_performance
FROM public.restaurants r
LEFT JOIN public.visits  v  ON v.restaurant_id = r.id
LEFT JOIN public.ratings rt ON rt.visit_id     = v.id
GROUP BY r.id;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health         ENABLE ROW LEVEL SECURITY;

-- 招待制ガード（profile 不在ならアクセス全拒否）の共通条件関数
CREATE OR REPLACE FUNCTION public.is_invited_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
$$;

-- profiles
CREATE POLICY "profiles select for invited"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_invited_user());

CREATE POLICY "profiles update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- allowed_emails: クライアントから一切アクセス不可
-- （ポリシー無し ＋ RLS 有効 ＝ Service Role 以外は何もできない）

-- genres
CREATE POLICY "genres select for invited"
  ON public.genres FOR SELECT
  TO authenticated
  USING (public.is_invited_user());

CREATE POLICY "genres insert for invited"
  ON public.genres FOR INSERT
  TO authenticated
  WITH CHECK (public.is_invited_user() AND created_by = auth.uid());

CREATE POLICY "genres update own"
  ON public.genres FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- restaurants
CREATE POLICY "restaurants select for invited"
  ON public.restaurants FOR SELECT
  TO authenticated
  USING (public.is_invited_user());

CREATE POLICY "restaurants insert for invited"
  ON public.restaurants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_invited_user() AND created_by = auth.uid());

CREATE POLICY "restaurants update own"
  ON public.restaurants FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- visits
CREATE POLICY "visits select for invited"
  ON public.visits FOR SELECT
  TO authenticated
  USING (public.is_invited_user());

CREATE POLICY "visits insert own"
  ON public.visits FOR INSERT
  TO authenticated
  WITH CHECK (public.is_invited_user() AND user_id = auth.uid());

CREATE POLICY "visits update own"
  ON public.visits FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "visits delete own"
  ON public.visits FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ratings: visits の所有者と一致しているか visit_id 経由で確認
CREATE POLICY "ratings select for invited"
  ON public.ratings FOR SELECT
  TO authenticated
  USING (public.is_invited_user());

CREATE POLICY "ratings insert own"
  ON public.ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_invited_user()
    AND EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = ratings.visit_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "ratings update own"
  ON public.ratings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = ratings.visit_id AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = ratings.visit_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "ratings delete own"
  ON public.ratings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = ratings.visit_id AND v.user_id = auth.uid()
    )
  );

-- health: 認証なしで SELECT 可（keepalive cron 用）
CREATE POLICY "health public read"
  ON public.health FOR SELECT
  TO anon, authenticated
  USING (true);
