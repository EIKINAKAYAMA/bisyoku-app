import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { PriceRange } from '@/lib/constants'

export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type RatingSummary = Database['public']['Views']['restaurant_rating_summary']['Row']

export type RestaurantWithSummary = Restaurant & {
  genre: { id: string; name: string } | null
  summary: RatingSummary | null
}

export type RestaurantSort = 'recent' | 'name' | 'rating-high'

export type RestaurantFilters = {
  query?: string
  genreId?: string
  priceRange?: PriceRange
  minOverall?: number
  sort?: RestaurantSort
  limit?: number
  offset?: number
}

export async function listRestaurants(
  filters: RestaurantFilters = {}
): Promise<RestaurantWithSummary[]> {
  let restaurantsQuery = supabase.from('restaurants').select('*, genre:genres(id, name)')

  if (filters.query) {
    restaurantsQuery = restaurantsQuery.ilike('name', `%${filters.query}%`)
  }
  if (filters.genreId) {
    restaurantsQuery = restaurantsQuery.eq('genre_id', filters.genreId)
  }
  if (filters.priceRange) {
    restaurantsQuery = restaurantsQuery.eq('price_range', filters.priceRange)
  }

  // 並び順
  switch (filters.sort) {
    case 'name':
      restaurantsQuery = restaurantsQuery.order('name', { ascending: true })
      break
    case 'rating-high':
      // VIEW は FK 経由で並べられないので一旦 created_at で取り、後でクライアント側ソート
      restaurantsQuery = restaurantsQuery.order('created_at', { ascending: false })
      break
    case 'recent':
    default:
      restaurantsQuery = restaurantsQuery.order('created_at', { ascending: false })
  }

  // restaurants と summary を並列で取得し、クライアント側で merge
  // （VIEW には FK が無いため PostgREST の自動 embed が効かない）
  // フィルタ前の summary を全件取るが、家族・友人グループ規模では行数も少なく
  // 1 ラウンドトリップ削減のメリットの方が大きい。
  const [restaurantsResult, summariesResult] = await Promise.all([
    restaurantsQuery,
    supabase.from('restaurant_rating_summary').select('*'),
  ])

  if (restaurantsResult.error) throw restaurantsResult.error
  if (summariesResult.error) throw summariesResult.error

  const summaryMap = new Map<string, RatingSummary>()
  for (const s of summariesResult.data ?? []) {
    if (s.restaurant_id) summaryMap.set(s.restaurant_id, s)
  }

  let mapped = (restaurantsResult.data ?? []).map<RestaurantWithSummary>((row) => ({
    ...row,
    summary: summaryMap.get(row.id) ?? null,
  }))

  if (filters.minOverall != null) {
    mapped = mapped.filter((r) => (r.summary?.avg_overall ?? 0) >= filters.minOverall!)
  }

  if (filters.sort === 'rating-high') {
    mapped.sort(
      (a, b) => (b.summary?.avg_overall ?? -1) - (a.summary?.avg_overall ?? -1)
    )
  }

  // ページング（クライアント側で適用：minOverall フィルタや rating-high ソートが
  // クライアントで動くため、DB レベルで range() するとずれが出る）
  const offset = filters.offset ?? 0
  const limit = filters.limit ?? 50
  return mapped.slice(offset, offset + limit)
}

export async function getRestaurant(id: string): Promise<RestaurantWithSummary | null> {
  const [restaurantResult, summaryResult] = await Promise.all([
    supabase
      .from('restaurants')
      .select('*, genre:genres(id, name)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('restaurant_rating_summary')
      .select('*')
      .eq('restaurant_id', id)
      .maybeSingle(),
  ])

  if (restaurantResult.error) throw restaurantResult.error
  if (summaryResult.error) throw summaryResult.error
  if (!restaurantResult.data) return null

  return {
    ...restaurantResult.data,
    summary: summaryResult.data ?? null,
  }
}

export type CreateRestaurantInput = {
  name: string
  link: string | null
  genre_id: string
  price_range: PriceRange
}

export async function createRestaurant(
  input: CreateRestaurantInput,
  userId: string
): Promise<Restaurant> {
  const { data, error } = await supabase
    .from('restaurants')
    .insert({ ...input, created_by: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRestaurant(
  id: string,
  input: CreateRestaurantInput
): Promise<Restaurant> {
  const { data, error } = await supabase
    .from('restaurants')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRestaurant(id: string): Promise<void> {
  // visits → ratings は ON DELETE CASCADE で連鎖削除される
  const { error } = await supabase.from('restaurants').delete().eq('id', id)
  if (error) throw error
}

export async function countVisitsForRestaurant(restaurantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  if (error) throw error
  return count ?? 0
}
