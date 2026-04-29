import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Genre = Database['public']['Tables']['genres']['Row']

export async function listGenres(): Promise<Genre[]> {
  const { data, error } = await supabase.from('genres').select('*').order('name')
  if (error) throw error
  return data ?? []
}
