import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { HashRouter } from 'react-router-dom'
import { App } from '@/App'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'
import { queryClient } from '@/lib/queryClient'
import '@/index.css'

// dev モードでは過去ビルドの Service Worker / Cache が悪さをするので毎回掃除する。
// 本番では vite-plugin-pwa が正規の SW を登録するため、ここでは何もしない。
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {})
  }
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {})
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

createRoot(root).render(
  <StrictMode>
    <ChunkErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HashRouter>
      </QueryClientProvider>
    </ChunkErrorBoundary>
  </StrictMode>
)
