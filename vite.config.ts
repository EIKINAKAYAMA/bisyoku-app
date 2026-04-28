import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const REPO_NAME = 'bisyoku-app'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? `/${REPO_NAME}/` : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false }, // dev では SW を登録しない
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '美食 App',
        short_name: '美食',
        description: '家族・友人グループの飲食店レビューアプリ',
        theme_color: '#f56a14',
        background_color: '#fffaf5',
        display: 'standalone',
        start_url: `/${REPO_NAME}/`,
        scope: `/${REPO_NAME}/`,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallback: 'index.html',
        // Supabase オリジンは絶対にキャッシュしない（古い JWT・レスポンスを返さないため）
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/, /127\.0\.0\.1:54321/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('supabase.co') ||
              url.host === '127.0.0.1:54321',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // vendor を分離してアプリコード変更時のキャッシュ無効化を最小化する。
        // node_modules 内のパッケージ単位でグループ化（react / supabase / radix / その他）。
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('@radix-ui')) return 'vendor-radix'
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('@tanstack')) return 'vendor-query'
          return 'vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
}))
