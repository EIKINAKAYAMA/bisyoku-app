export const PRICE_RANGES = [
  '〜2000',
  '2000〜5000',
  '5000〜10000',
  '10000〜20000',
  '20000〜',
] as const

export type PriceRange = (typeof PRICE_RANGES)[number]

/** 一覧系ページの 1 ページ分件数。「もっと見る」で +PAGE_SIZE する。 */
export const LIST_PAGE_SIZE = 30

export const RATING_AXES = [
  { key: 'overall', label: '総合' },
  { key: 'food', label: '料理' },
  { key: 'service', label: 'サービス' },
  { key: 'atmosphere', label: '雰囲気' },
  { key: 'cost_performance', label: 'コスパ' },
] as const

export type RatingAxisKey = (typeof RATING_AXES)[number]['key']

// 入力対象の軸（総合は 4 軸の平均から自動算出するため除外）
export const RATING_SUB_AXES = [
  { key: 'food', label: '料理' },
  { key: 'service', label: 'サービス' },
  { key: 'atmosphere', label: '雰囲気' },
  { key: 'cost_performance', label: 'コスパ' },
] as const

export type RatingSubAxisKey = (typeof RATING_SUB_AXES)[number]['key']
