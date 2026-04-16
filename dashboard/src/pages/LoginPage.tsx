import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Film } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { API_KEY_REQUIRED_MESSAGE, validateApiKey } from '@/lib/auth'
import { selectHasHydrated, selectIsAuthenticated, useAuthStore } from '@/state/auth-store'

export const LoginPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/imports'
  const [apiKey, setApiKeyValue] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasHydrated = useAuthStore(selectHasHydrated)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const storeSetApiKey = useAuthStore(state => state.setApiKey)

  if (!hasHydrated) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!apiKey.trim()) {
      setError(API_KEY_REQUIRED_MESSAGE)
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await validateApiKey(apiKey)
      storeSetApiKey(apiKey)
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in right now')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(84,97,237,0.08),_transparent_35%),linear-gradient(180deg,_rgba(244,247,251,0.96),_rgba(255,255,255,1))] px-4 py-10">
      <Card className="w-full max-w-md border-border/70 bg-background/95 shadow-xl shadow-slate-950/5 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Film className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Sign in to JobsAPI</CardTitle>
            <CardDescription>
              Enter your API key to unlock the dashboard.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label htmlFor="api-key" className="block text-sm font-medium text-foreground">
                API key
              </label>
              <Input
                id="api-key"
                type="password"
                autoComplete="current-password"
                value={apiKey}
                onChange={event => setApiKeyValue(event.target.value)}
                placeholder="Enter your api.ashish.me key"
                disabled={isSubmitting}
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Validating...' : 'Unlock dashboard'}
            </Button>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
