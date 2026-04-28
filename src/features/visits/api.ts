import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Visit = Database['public']['Tables']['visits']['Row']
export type Rating = Database['public']['Tables']['ratings']['Row']

export type VisitWithRatingAndUser = Visit & {
  rating: Rating | null
  user: { id: string; display_name: string; avatar_url: string | null } | null
}

export type VisitWithRestaurant = Visit & {
  rating: Rating | null
  restaurant: {
    id: string
    name: string
    price_range: string
    genre: { id: string; name: string } | null
  } | null
}

// PostgREST は visits.ratings 埋め込みを relationship の型に応じて
// 単体オブジェクトまたは配列で返してくる（生成型では配列扱い）。
// どちらでも 0..1 件として扱えるように先頭要素だけ取り出して正規化する。
type RawRating = Rating[] | Rating | null
function pickRating<T extends { rating: RawRating }>(
  row: T
): Omit<T, 'rating'> & { rating: Rating | null } {
  const r = row.rating
  return { ...row, rating: Array.isArray(r) ? (r[0] ?? null) : r }
}

export async function listVisitsForRestaurant(
  restaurantId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<VisitWithRatingAndUser[]> {
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 50
  const { data, error } = await supabase
    .from('visits')
    .select(
      `*,
       rating:ratings(*),
       user:profiles(id, display_name, avatar_url)`
    )
    .eq('restaurant_id', restaurantId)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data ?? []).map((row) =>
    pickRating(row as unknown as Visit & { rating: RawRating; user: VisitWithRatingAndUser['user'] })
  )
}

export async function listVisitsForUser(
  userId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<VisitWithRestaurant[]> {
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 50
  const { data, error } = await supabase
    .from('visits')
    .select(
      `*,
       rating:ratings(*),
       restaurant:restaurants(id, name, price_range, genre:genres(id, name))`
    )
    .eq('user_id', userId)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data ?? []).map((row) =>
    pickRating(
      row as unknown as Visit & { rating: RawRating; restaurant: VisitWithRestaurant['restaurant'] }
    )
  )
}

export type RatingInput = {
  overall: number
  food: number
  service: number
  atmosphere: number
  cost_performance: number
}

export type VisitInput = {
  visit_date: string | null
  order_content: string | null
  payment_amount: number | null
  comment: string | null
  rating: RatingInput | null
}

export async function getVisit(
  visitId: string
): Promise<(Visit & { rating: Rating | null }) | null> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, rating:ratings(*)')
    .eq('id', visitId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return pickRating(data as unknown as Visit & { rating: RawRating })
}

export async function createVisit(
  input: VisitInput & { restaurant_id: string },
  userId: string
) {
  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .insert({
      restaurant_id: input.restaurant_id,
      user_id: userId,
      visit_date: input.visit_date,
      order_content: input.order_content,
      payment_amount: input.payment_amount,
      comment: input.comment,
    })
    .select()
    .single()
  if (visitError) throw visitError

  if (input.rating) {
    const { error: ratingError } = await supabase.from('ratings').insert({
      visit_id: visit.id,
      ...input.rating,
    })
    if (ratingError) throw ratingError
  }

  return visit
}

export async function updateVisit(visitId: string, input: VisitInput) {
  // visits の本体を更新
  const { error: visitError } = await supabase
    .from('visits')
    .update({
      visit_date: input.visit_date,
      order_content: input.order_content,
      payment_amount: input.payment_amount,
      comment: input.comment,
    })
    .eq('id', visitId)
  if (visitError) throw visitError

  // 評価：rating が来ていれば upsert、無ければ削除（評価を外す）
  // visit_id は UNIQUE 制約があるので onConflict で 1 行に収束する。
  if (input.rating) {
    const { error } = await supabase
      .from('ratings')
      .upsert({ visit_id: visitId, ...input.rating }, { onConflict: 'visit_id' })
    if (error) throw error
  } else {
    const { error } = await supabase.from('ratings').delete().eq('visit_id', visitId)
    if (error) throw error
  }
}

export async function deleteVisit(visitId: string) {
  // ratings は ON DELETE CASCADE で自動削除される
  const { error } = await supabase.from('visits').delete().eq('id', visitId)
  if (error) throw error
}
