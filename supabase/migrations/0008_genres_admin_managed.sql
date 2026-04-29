-- ジャンルを「管理者が編集する固定マスター」に切り替える。
--   - クライアント（招待ユーザー）からの INSERT / UPDATE を全面禁止
--   - 管理者は Supabase Studio (Service Role) から SQL を直接叩いて管理する
--   - 既存のユーザー追加ジャンルはそのまま残し、admin が手で整理して
--     不要になったものを後から削除する想定
DROP POLICY IF EXISTS "genres insert for invited" ON public.genres;
DROP POLICY IF EXISTS "genres update own"          ON public.genres;

-- デフォルトマスター投入。`name` が UNIQUE なので
-- ON CONFLICT DO NOTHING で既存と重複する行はスキップされる。
INSERT INTO public.genres (name) VALUES
  ('和食'),
  ('寿司'),
  ('天ぷら'),
  ('そば・うどん'),
  ('ラーメン'),
  ('焼肉・ホルモン'),
  ('焼鳥'),
  ('とんかつ・揚げ物'),
  ('鍋・しゃぶしゃぶ'),
  ('居酒屋'),
  ('定食・食堂'),
  ('中華'),
  ('韓国料理'),
  ('アジア・エスニック'),
  ('イタリアン・ピザ'),
  ('フレンチ'),
  ('洋食・ビストロ'),
  ('ステーキ・鉄板焼き'),
  ('ハンバーガー'),
  ('カレー'),
  ('カフェ・喫茶'),
  ('ベーカリー・サンドイッチ'),
  ('スイーツ'),
  ('バー'),
  ('その他')
ON CONFLICT (name) DO NOTHING;
