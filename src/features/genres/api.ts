import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Genre = Database['public']['Tables']['genres']['Row']

export async function listGenres(): Promise<Genre[]> {
  const { data, error } = await supabase.from('genres').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function createGenre(name: string, userId: string): Promise<Genre> {
  // NFKC 正規化 + trim
  const normalized = name.normalize('NFKC').trim()
  if (!normalized) throw new Error('ジャンル名が空です')

  const { data, error } = await supabase
    .from('genres')
    .insert({ name: normalized, created_by: userId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('そのジャンルは既に存在します。再選択してください。')
    }
    throw error
  }
  return data
}
