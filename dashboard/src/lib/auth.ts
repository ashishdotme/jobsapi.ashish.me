const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE ?? 'https://api.ashish.me'

export const INVALID_API_KEY_MESSAGE = 'Invalid API key'
export const API_KEY_REQUIRED_MESSAGE = 'API key is required'

const normalizeApiKey = (apiKey: string) => apiKey.trim()

export const validateApiKey = async (apiKey: string): Promise<void> => {
  const normalizedApiKey = normalizeApiKey(apiKey)

  if (!normalizedApiKey) {
    throw new Error(API_KEY_REQUIRED_MESSAGE)
  }

  const response = await fetch(new URL('/login', AUTH_API_BASE).toString(), {
    method: 'POST',
    headers: {
      apiKey: normalizedApiKey,
    },
  })

  if (response.status === 401) {
    throw new Error(INVALID_API_KEY_MESSAGE)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.success) {
    throw new Error('Unable to sign in right now')
  }
}
