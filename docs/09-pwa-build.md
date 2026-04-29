# 09. ビルド・PWA

## Vite 設定（`vite.config.ts`）の要点

### `base`
```ts
base: mode === 'production' ? '/bisyoku-app/' : '/'
```
GitHub Pages のリポジトリ配信パスに合わせる。**カスタムドメインを使う場合は `'/'` に変更**。

### Path alias
```ts
resolve: { alias: { '@': path.resolve(__dirname, './src') } }
```
`tsconfig.app.json` の `paths` と同期している。

### Plugins
- `@vitejs/plugin-react`
- `vite-plugin-pwa`

### Build options
- `sourcemap: true`（本番でも sourcemap を出す）
- `manualChunks`：`@supabase` を `vendor-supabase`、その他 `node_modules` を `vendor` に集約

## コード分割戦略

### Route-level splitting
`src/App.tsx` で全ページを `React.lazy(() => import('@/pages/Xxx').then(m => ({ default: m.Xxx })))` で読み込む。HashRouter なので prefetch hint は不要、最初に踏んだルートが必要なチャンクをロードする。

新ページ追加時は同パターンを踏襲：
```tsx
const NewPage = lazy(() => import('@/pages/NewPage').then(m => ({ default: m.NewPage })))
```

### Vendor chunk 戦略

過去に `react / radix / tanstack / その他` で chunk を細かく分けたが、Vite の CJS→ESM interop と ESM 静的 import 解決の組み合わせで、別 chunk の React の named export（`forwardRef` 等）が undefined のまま lucide-react / radix 等のモジュール本体が評価される事故が起きた（`Cannot read properties of undefined (reading 'forwardRef')` at lucide-react/Icon.js）。

**現在の方針**：
- React に依存する node_modules を別 chunk に出さない（`vendor` 1 個に集約）
- Supabase は React 非依存・サイズが大きい・更新頻度も独立なので分離維持（`vendor-supabase`）

```ts
manualChunks(id) {
  if (!id.includes('node_modules')) return
  if (id.includes('@supabase')) return 'vendor-supabase'
  return 'vendor'
}
```

新たに分離したくなった場合は React 依存パッケージを追い出さないか必ず確認する。

## PWA（vite-plugin-pwa）

### Manifest
```ts
manifest: {
  name: '美食 App',
  short_name: '美食',
  theme_color: '#f56a14',
  background_color: '#fffaf5',
  display: 'standalone',
  start_url: '/bisyoku-app/',
  scope:     '/bisyoku-app/',
  icons: [
    { src: 'pwa-64x64.png',  sizes: '64x64',  type: 'image/png' },
    { src: 'pwa-192x192.png',sizes: '192x192',type: 'image/png' },
    { src: 'pwa-512x512.png',sizes: '512x512',type: 'image/png' },
    { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
```

`includeAssets`: `['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png']`。

アイコン再生成：`npm run pwa:icons`（`@vite-pwa/assets-generator` で `public/favicon.svg` から作る）。

### Service Worker
- `registerType: 'autoUpdate'`（新バージョンを検知したら自動で次回ロード時に置き換え）
- `devOptions: { enabled: false }`（dev では SW を登録しない）

### Workbox runtime caching

```ts
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
  navigateFallback: 'index.html',
  navigateFallbackDenylist: [/^\/api/, /supabase\.co/, /127\.0\.0\.1:54321/],
  runtimeCaching: [
    {
      urlPattern: ({ url }) =>
        url.hostname.endsWith('supabase.co') ||
        url.host === '127.0.0.1:54321',
      handler: 'NetworkOnly',
    },
  ],
}
```

**Supabase オリジンは絶対にキャッシュしない**（古い JWT・期限切れレスポンスを返さないため）。

### dev mode の SW 掃除

`src/main.tsx`：dev 時は過去ビルドで登録された SW と Cache を毎回クリアする：

```ts
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs =>
      Promise.all(regs.map(r => r.unregister()))
    )
  }
  if ('caches' in window) {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  }
}
```

## index.html / 404 fallback

- `index.html` は最小構成で `<div id="root">` のみ
- `deploy.yml` で `cp dist/index.html dist/404.html` し、SPA 404 フォールバックを仕込む（HashRouter なので必須ではないが保険）

## 環境変数の埋め込み

クライアントに公開できるのは `VITE_PUBLIC_*` プレフィクス付きのみ：

| 変数 | 用途 |
|---|---|
| `VITE_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable Key（旧 anon key の新名称） |

それ以外（合言葉ハッシュ等）は **絶対に `import.meta.env` 経由で読まない**。詳細は [`10-infra-ops.md`](./10-infra-ops.md) を参照。

## TypeScript ビルド

`npm run build` は `tsc -b && vite build` の 2 段階：
1. `tsc -b`：プロジェクト参照（`tsconfig.app.json` / `tsconfig.node.json`）で型チェック
2. `vite build`：ビルド成果物を `dist/` に出力

## バンドルサイズ目安

家族・友人スケールでは細かい最適化は不要だが、目安：
- `vendor` チャンク（React + radix + tanstack 等）：〜350KB（gzip 前）
- `vendor-supabase`：〜100KB
- 各ページ：5〜30KB
