-- 食べログ百名店マスターを単一 row「食べログ百名店」に集約する。
-- 0010 で 16 ジャンル別（ラーメン / 寿司 / 焼肉 / ...）に投入したエントリは全廃止し、
-- 「食べログ百名店 掲載か否か」だけで運用する。
--
-- 設計判断：
--  - 部門の細分（ラーメン・寿司 等）は restaurant 側の `genre_id` ですでに表現できる
--    ため、award 側にも持つと重複・齟齬の原因になる
--  - 地域分割（TOKYO/EAST/WEST/HOKKAIDO 等）も同じ理由で 1 件にまとめる
--
-- 前提：本番で restaurant_awards から削除対象 award を参照している行は存在しない
-- （award_id は ON DELETE SET NULL だが、その時 custom_label も NULL なら
--  CHECK `restaurant_awards_target_required` に抵触する。確認済で 0 件）。

-- 「食べログ百名店 XXX」（末尾に半角スペース＋ジャンル名がつくもの）を全削除。
-- 半角スペース付きの LIKE にすることで、新規投入予定の単一 row「食べログ百名店」
-- を意図せず巻き込まないようにし、再実行時もべき等になる。
DELETE FROM public.awards
 WHERE name LIKE '食べログ百名店 %';

-- 単一 row を投入。sort_order は 0010 で「食べログ百名店」帯として割り当てられていた
-- 200 番台の先頭に置く（The Tabelog Award の直後）。
INSERT INTO public.awards (name, category, sort_order) VALUES
  ('食べログ百名店', 'tabelog', 200)
ON CONFLICT (name) DO NOTHING;
