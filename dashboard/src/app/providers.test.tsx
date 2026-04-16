import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useQueryClient } from '@tanstack/react-query'
import { AUTH_STORAGE_KEY } from '@/lib/storage'
import { selectApiKey, useAuthStore } from '@/state/auth-store'
import { AppProviders } from './providers'

const QueryClientProbe = () => {
  const queryClient = useQueryClient()

  return <div>{queryClient ? 'query-client-ready' : 'query-client-missing'}</div>
}

const AuthProbe = () => {
  const apiKey = useAuthStore(selectApiKey)

  return <div>{apiKey || 'missing-auth-key'}</div>
}

afterEach(() => {
  useAuthStore.getState().clearApiKey()
  useAuthStore.setState({ hasHydrated: false })
  window.localStorage.clear()
})

describe('AppProviders', () => {
  it('provides a query client to descendants', async () => {
    render(
      <AppProviders>
        <QueryClientProbe />
      </AppProviders>,
    )

    expect(await screen.findByText('query-client-ready')).toBeInTheDocument()
  })

  it('waits for persisted auth rehydration before rendering descendants', async () => {
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        state: {
          apiKey: 'persisted-key',
        },
        version: 0,
      }),
    )

    render(
      <AppProviders>
        <AuthProbe />
      </AppProviders>,
    )

    expect(await screen.findByText('persisted-key')).toBeInTheDocument()
  })
})
