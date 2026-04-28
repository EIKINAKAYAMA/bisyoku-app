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

export async function listVisitsForRestaurant(
  restaurantId: string
): Promise<VisitWithRatingAndUser[]> {
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
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<
    Visit & {
      rating: Rating[] | Rating | null
      user: { id: string; display_name: string; avatar_url: string | null } | null
    }
  >
  return rows.map((row) => ({
    ...row,
    rating: Array.isArray(row.rating) ? (row.rating[0] ?? null) : row.rating,
  }))
}

export async function listVisitsForUser(
  userId: string
): Promise<VisitWithRestaurant[]> {
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
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<
    Visit & {
      rating: Rating[] | Rating | null
      restaurant: VisitWithRestaurant['restaurant']
    }
  >
  return rows.map((row) => ({
    ...row,
    rating: Array.isArray(row.rating) ? (row.rating[0] ?? null) : row.rating,
  }))
}

export type CreateVisitInput = {
  restaurant_id: string
  visit_date: string | null
  order_content: string | null
  payment_amount: number | null
  rating: {
    overall: number
    food: number
    service: number
    atmosphere: number
    cost_performance: number
  } | null
}

export async function createVisit(input: CreateVisitInput, userId: string) {
  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .insert({
      restaurant_id: input.restaurant_id,
      user_id: userId,
      visit_date: input.visit_date,
      order_content: input.order_content,
      payment_amount: input.payment_amount,
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
