import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { AUTH_STORAGE_KEY } from '@/lib/storage'

type AuthStoreState = {
  apiKey: string
  hasHydrated: boolean
  setApiKey: (apiKey: string) => void
  clearApiKey: () => void
  setHasHydrated: (hasHydrated: boolean) => void
}

const legacyAwareStorage: StateStorage = {
  getItem: name => {
    const rawValue = localStorage.getItem(name)
    if (rawValue === null) {
      return null
    }

    const trimmedValue = rawValue.trim()
    if (!trimmedValue) {
      return null
    }

    try {
      JSON.parse(trimmedValue)
      return trimmedValue
    } catch {
      return JSON.stringify({
        state: {
          apiKey: trimmedValue,
        },
        version: 0,
      })
    }
  },
  setItem: (name, value) => {
    localStorage.setItem(name, value)
  },
  removeItem: name => {
    localStorage.removeItem(name)
  },
}

export const selectApiKey = (state: AuthStoreState) => state.apiKey
export const selectHasHydrated = (state: AuthStoreState) => state.hasHydrated
export const selectIsAuthenticated = (state: AuthStoreState) => Boolean(state.apiKey.trim())

export const useAuthStore = create<AuthStoreState>()(
  persist(
    set => ({
      apiKey: '',
      hasHydrated: false,
      setApiKey: apiKey => {
        set({ apiKey: apiKey.trim() })
      },
      clearApiKey: () => {
        set({ apiKey: '' })
      },
      setHasHydrated: hasHydrated => {
        set({ hasHydrated })
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => legacyAwareStorage),
      skipHydration: true,
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true)
      },
      partialize: state => ({
        apiKey: state.apiKey,
      }),
    },
  ),
)
