import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getApiKey, setApiKey } from '../lib/storage'

export const SettingsPage = () => {
  const [apiKey, setApiKeyValue] = useState(getApiKey())
  const [saved, setSaved] = useState(false)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setApiKey(apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const onClear = () => {
    setApiKey('')
    setApiKeyValue('')
    setSaved(false)
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
              value={apiKey}
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
