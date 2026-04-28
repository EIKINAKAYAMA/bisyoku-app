import type { QueryClient } from '@tanstack/react-query'

// TanStack Query のキーをここに集約する。
// 文字列キーをコード上に散らさないことで、無効化漏れ・タイポを防ぐ。
//
// 階層は左から右に粒度を細かくする：
//   ['restaurants']                              一覧（filters 違いも全部含む）
//   ['restaurant', id]                           単体
//   ['visits', 'restaurant', restaurantId]       特定店舗の訪問一覧
//   ['visits', 'user', userId]                   特定ユーザーの訪問一覧
//   ['visits', 'count', restaurantId]            訪問件数
//   ['visit', visitId]                           訪問単体
// invalidateQueries は前方一致で動くので、`['visits', 'restaurant', id]` を渡すと
// `['visits', 'restaurant', id, limit]` のような派生キーもまとめて無効化される。

export const qk = {
  restaurants: {
    all: ['restaurants'] as const,
    list: (filters: unknown) => ['restaurants', filters] as const,
    detail: (id: string) => ['restaurant', id] as const,
  },
  visits: {
    /** 全ての visits クエリ（restaurant・user・count 含む）を前方一致で無効化したい時 */
    all: ['visits'] as const,
    forRestaurant: (restaurantId: string) =>
      ['visits', 'restaurant', restaurantId] as const,
    forRestaurantPaged: (restaurantId: string, limit: number) =>
      ['visits', 'restaurant', restaurantId, limit] as const,
    forUser: (userId: string) => ['visits', 'user', userId] as const,
    forUserPaged: (userId: string, limit: number) =>
      ['visits', 'user', userId, limit] as const,
    /** 全ユーザーぶんを前方一致で無効化したい時 */
    allForUsers: ['visits', 'user'] as const,
    countForRestaurant: (restaurantId: string) =>
      ['visits', 'count', restaurantId] as const,
    detail: (visitId: string) => ['visit', visitId] as const,
  },
  genres: {
    all: ['genres'] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    detail: (id: string) => ['profile', id] as const,
  },
}

/**
 * 訪問・評価が変更された後に無効化すべきキャッシュをまとめて invalidate する。
 * - その店舗の訪問一覧 / 訪問件数
 * - 店舗詳細（avg_overall などの集計が変わるため）
 * - 一覧（avg_overall 表示・並び替えに影響）
 * - 全ユーザーの訪問履歴ページ（誰が見ているかわからない）
 */
export function invalidateAfterVisitChange(
  qc: QueryClient,
  restaurantId: string
): void {
  qc.invalidateQueries({ queryKey: qk.visits.forRestaurant(restaurantId) })
  qc.invalidateQueries({ queryKey: qk.visits.countForRestaurant(restaurantId) })
  qc.invalidateQueries({ queryKey: qk.restaurants.detail(restaurantId) })
  qc.invalidateQueries({ queryKey: qk.restaurants.all })
  qc.invalidateQueries({ queryKey: qk.visits.allForUsers })
}
