# 07. 状態管理（TanStack Query）

サーバ状態は **TanStack Query** で一元管理。コンポーネントローカルな UI 状態（フォーム入力中、モーダル開閉等）のみ `useState` を使う。

## デフォルト設定（`src/lib/queryClient.ts`）

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 分。招待制クローズドなので頻繁な再 fetch は不要
      gcTime:    1000 * 60 * 30,  // 30 分間メモリ保持（戻る操作で即表示）
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
})
```

家族・友人の小規模利用ではフォーカス変更や mount 毎の自動再 fetch は不要、変更直後の invalidation で十分という前提。

## クエリキー：必ず `qk` ファクトリ経由

`src/lib/queryKeys.ts` の `qk` に集約。**文字列リテラルを直接書かない**（無効化漏れ・タイポの温床）。

```ts
qk = {
  restaurants: {
    all:       ['restaurants'],
    list:      (filters) => ['restaurants', filters],
    detail:    (id)      => ['restaurant', id],
  },
  visits: {
    all:                  ['visits'],
    forRestaurant:        (rid)        => ['visits', 'restaurant', rid],
    forRestaurantPaged:   (rid, limit) => ['visits', 'restaurant', rid, limit],
    forUser:              (uid)        => ['visits', 'user', uid],
    forUserPaged:         (uid, limit) => ['visits', 'user', uid, limit],
    allForUsers:          ['visits', 'user'],
    countForRestaurant:   (rid)        => ['visits', 'count', rid],
    detail:               (vid)        => ['visit', vid],
  },
  genres: {
    all: ['genres'],
  },
  profiles: {
    all:    ['profiles'],
    detail: (id) => ['profile', id],
  },
}
```

階層は左から右に粒度を細かくする。`invalidateQueries` は前方一致なので、`qk.visits.forRestaurant(id)` を渡すと `forRestaurantPaged(id, limit)` 等の派生キーもまとめて無効化される。

## Invalidation の集約：`invalidateAfterVisitChange`

訪問・評価が変更された後の invalidation は **`invalidateAfterVisitChange(qc, restaurantId)`** に集約：

```ts
export function invalidateAfterVisitChange(qc: QueryClient, restaurantId: string): void {
  qc.invalidateQueries({ queryKey: qk.visits.forRestaurant(restaurantId) })
  qc.invalidateQueries({ queryKey: qk.visits.countForRestaurant(restaurantId) })
  qc.invalidateQueries({ queryKey: qk.restaurants.detail(restaurantId) })
  qc.invalidateQueries({ queryKey: qk.restaurants.all })
  qc.invalidateQueries({ queryKey: qk.visits.allForUsers })
}
```

訪問の create / update / delete 後は**必ずこれを呼ぶ**。
ページ毎に `invalidateQueries` を 5 連発書くのは禁止（無効化漏れの温床）。

## Mutation のパターン

```ts
const updateMut = useMutation({
  mutationFn: (input) => updateVisit(visitId, input),
  onSuccess: () => {
    invalidateAfterVisitChange(queryClient, restaurantId)
    queryClient.invalidateQueries({ queryKey: qk.visits.detail(visitId) })
    navigate(`/restaurants/${restaurantId}`, { replace: true })
  },
})
```

成功時：
1. 関連キャッシュを invalidate
2. `replace: true` で遷移（戻るボタンで編集画面に戻らないため）
3. エラーは `useMutation` の `error` で `setTopError` するか throw して `try/catch`

## いつどのキーを使うか

| 操作 | 影響を受けるクエリ | invalidate するキー |
|---|---|---|
| 店舗の作成 | 一覧 | `qk.restaurants.all` |
| 店舗の更新 | 詳細・一覧 | `qk.restaurants.detail(id)`、`qk.restaurants.all` |
| 店舗の削除 | 一覧・全ユーザー履歴 | `qk.restaurants.all`、`qk.visits.allForUsers` |
| 訪問・評価の create / update / delete | 上記まとめて | `invalidateAfterVisitChange(qc, restaurantId)` |
| ジャンル追加 | ジャンル選択肢 | `qk.genres.all` |
| プロフィール更新 | プロフィール一覧 + 訪問記録に embed の display_name | `qk.profiles.all`、`qk.visits.all` |

## 既存クエリへの追加方針

新しいクエリを追加する時は：

1. `qk` に対応するキー factory を追加する（既存階層に乗る形で）
2. feature の `api.ts` に対応する取得関数を追加
3. ページで `useQuery({ queryKey: qk.xxx.yyy(...), queryFn: () => xxx(...) })`
4. その data を変えうる mutation には対応する `invalidateQueries` を必ず追記

## ページング戦略

「もっと見る」方式：`useState<number>(LIST_PAGE_SIZE)` で `limit` を持ち、ボタン押下で `setLimit(n => n + LIST_PAGE_SIZE)`。`hasMore = data.length === limit` で判定（取得件数が limit と一致したらまだあるかも、と判断）。

`LIST_PAGE_SIZE = 30`（`src/lib/constants.ts`）。

## クライアント側ソート / フィルタが許される場合

通常は DB 側でやるが、以下の場合のみクライアント実装：
- `RestaurantList` の `minOverall` フィルタ：`restaurant_rating_summary` VIEW を merge した後でないと判定できないため
- `RestaurantList` の `rating-high` ソート：同上
- ページング（`offset` / `limit`）も上記フィルタ・ソートの後で適用するため DB の `range()` ではなくクライアント `slice()`

それ以外（`query` の ILIKE、`genreId` 等）は DB 側で適用する。
