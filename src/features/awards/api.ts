import { supabase } from '@/lib/supabase'

export type AwardCategory =
  | 'michelin'
  | 'tabelog'
  | 'global'
  | 'japan_media'
  | 'other'

/**
 * 称号カテゴリの表示名と並び順。フォーム・フィルタ・チップで共通使用するため
 * ここを正としてエクスポートする。enum を増やすときは migration の
 * `award_category_enum` と一緒にここも更新する。
 */
export const AWARD_CATEGORIES: Array<{ value: AwardCategory; label: string }> = [
  { value: 'michelin', label: 'ミシュラン' },
  { value: 'tabelog', label: '食べログ' },
  { value: 'global', label: '国際' },
  { value: 'japan_media', label: '日本メディア' },
  { value: 'other', label: 'その他' },
]

export const AWARD_CATEGORY_LABEL: Record<AwardCategory, string> = Object.fromEntries(
  AWARD_CATEGORIES.map((c) => [c.value, c.label])
) as Record<AwardCategory, string>

export type Award = {
  id: string
  name: string
  category: AwardCategory
  sort_order: number
  created_at: string
}

/** restaurant_awards 行 + マスター情報を embed したもの */
export type RestaurantAwardWithMaster = {
  id: string
  restaurant_id: string
  award_id: string | null
  custom_label: string | null
  year: number | null
  created_at: string
  award: Pick<Award, 'id' | 'name' | 'category'> | null
}

/**
 * フォーム入力時の称号 1 件分。マスターから選んだ場合 award_id、
 * 自由入力（その他）の場合 custom_label を持つ。year は任意。
 */
export type AwardEntryInput = {
  award_id: string | null
  custom_label: string | null
  year: number | null
}

export async function listAwards(): Promise<Award[]> {
  const { data, error } = await supabase
    .from('awards')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Award[]
}

/**
 * 店舗の称号セットを (award_id, custom_label, year) のタプルキーで突き合わせ、
 * 差分（追加・削除）だけを DB に反映する。
 *
 * 全削除 → 全挿入だと、insert 側のネットワーク断で「変更していないものまで消失」する
 * （5 件 → 6 件にしようとして失敗 → 0 件になる）事故が起きる。
 * 差分なら：
 *  - 変更なしの行は触らない
 *  - 新規 insert を先・既存削除を後にすることで、部分失敗時のデータ消失リスクを最小化
 */
export async function setAwardsForRestaurant(
  restaurantId: string,
  entries: AwardEntryInput[]
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('restaurant_awards')
    .select('id, award_id, custom_label, year')
    .eq('restaurant_id', restaurantId)
  if (fetchErr) throw fetchErr

  const toKey = (e: {
    award_id: string | null
    custom_label: string | null
    year: number | null
  }) => `${e.award_id ?? ''}|${e.custom_label ?? ''}|${e.year ?? ''}`

  const existingByKey = new Map<string, string>()
  for (const row of existing ?? []) {
    existingByKey.set(toKey(row), row.id)
  }
  const newKeys = new Set(entries.map(toKey))

  const toDeleteIds: string[] = []
  for (const [key, id] of existingByKey) {
    if (!newKeys.has(key)) toDeleteIds.push(id)
  }
  const toInsert = entries.filter((e) => !existingByKey.has(toKey(e)))

  // 順序：新規 insert を先、既存 delete を後。途中失敗時に「消えてしまう」方を最小化する
  if (toInsert.length > 0) {
    const ins = await supabase.from('restaurant_awards').insert(
      toInsert.map((e) => ({
        restaurant_id: restaurantId,
        award_id: e.award_id,
        custom_label: e.custom_label,
        year: e.year,
      }))
    )
    if (ins.error) throw ins.error
  }
  if (toDeleteIds.length > 0) {
    const del = await supabase
      .from('restaurant_awards')
      .delete()
      .in('id', toDeleteIds)
    if (del.error) throw del.error
  }
}

/** RestaurantAwardWithMaster → AwardEntryInput（編集フォームの初期値生成用） */
export function toEntryInput(a: RestaurantAwardWithMaster): AwardEntryInput {
  return {
    award_id: a.award_id,
    custom_label: a.custom_label,
    year: a.year,
  }
}
