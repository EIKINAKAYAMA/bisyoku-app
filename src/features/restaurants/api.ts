import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { PriceRange } from '@/lib/constants'
import { extractCoordsFromMapsUrl } from './mapsUrl'
import { haversineKm } from './distance'

export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type RatingSummary = Database['public']['Views']['restaurant_rating_summary']['Row']

export type RestaurantWithSummary = Restaurant & {
  genre: { id: string; name: string } | null
  summary: RatingSummary | null
  /** ユーザー位置からの距離 (km)。nearby フィルタ／sort='nearby' 指定時のみ算出。 */
  distanceKm: number | null
}

export type RestaurantSort = 'recent' | 'name' | 'rating-high' | 'nearby'

export type RestaurantFilters = {
  query?: string
  genreId?: string
  priceRange?: PriceRange
  minOverall?: number
  area?: string
  /** 近い順ソート／距離表示の起点。sort='nearby' のときに必要。 */
  userLocation?: { lat: number; lng: number }
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
  if (filters.area) {
    restaurantsQuery = restaurantsQuery.eq('area', filters.area)
  }

  // 並び順
  switch (filters.sort) {
    case 'name':
      restaurantsQuery = restaurantsQuery.order('name', { ascending: true })
      break
    case 'rating-high':
    case 'nearby':
      // VIEW / 計算列は DB 側で並べられないので一旦 created_at で取り、後でクライアント側ソート
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

  let mapped = (restaurantsResult.data ?? []).map<RestaurantWithSummary>((row) => {
    const coords = extractCoordsFromMapsUrl(row.google_maps_url)
    const distanceKm =
      filters.userLocation && coords
        ? haversineKm(filters.userLocation, coords)
        : null
    return {
      ...row,
      summary: summaryMap.get(row.id) ?? null,
      distanceKm,
    }
  })

  if (filters.minOverall != null) {
    mapped = mapped.filter((r) => (r.summary?.avg_overall ?? 0) >= filters.minOverall!)
  }

  if (filters.sort === 'rating-high') {
    mapped.sort(
      (a, b) => (b.summary?.avg_overall ?? -1) - (a.summary?.avg_overall ?? -1)
    )
  }
  if (filters.sort === 'nearby') {
    // 座標が取れない店（短縮 URL 等）は距離不明として末尾に。
    mapped.sort((a, b) => {
      const ad = a.distanceKm ?? Number.POSITIVE_INFINITY
      const bd = b.distanceKm ?? Number.POSITIVE_INFINITY
      return ad - bd
    })
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
    distanceKm: null,
  }
}

export type CreateRestaurantInput = {
  name: string
  link: string | null
  genre_id: string
  price_range: PriceRange
  google_maps_url: string | null
  tabelog_url: string | null
  area: string | null
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
  // RLS は「訪問記録 0 件のとき招待ユーザー全員可」（migration 0007）。
  // RLS で弾かれた場合 PostgREST はエラーを返さず 0 行影響で成功扱いになるため、
  // .select() で削除行を必ず受け取り、0 行なら例外を投げてレース時の silent fail を検知する。
  // 典型例: 自分が画面を見ている間に他人が訪問記録を追加 → ボタンが古い状態で押される。
  const { data, error } = await supabase
    .from('restaurants')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error(
      '店舗を削除できませんでした。訪問記録が追加された可能性があります。'
    )
  }
}

/**
 * 登録済み店舗の area 一覧（重複なし、五十音/アルファベット順）を返す。
 * 一覧ページの「エリア」フィルタの選択肢を組み立てるために使う。
 * 件数が少ない（家族・友人グループ規模）ので全件取って集計する。
 */
export async function listRestaurantAreas(): Promise<string[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('area')
    .not('area', 'is', null)
  if (error) throw error
  const set = new Set<string>()
  for (const row of data ?? []) {
    if (row.area) set.add(row.area)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ja'))
}

export async function countVisitsForRestaurant(restaurantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  if (error) throw error
  return count ?? 0
}
