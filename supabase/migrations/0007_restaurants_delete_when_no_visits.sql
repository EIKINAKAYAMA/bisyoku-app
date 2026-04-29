-- 0006 で UPDATE を全員可にしたのに合わせて、DELETE も「招待ユーザー全員」が
-- 実行できるように緩和する。ただし他人の訪問記録・評価が CASCADE で巻き込まれて
-- 消えるのは事故リスクが大きいため、「訪問記録が 1 件もぶら下がっていない店舗」に
-- 限定する。これにより:
--   - 自分しか触っていない店（visit 0 件）は誰でも片付けられる
--   - 1 件でも訪問記録がある店は、まず該当 visit の所有者が visit を消さない限り
--     restaurant 自体は消せない（他人のデータが意図せず消える事故が物理的に発生しない）
DROP POLICY IF EXISTS "restaurants delete own" ON public.restaurants;

CREATE POLICY "restaurants delete for invited when no visits"
  ON public.restaurants FOR DELETE
  TO authenticated
  USING (
    public.is_invited_user()
    AND NOT EXISTS (
      SELECT 1 FROM public.visits v WHERE v.restaurant_id = restaurants.id
    )
  );
