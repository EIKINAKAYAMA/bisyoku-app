-- 店舗マスタは家族・友人グループで共有して育てるデータなので、
-- 「登録した本人だけが編集できる」制約を撤廃し、招待済みユーザーなら誰でも
-- 名前・ジャンル・URL 等を直せるようにする。
-- 一方で DELETE は連鎖削除（visits → ratings の CASCADE）の影響範囲が大きいため、
-- 引き続き作成者のみに制限する（0004 のポリシーは変更しない）。
DROP POLICY IF EXISTS "restaurants update own" ON public.restaurants;

CREATE POLICY "restaurants update for invited"
  ON public.restaurants FOR UPDATE
  TO authenticated
  USING (public.is_invited_user())
  WITH CHECK (public.is_invited_user());
