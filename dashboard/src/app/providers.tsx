import { useEffect, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { dashboardQueryClient } from './query-client'
import { selectHasHydrated, useAuthStore } from '@/state/auth-store'

type AppProvidersProps = {
  children: ReactNode
}

const AuthBootstrap = ({ children }: AppProvidersProps) => {
  const hasHydrated = useAuthStore(selectHasHydrated)

  useEffect(() => {
    void useAuthStore.persist.rehydrate()
  }, [])

  if (!hasHydrated) {
    return null
  }

  return children
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <QueryClientProvider client={dashboardQueryClient}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  )
}
