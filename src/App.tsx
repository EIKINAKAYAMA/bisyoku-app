import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AppLayout } from '@/components/AppLayout'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { AuthCallback } from '@/pages/AuthCallback'
import { RestaurantList } from '@/pages/RestaurantList'
import { RestaurantNew } from '@/pages/RestaurantNew'
import { RestaurantDetail } from '@/pages/RestaurantDetail'
import { VisitNew } from '@/pages/VisitNew'
import { UserVisits } from '@/pages/UserVisits'
import { MyProfile } from '@/pages/MyProfile'

export function App() {
  return (
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
        <Route path="/restaurants/:id" element={<RestaurantDetail />} />
        <Route path="/restaurants/:id/visits/new" element={<VisitNew />} />
        <Route path="/users/:id" element={<UserVisits />} />
        <Route path="/me" element={<MyProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
