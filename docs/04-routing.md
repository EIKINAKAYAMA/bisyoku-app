# 04. ルーティング

`HashRouter`（GitHub Pages のサブパス配信での 404 を回避するため）。
URL 上は `https://<host>/bisyoku-app/#/restaurants/abc` のように `#/` が挟まる。

## ルートマップ

| パス | ページ | 認証 | 概要 |
|---|---|---|---|
| `/login` | `pages/Login.tsx` | 不要 | Google ログイン。dev mode は seed ユーザーのワンクリックログイン |
| `/signup` | `pages/Signup.tsx` | 不要 | 合言葉入力 → `setSignupIntent()` → Google OAuth |
| `/auth/callback` | `pages/AuthCallback.tsx` | 不要 | OAuth コールバック。intent によって verify-passphrase 呼び出しか profile チェックに分岐 |
| `/` | `pages/RestaurantList.tsx` | 必要 | 店舗一覧（フィルタ・並び・「もっと見る」） |
| `/restaurants/new` | `pages/RestaurantNew.tsx` | 必要 | 店舗登録 |
| `/restaurants/:id` | `pages/RestaurantDetail.tsx` | 必要 | 店舗詳細（平均評価・地図・外部リンク・訪問記録一覧） |
| `/restaurants/:id/edit` | `pages/RestaurantEdit.tsx` | 必要 | 店舗編集（作成者のみ） |
| `/restaurants/:id/visits/new` | `pages/VisitNew.tsx` | 必要 | 訪問・評価追加 |
| `/restaurants/:id/visits/:visitId/edit` | `pages/VisitEdit.tsx` | 必要 | 訪問・評価編集（本人のみ） |
| `/users/:id` | `pages/UserVisits.tsx` | 必要 | ユーザーの訪問履歴一覧 |
| `/me` | `pages/MyProfile.tsx` | 必要 | プロフィール編集・メンバー一覧・ログアウト |
| `*` | → `/` redirect | — | フォールバック |

ルート定義は `src/App.tsx`。**全てのページコンポーネントは `React.lazy` で動的 import**（route-level code splitting）。
新しいページを追加する場合は `App.tsx` 内で同じパターンの `lazy(() => import(...))` を踏襲する。

## 認証ガード

`<RequireAuth>` が `/login`, `/signup`, `/auth/callback` 以外のすべてのルートを保護。

```tsx
<Route element={<RequireAuth><AppLayout /></RequireAuth>}>
  <Route path="/" element={<RestaurantList />} />
  ...
</Route>
```

判定詳細は [`03-auth.md`](./03-auth.md#requireauth) 参照。

## 各ページの責務（要約）

### `RestaurantList`
- レイアウトは **チップバー方式**（Google Maps / Airbnb / 食べログ系の標準）：検索 + プリセット行 + フィルタチップ行 + コンパクト一覧。カード表示は提供しない（家族・友人スケールでは情報密度を優先）
- フィルタ：検索キーワード（`useDebounced` 300ms）/ ジャンル / エリア / 価格帯 / 総合最低点 / 称号カテゴリ / ソート（recent / rating-high / name / nearby）/ 現在地
- **状態は全て URL クエリと双方向同期**（`useSearchParams` で単一の真の出所）。ブックマーク・共有・ブラウザ戻る/進む対応。`q` / `genre` / `area` / `price` / `min` / `award` / `sort` の 7 キー。default 値はキーごと URL から削除して URL を綺麗に保つ。`history.replaceState` 固定（フィルタ操作で履歴を増やさない）
- クイックプリセット：「ミシュラン」「百名店」「高評価 8.0+」「近くて高評価」（複数フィルタを一括設定。指定外は default にリセット、検索キーワードのみ温存）
- 「もっと見る」で `+LIST_PAGE_SIZE`（30 件）。`limit + 1` を fetch して超過分有無で `hasMore` を判定（クライアント側 filter で last page がちょうど limit に切れた時の「もっと見る → 0 件追加」を防ぐ）
- `genresQuery` / `listRestaurantAreas` を並列 fetch してチップの選択肢に
- 行レンダラ：`RestaurantRow`（評価 56px 固定幅で右寄せ、行を跨いで縦に揃う）
- `useQuery` のキー：`qk.restaurants.list(filters)`

### `RestaurantNew` / `RestaurantEdit`
- `RestaurantForm` を共通コンポーネントとして使う
- `RestaurantNew` は完了後 `replace: true` で `/restaurants/<id>` へ
- `RestaurantEdit` は `created_by !== user?.id` なら「登録した本人だけが編集できます」を表示

### `RestaurantDetail`
- 左カラム：店名・バッジ・外部リンク（`ExternalLinks`）・地図（`RestaurantMap`、座標が抽出できる場合のみ）・平均評価カード・訪問追加 CTA
- 右カラム：訪問記録一覧（`VisitItem`）・「もっと見る」
- 店舗削除：作成者のみボタン表示。確認ダイアログに紐づく訪問件数を表示し cascade を警告
- 訪問削除：本人のみ。`ConfirmDialog` で確認

### `VisitNew` / `VisitEdit`
- `VisitForm` を共通利用
- 完了後 `invalidateAfterVisitChange(qc, restaurantId)` で関連キャッシュを一括無効化
- `VisitEdit` は `user_id !== user?.id` なら「他のユーザーの訪問記録は編集できません」を表示

### `UserVisits`
- パスパラメータ `:id` のユーザーの訪問履歴
- 自分のページなら編集・削除可（本人判定）
- 削除時に紐づく restaurant のキャッシュも `invalidateAfterVisitChange` で一掃

### `MyProfile`
- 表示名の編集（`updateProfile` 後 `qk.profiles.all` と `qk.visits.all` を invalidate ＝ 訪問記録に embed されている display_name も更新するため）
- メンバー一覧（`profilesQuery`）：各メンバーカードから `/users/:id` へ
- ログアウトボタン

### `Login`
- Google ログイン
- URL クエリ `?error=not-invited` / `?error=passphrase` をエラーバナーとして表示
- DEV ONLY：seed ユーザーのワンクリックログインパネル

### `Signup`
- 合言葉入力 → `setSignupIntent` → `signInWithGoogle()`
- エラー時は `clearSignupIntent`

### `AuthCallback`
- 1 回しか走らないように `useRef` でガード
- `getSession()` 後、必要なら 500ms 待ってリトライ（`detectSessionInUrl` の処理待ち）
- intent に応じて Edge Function 呼び出し or profile 存在チェック
- 失敗時は `setTimeout` で 1.5〜2.5 秒後に `/login` へ
