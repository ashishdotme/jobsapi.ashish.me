import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectHasHydrated, selectIsAuthenticated, useAuthStore } from '@/state/auth-store'

export const AuthGate = () => {
  const location = useLocation()
  const hasHydrated = useAuthStore(selectHasHydrated)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)

  if (!hasHydrated) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
