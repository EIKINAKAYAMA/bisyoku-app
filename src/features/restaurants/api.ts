import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { PriceRange } from '@/lib/constants'

export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type RatingSummary = Database['public']['Views']['restaurant_rating_summary']['Row']

export type RestaurantWithSummary = Restaurant & {
  genre: { id: string; name: string } | null
  summary: RatingSummary | null
}

export type RestaurantFilters = {
  query?: string
  genreId?: string
  priceRange?: PriceRange
  minOverall?: number
}

export async function listRestaurants(
  filters: RestaurantFilters = {}
): Promise<RestaurantWithSummary[]> {
  let query = supabase
    .from('restaurants')
    .select(
      `*,
       genre:genres(id, name),
       summary:restaurant_rating_summary(*)`
    )
    .order('created_at', { ascending: false })

  if (filters.query) {
    query = query.ilike('name', `%${filters.query}%`)
  }
  if (filters.genreId) {
    query = query.eq('genre_id', filters.genreId)
  }
  if (filters.priceRange) {
    query = query.eq('price_range', filters.priceRange)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<
    Restaurant & {
      genre: { id: string; name: string } | null
      summary: RatingSummary[] | RatingSummary | null
    }
  >

  let mapped = rows.map<RestaurantWithSummary>((row) => ({
    ...row,
    summary: Array.isArray(row.summary) ? (row.summary[0] ?? null) : row.summary,
  }))

  if (filters.minOverall != null) {
    mapped = mapped.filter(
      (r) => (r.summary?.avg_overall ?? 0) >= filters.minOverall!
    )
  }

  return mapped
}

export async function getRestaurant(id: string): Promise<RestaurantWithSummary | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      `*,
       genre:genres(id, name),
       summary:restaurant_rating_summary(*)`
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as Restaurant & {
    genre: { id: string; name: string } | null
    summary: RatingSummary[] | RatingSummary | null
  }
  return {
    ...row,
    summary: Array.isArray(row.summary) ? (row.summary[0] ?? null) : row.summary,
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
