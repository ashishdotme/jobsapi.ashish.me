import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadMovieCsv } from '../lib/api'
import { getApiKey } from '../lib/storage'

export const UploadPage = () => {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [dryRun, setDryRun] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const apiKeyMissing = useMemo(() => !getApiKey(), [])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) {
      setError('Select a CSV file first')
      return
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      setError('Set API key in Settings before upload')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const job = await uploadMovieCsv({ apiKey, file, dryRun, skipDuplicates })
      navigate(`/jobs/${job.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">Bulk Upload</h2>
        <p className="mt-1 text-sm text-muted">Upload Letterboxd movie CSV and track ingestion live.</p>
      </header>

      <div className="ui-card-solid p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-ink/80">
          <span className="font-semibold">Expected headers</span>
          <span className="text-muted">for Letterboxd export:</span>
          <code className="ui-kbd">Date, Name, Year, Letterboxd URI</code>
        </div>
      </div>

      {apiKeyMissing && (
        <div className="ui-card-solid border-bad/20 bg-bad/10 p-4 text-sm text-bad">
          API key not configured. Open Settings before uploading.
        </div>
      )}

      <form onSubmit={onSubmit} className="ui-card-solid space-y-5 p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink">CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={event => setFile(event.target.files?.[0] ?? null)}
            className="ui-input file:mr-3 file:rounded-lg file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink/80 hover:file:bg-surface2/80"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-surface2/40 p-3 text-sm text-ink/85">
            <input className="h-4 w-4 accent-[rgb(var(--accent))]" type="checkbox" checked={dryRun} onChange={event => setDryRun(event.target.checked)} />
            <span>
              <span className="font-semibold">Dry run</span> <span className="text-muted">(no writes)</span>
            </span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-surface2/40 p-3 text-sm text-ink/85">
            <input
              className="h-4 w-4 accent-[rgb(var(--accent))]"
              type="checkbox"
              checked={skipDuplicates}
              onChange={event => setSkipDuplicates(event.target.checked)}
            />
            <span>
              <span className="font-semibold">Skip duplicates</span> <span className="text-muted">(safer re-imports)</span>
            </span>
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-bad/20 bg-bad/10 p-3 text-sm text-bad">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="ui-btn-accent font-semibold text-ink"
        >
          {submitting ? 'Uploading...' : 'Start Import'}
        </button>
      </form>
    </section>
  )
}
