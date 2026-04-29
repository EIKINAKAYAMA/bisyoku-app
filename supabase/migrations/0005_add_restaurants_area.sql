-- 一覧ページでのエリア絞り込み用に、店舗マスタへ任意の area テキスト列を追加。
-- 例: "渋谷"、"自由が丘"、"横浜駅周辺" のような短いラベル。
-- 厳密な住所ではなく「ざっくりどの辺か」を投稿者が手入力するためのフィールド。
ALTER TABLE public.restaurants ADD COLUMN area text;

-- 一覧でエリア別に絞り込むことが多いのでインデックスを張っておく。
CREATE INDEX idx_restaurants_area ON public.restaurants(area);
