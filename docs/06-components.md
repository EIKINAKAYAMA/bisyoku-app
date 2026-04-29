# 06. コンポーネント

## 階層

```
src/components/
├── AppLayout.tsx         全認証ルートを包むレイアウト（ヘッダ + ボトムナビ）
├── BackButton.tsx        navigate(-1) するだけの戻るボタン
├── ConfirmDialog.tsx     Yes/No 確認ダイアログ（destructive variant 対応）
├── GenreField.tsx        ジャンル選択 + インライン追加 Select
├── RestaurantMap.tsx     OSM iframe で地図ピン表示
└── ui/                   shadcn/ui スタイルのプリミティブ
    ├── avatar.tsx        独自実装（Radix 非依存・<img> + イニシャル fallback）
    ├── button.tsx        cva ベースの styled button
    ├── card.tsx          styled wrapper（角丸 + border + shadow）
    ├── dialog.tsx        @radix-ui/react-dialog ラッパー
    ├── input.tsx         styled <input>
    ├── label.tsx         @radix-ui/react-label ラッパー
    ├── select.tsx        @radix-ui/react-select ラッパー
    └── textarea.tsx      styled <textarea>
```

## レイアウト：`AppLayout`

| 要素 | 内容 |
|---|---|
| ヘッダ（sticky top） | 美食 App ロゴ + Desktop ナビ（一覧 / 店を登録 / プロフィール）+ 右端にプロフィールアバター + ログアウト |
| メイン | `<Outlet />` を `container` 幅で中央寄せ |
| ボトムナビ（モバイルのみ） | 一覧 / 店を登録 / プロフィール の 3 タブ |

`<NavLink>` の `isActive` で塗り分け。色は Tailwind の theme（`hsl(var(--primary))` 等）。

## 共通プリミティブ（`src/components/ui/`）

shadcn/ui のテンプレートをコピーして調整したもの。多くは Radix プリミティブの styled wrapper（`dialog` / `select` / `label` / `button` の `Slot`）。Avatar だけは Radix Avatar を使わず自前実装している（用途が単純なため）。

### `Avatar`
- **Radix を使わない自前実装**（`@radix-ui/react-avatar` 非依存）
- `src` が無い／読込失敗時はイニシャル（先頭 1 文字）を表示
- Google プロフ画像対策で `referrerPolicy="no-referrer"`
- UTF-16 サロゲート対応（`Array.from(s)[0]`）

### `Dialog` / `ConfirmDialog`
- `Dialog` は Radix のラッパー
- `ConfirmDialog` は「title + description + 確認/キャンセルボタン」の薄い高レベル API
- `variant: 'destructive'` で警告アイコンと赤系ボタン
- `busy` prop でボタン disable + 「処理中...」表示

### `Select`
- Radix Select。`<SelectTrigger>` / `<SelectContent>` / `<SelectItem>` を組む

### `Button`
- `class-variance-authority` で variants（default / outline / ghost / destructive 等）と size（default / sm / lg / icon）
- `asChild` で `<Link>` 等にスタイルだけ移譲できる

### `Card` / `CardContent`
- 角丸 + `border` + シャドウのコンテナ

### `Input` / `Textarea` / `Label`
- 基本的な form プリミティブ

## アプリ固有コンポーネント

### `BackButton`
`navigate(-1)` を呼ぶだけのゴーストボタン。詳細・新規・編集ページの上部に配置する標準位置。

### `ConfirmDialog`
削除や破壊的操作の前に挟む。重複実装を避けるためフラットに使う：

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="..."
  description={<>...</>}
  variant="destructive"
  busy={mut.isPending}
  onConfirm={() => mut.mutate()}
/>
```

### `GenreField`
- 中身は Select + 「+」ボタン
- 「+」を押すとインラインで追加用 `<Input>` が出る
- 追加成功で `qk.genres.all` invalidate ＋ そのジャンルを選択状態にする
- 既存名衝突（`23505`）は API 側で日本語メッセージに変換済

### `RestaurantMap`
- props：`{ lat, lng, delta?, className? }`（`delta` 既定 0.005 ≒ 500m 四方）
- 中身は OpenStreetMap の `embed.html` への `<iframe loading="lazy">`
- Leaflet 等のライブラリを足すと bundle / SW キャッシュが膨らむため、**依存ゼロの iframe を採用**
- 座標が抽出できなければ詳細画面で**セクションごと非表示**（呼び出し元 = `RestaurantDetail` で `mapCoords` の有無で判定）

### `RestaurantForm` / `VisitForm` / `VisitItem`
これらは「複数ページで再利用する大きめの feature コンポーネント」なので `src/features/*/` に置く（`src/components/` ではない）。詳細は [`05-features.md`](./05-features.md)。

## カラー / トーン

- ベースカラーは Tailwind theme の HSL 変数（`src/index.css`）
- 食をテーマにした暖色系（vivid orange + golden amber）
- `lib/rating.ts` の `ratingTone(score)` がスコア帯に応じた Tailwind カラークラスを返す：
  - `>= 9` → `text-amber-500`（金色）
  - `>= 7` → `text-emerald-600 dark:text-emerald-400`
  - `>= 5` → `text-foreground`
  - その他 → `text-rose-500`
- ダークモード対応は `darkMode: ['class']` で Tailwind 的に準備済（UI トグルは現状なし）
