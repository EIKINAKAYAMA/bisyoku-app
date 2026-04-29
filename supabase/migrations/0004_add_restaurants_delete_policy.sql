-- restaurants の DELETE ポリシーを追加。
-- 0001_init.sql では SELECT / INSERT / UPDATE のみ定義していたため、
-- RLS 有効 ＋ DELETE ポリシー無し ＝ DELETE が silent に 0 行影響でフェイルしていた。
-- UI（RestaurantDetail.tsx）には作成者向けの削除ボタンがあるため、ポリシーを追加して
-- 「作成者本人だけが削除できる」ようにする。
-- visits → ratings は ON DELETE CASCADE で連鎖削除される。
CREATE POLICY "restaurants delete own"
  ON public.restaurants FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
