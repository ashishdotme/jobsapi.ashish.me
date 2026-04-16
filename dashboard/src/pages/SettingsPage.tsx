import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { selectApiKey, selectHasHydrated, useAuthStore } from '@/state/auth-store'

export const SettingsPage = () => {
  const navigate = useNavigate()
  const hasHydrated = useAuthStore(selectHasHydrated)
  const apiKey = useAuthStore(selectApiKey)
  const storeSetApiKey = useAuthStore(state => state.setApiKey)
  const storeClearApiKey = useAuthStore(state => state.clearApiKey)
  const [apiKeyValue, setApiKeyValue] = useState(apiKey)
  const [saved, setSaved] = useState(false)

  if (!hasHydrated) {
    return null
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    storeSetApiKey(apiKeyValue)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const onClear = () => {
    storeClearApiKey()
    setApiKeyValue('')
    setSaved(false)
    navigate('/login', { replace: true })
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure dashboard runtime settings.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>
            Stored locally in your browser. Never sent to logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="password"
              value={apiKeyValue}
              onChange={event => setApiKeyValue(event.target.value)}
              placeholder="Enter jobsapi API key"
            />

            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              <Button type="button" variant="outline" onClick={onClear}>Clear</Button>
            </div>

            {saved && (
              <Alert className="border-success/20 bg-success/5">
                <AlertDescription className="text-success">Saved</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
