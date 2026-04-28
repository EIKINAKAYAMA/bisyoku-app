import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, profileStatus, loading } = useAuth()
  const location = useLocation()

  if (loading || profileStatus === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        読み込み中...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (profileStatus === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-destructive">プロフィールの読み込みに失敗しました。</p>
        <p className="text-sm text-muted-foreground">
          時間をおいて再読み込みしてください。問題が続く場合は管理者に連絡。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          再読み込み
        </button>
      </div>
    )
  }

  // profileStatus === 'ok' で profile=null の場合は本当に未招待
  if (!profile) {
    return <Navigate to="/login?error=not-invited" replace />
  }

  return <>{children}</>
}
