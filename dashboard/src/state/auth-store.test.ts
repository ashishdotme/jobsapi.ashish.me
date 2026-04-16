import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AUTH_STORAGE_KEY } from '@/lib/storage'
import { selectIsAuthenticated, useAuthStore } from './auth-store'

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({ apiKey: '', hasHydrated: false })
  })

  afterEach(() => {
    useAuthStore.getState().clearApiKey()
    window.localStorage.clear()
  })

  it('persists the api key and derives authenticated state', async () => {
    await useAuthStore.persist.rehydrate()

    useAuthStore.getState().setApiKey('  valid-key  ')

    expect(useAuthStore.getState().apiKey).toBe('valid-key')
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}')).toEqual({
      state: {
        apiKey: 'valid-key',
      },
      version: 0,
    })
  })

  it('clears the api key from the runtime store and storage', async () => {
    await useAuthStore.persist.rehydrate()

    useAuthStore.getState().setApiKey('valid-key')
    useAuthStore.getState().clearApiKey()

    expect(useAuthStore.getState().apiKey).toBe('')
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}')).toEqual({
      state: {
        apiKey: '',
      },
      version: 0,
    })
  })
})
