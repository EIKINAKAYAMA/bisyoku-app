# 05. Feature モジュール仕様

`src/features/<feature>/` 単位で **API（Supabase アクセス）と UI を同梱**する。
横断的な型・関数のみ `src/lib` / `src/types` に置く。

## 共通方針

- **UI から `supabase` SDK を直接叩かない**。必ず feature の `api.ts` 経由でアクセスする
- **クエリキーは必ず `qk` ファクトリ経由**（[`07-state-management.md`](./07-state-management.md) を参照）
- **同期的な集計（avg / count）は VIEW を使う**。クライアントでループして平均を出さない
- **DB 型は `src/types/database.ts`**（`npm run db:types` で再生成、コミット必須）

---

## `features/auth/`

### 構成
| ファイル | 役割 |
|---|---|
| `AuthProvider.tsx` | session / profile / loading のグローバル状態。`useAuth()` を export |
| `RequireAuth.tsx` | ログインガードの HOC |
| `signupIntent.ts` | sessionStorage キー `signup_passphrase` / `auth_intent` の読み書き集約 |

### 主要 API
- `useAuth()` → `{ session, user, profile, profileStatus, loading, signInWithGoogle, signOut, refreshProfile }`
- `signInWithGoogle()`：`redirectTo` を `${origin}${pathname}#/auth/callback` に組み立てて OAuth へ
- `refreshProfile()`：`/auth/callback` 後やプロフィール更新後に呼ぶ
- `setSignupIntent(passphrase)` / `readSignupIntent()` / `clearSignupIntent()`

詳細フローは [`03-auth.md`](./03-auth.md) を参照。

---

## `features/restaurants/`

### 構成
| ファイル | 役割 |
|---|---|
| `api.ts` | Supabase アクセス関数 |
| `RestaurantForm.tsx` | 新規・編集の共通フォーム（React Hook Form + Zod） |
| `mapsUrl.ts` | Google Maps URL から座標を抽出 |

### 型
```ts
type Restaurant       = Database['public']['Tables']['restaurants']['Row']
type RatingSummary    = Database['public']['Views']['restaurant_rating_summary']['Row']

type RestaurantWithSummary = Restaurant & {
  genre: { id: string; name: string } | null
  summary: RatingSummary | null
}

type RestaurantSort = 'recent' | 'name' | 'rating-high'

type RestaurantFilters = {
  query?: string         // 部分一致（ILIKE）
  genreId?: string
  priceRange?: PriceRange
  minOverall?: number    // クライアント側フィルタ
  sort?: RestaurantSort
  limit?: number
  offset?: number
}
```

### API
| 関数 | 動作 |
|---|---|
| `listRestaurants(filters)` | restaurants と summary を**並列取得しクライアントで merge**。`minOverall` フィルタと `rating-high` ソートはクライアント側適用（VIEW に FK が無く PostgREST embed が効かないため） |
| `getRestaurant(id)` | restaurants と summary を並列取得し merge |
| `createRestaurant(input, userId)` | `created_by = userId` を埋めて INSERT |
| `updateRestaurant(id, input)` | UPDATE |
| `deleteRestaurant(id)` | DELETE。visits → ratings は ON DELETE CASCADE で連鎖削除 |
| `countVisitsForRestaurant(id)` | 削除確認ダイアログで cascade 件数表示用 |

### 入力スキーマ（`RestaurantForm`）
```ts
z.object({
  name: z.string().min(1).max(120),
  link: optionalUrl,                         // http(s):// から始まる任意 URL
  genre_id: z.string().min(1),
  price_range: z.enum(PRICE_RANGES),
  google_maps_url: optionalUrl,
  tabelog_url: optionalUrl,
})
```

`optionalUrl` は「未入力 OK・入力されていれば `http(s)://` 始まり・最大 1000 文字」。

### `mapsUrl.ts`：`extractCoordsFromMapsUrl(url)`
Google Maps の URL から `{ lat, lng }` を抽出。対応 3 パターン：
- `@<lat>,<lng>,<zoom>z`
- `?q=<lat>,<lng>` / `&q=<lat>,<lng>`
- `!3d<lat>!4d<lng>`

範囲チェック（`|lat| <= 90`、`|lng| <= 180`）。
**短縮 URL（`maps.app.goo.gl/*` 等）は CORS でリダイレクト解決が塞がれるため未対応**。

---

## `features/visits/`

### 構成
| ファイル | 役割 |
|---|---|
| `api.ts` | Supabase アクセス |
| `VisitForm.tsx` | 訪問 + 評価の入力フォーム |
| `VisitItem.tsx` | 訪問カード（店舗詳細とユーザー履歴の両方で使う） |

### 型
```ts
type Visit  = Database['public']['Tables']['visits']['Row']
type Rating = Database['public']['Tables']['ratings']['Row']

type VisitWithRatingAndUser = Visit & {
  rating: Rating | null
  user: { id: string; display_name: string; avatar_url: string | null } | null
}

type VisitWithRestaurant = Visit & {
  rating: Rating | null
  restaurant: {
    id: string; name: string; price_range: string;
    genre: { id: string; name: string } | null
  } | null
}

type RatingInput = { overall, food, service, atmosphere, cost_performance: number }
type VisitInput  = {
  visit_date: string | null
  order_content: string | null
  payment_amount: number | null
  comment: string | null
  rating: RatingInput | null
}
```

PostgREST の embed 仕様で `ratings` が配列にも単体にもなり得るため、`pickRating()` で `0..1` に正規化している。

### API
| 関数 | 動作 |
|---|---|
| `listVisitsForRestaurant(restaurantId, { limit, offset })` | 店舗に紐づく訪問を visit_date desc / created_at desc で取得。`rating` と `user` を embed |
| `listVisitsForUser(userId, { limit, offset })` | ユーザーの訪問を取得。`rating` と `restaurant`（+ genre）を embed |
| `getVisit(visitId)` | 単体取得（編集ページで使う） |
| `createVisit(input + restaurant_id, userId)` | visits を insert → rating があれば ratings も insert |
| `updateVisit(visitId, input)` | visits を update → rating の有無で `ratings` を upsert / delete（評価を外せる） |
| `deleteVisit(visitId)` | visits を delete（ratings は CASCADE で連鎖削除） |

### 入力スキーマ（`VisitForm`）
- `visit_date`：任意（HTML date input）
- `order_content`：任意 text（`<= 2000 文字`）
- `payment_amount`：任意 integer >= 0（`preprocess` で空文字を null へ）
- `comment`：任意 text（`<= 4000 文字`）
- `include_rating`：boolean（チェック時のみ 5 軸を必須化）
- `overall / food / service / atmosphere / cost_performance`：integer 1〜10（`include_rating` のとき必須）

### `VisitItem` の表示モード
`primary` prop で 2 モード：
- `{ kind: 'user', user: Owner }` → 店舗詳細：「by ユーザー名」アバター付きヘッダ、ユーザーページへリンク
- `{ kind: 'restaurant', restaurant, genre, priceRange }` → ユーザー履歴：店舗名ヘッダ + ジャンル/価格帯バッジ

評価がある時は 5 軸を `ratingTone()` の色付きで表示。コメントは強調枠で表示。注文・支払金額は border-top 付きで補足表示。

---

## `features/genres/`

### 構成
| ファイル | 役割 |
|---|---|
| `api.ts` | listGenres / createGenre |

### API
- `listGenres()` → `name ASC` で全件
- `createGenre(name, userId)`：**`name.normalize('NFKC').trim()`** → INSERT。空文字なら例外。`23505`（UNIQUE 違反）は「すでに存在します。再選択してください。」で再ラップ

UI からは `src/components/GenreField.tsx` を経由して使う（Select + 追加用インライン Input）。

---

## `features/users/`

### 構成
| ファイル | 役割 |
|---|---|
| `api.ts` | listProfiles / getProfile / updateProfile |

### API
- `listProfiles()` → `display_name ASC` で全件（`MyProfile` のメンバー一覧で使う）
- `getProfile(id)` → `maybeSingle()`（`UserVisits` のヘッダ表示用）
- `updateProfile(id, { display_name?, avatar_url? })` → UPDATE

`avatar_url` は基本 `AuthProvider.syncFromAuthMeta` が Google から自動同期する。ユーザーが UI から avatar_url を直接編集する画面は無い。
`display_name` は UI から編集可（`MyProfile`）、Google からの自動同期はしない。
