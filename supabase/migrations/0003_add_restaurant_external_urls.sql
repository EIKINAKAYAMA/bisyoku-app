-- 店舗詳細から開く外部サービスへの直リンク。
-- 「Google Maps と食べログのボタンを正確にその店舗へ飛ばす」のが目的。
-- 地図のピンも google_maps_url の中の `@lat,lng` 等から座標を抽出して描画する。
ALTER TABLE public.restaurants ADD COLUMN google_maps_url text;
ALTER TABLE public.restaurants ADD COLUMN tabelog_url     text;

-- 既存運用での救済：generic な link 欄に Google Maps / 食べログ の URL が
-- 入っているレコードは、それぞれの専用フィールドへ移し替える。
-- 該当しないリンク（公式サイト・予約ページ等）は link に残す。
UPDATE public.restaurants
   SET google_maps_url = link, link = NULL
 WHERE link ~* '^https?://(www\.)?(google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)';

UPDATE public.restaurants
   SET tabelog_url = link, link = NULL
 WHERE link ~* '^https?://([a-z0-9-]+\.)?tabelog\.com';
