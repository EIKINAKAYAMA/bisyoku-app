import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AppLayout } from '@/components/AppLayout'

// route-level code splitting:
// - 認証ページ（未ログイン時のみ必要）と保護下のページを別チャンクに分けて初期 JS を縮める。
// - HashRouter なので prefetch hint は不要、最初に踏んだルートが必要なチャンクをロードする。
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('@/pages/Signup').then((m) => ({ default: m.Signup })))
const AuthCallback = lazy(() =>
  import('@/pages/AuthCallback').then((m) => ({ default: m.AuthCallback }))
)
const RestaurantList = lazy(() =>
  import('@/pages/RestaurantList').then((m) => ({ default: m.RestaurantList }))
)
const RestaurantNew = lazy(() =>
  import('@/pages/RestaurantNew').then((m) => ({ default: m.RestaurantNew }))
)
const RestaurantEdit = lazy(() =>
  import('@/pages/RestaurantEdit').then((m) => ({ default: m.RestaurantEdit }))
)
const RestaurantDetail = lazy(() =>
  import('@/pages/RestaurantDetail').then((m) => ({ default: m.RestaurantDetail }))
)
const VisitNew = lazy(() => import('@/pages/VisitNew').then((m) => ({ default: m.VisitNew })))
const VisitEdit = lazy(() => import('@/pages/VisitEdit').then((m) => ({ default: m.VisitEdit })))
const UserVisits = lazy(() =>
  import('@/pages/UserVisits').then((m) => ({ default: m.UserVisits }))
)
const MyProfile = lazy(() => import('@/pages/MyProfile').then((m) => ({ default: m.MyProfile })))

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      読み込み中...
    </div>
  )
}

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<RestaurantList />} />
          <Route path="/restaurants/new" element={<RestaurantNew />} />
          <Route path="/restaurants/:id/edit" element={<RestaurantEdit />} />
          <Route path="/restaurants/:id" element={<RestaurantDetail />} />
          <Route path="/restaurants/:id/visits/new" element={<VisitNew />} />
          <Route path="/restaurants/:id/visits/:visitId/edit" element={<VisitEdit />} />
          <Route path="/users/:id" element={<UserVisits />} />
          <Route path="/me" element={<MyProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
