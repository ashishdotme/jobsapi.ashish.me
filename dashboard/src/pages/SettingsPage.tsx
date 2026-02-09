import { useState } from 'react'
import type { FormEvent } from 'react'
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
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted">Configure dashboard runtime settings.</p>
      </header>

      <form onSubmit={onSubmit} className="ui-card-solid max-w-xl space-y-4 p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={event => setApiKeyValue(event.target.value)}
            placeholder="Enter jobsapi API key"
            className="ui-input"
          />
          <p className="mt-2 text-xs text-muted">
            Stored locally in your browser (localStorage). It is never rendered in logs by the dashboard.
          </p>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="ui-btn-primary">
            Save
          </button>
          <button
            type="button"
            onClick={onClear}
            className="ui-btn border border-border bg-surface2/60 px-4 py-3 text-ink/85 hover:border-accent/25 hover:bg-accent/10"
          >
            Clear
          </button>
        </div>

        {saved && <div className="rounded-xl border border-good/20 bg-good/10 p-3 text-sm text-good">Saved</div>}
      </form>
    </section>
  )
}
