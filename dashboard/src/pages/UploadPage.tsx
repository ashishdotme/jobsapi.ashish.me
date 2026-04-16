import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { selectApiKey, selectIsAuthenticated, useAuthStore } from '@/state/auth-store'
import { listJobs, uploadMovieCsv } from '../lib/api'
import { getJobKindMeta } from '../lib/jobs'
import type { ImportJobSummary } from '../types'
import { StatusPill } from '../components/StatusPill'

export const UploadPage = () => {
  const navigate = useNavigate()
  const apiKey = useAuthStore(selectApiKey)
  const hasApiKey = useAuthStore(selectIsAuthenticated)
  const [file, setFile] = useState<File | null>(null)
  const [dryRun, setDryRun] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [recentJobs, setRecentJobs] = useState<ImportJobSummary[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  const apiKeyMissing = useMemo(() => !hasApiKey, [hasApiKey])

  useEffect(() => {
    const run = async () => {
      if (!apiKey) {
        setRecentJobs([])
        setLoadingRecent(false)
        return
      }

      try {
        const response = await listJobs(apiKey, 8, 0)
        setRecentJobs(response.jobs.filter(job => job.kind === 'import_movies' || job.kind === 'import_shows').slice(0, 4))
      } catch {
        setRecentJobs([])
      } finally {
        setLoadingRecent(false)
      }
    }

    void run()
  }, [apiKey])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) {
      setError('Select a CSV file before starting an import')
      return
    }

    if (!apiKey) {
      setError('Set the API key in Settings before launching a job')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const job = await uploadMovieCsv({ apiKey, file, dryRun, skipDuplicates })
      navigate(`/jobs/${job.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import launch failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">Letterboxd</Badge>
            <Badge variant="secondary">Movie Imports</Badge>
          </div>
          <CardTitle className="text-lg">Launch a new import job</CardTitle>
          <CardDescription>
            Upload a CSV to stage work, then monitor processing and retries in the Jobs workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {apiKeyMissing && (
            <Alert className="border-warning/20 bg-warning/5">
              <AlertTitle className="text-warning">API key required</AlertTitle>
              <AlertDescription className="text-warning/80">
                Save the dashboard API key in <Link to="/settings" className="font-semibold underline underline-offset-4">Settings</Link> before launching an import.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Import launch failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="rounded-lg border border-dashed bg-muted/40 p-5">
              <div className="text-xs font-medium text-muted-foreground">
                Intake package
              </div>
              <div className="mt-2 text-sm">
                Expected Letterboxd headers:
              </div>
              <div className="mt-3 inline-flex rounded-md border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
                Date, Name, Year, Letterboxd URI
              </div>
              <label className="mt-5 block">
                <div className="mb-2 text-sm font-medium">CSV file</div>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={event => setFile(event.target.files?.[0] ?? null)}
                  className="h-auto cursor-pointer border-dashed py-3 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/15"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border bg-card p-4">
                <Checkbox checked={dryRun} onCheckedChange={checked => setDryRun(checked === true)} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Dry run</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Validate rows without sending writes downstream.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border bg-card p-4">
                <Checkbox checked={skipDuplicates} onCheckedChange={checked => setSkipDuplicates(checked === true)} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Skip duplicates</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Ignore rows already present in the catalog.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" className="min-w-44">
                {submitting ? 'Launching...' : 'Create Import Job'}
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/jobs">Open Jobs Queue</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Runbook</CardTitle>
            <CardDescription>Current intake rules and queue behavior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs font-medium text-muted-foreground">Source</div>
                <div className="mt-2 font-medium">Letterboxd CSV</div>
                <div className="mt-1 text-muted-foreground">Movies imported through <code className="text-xs">/ops/imports/movies</code>.</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs font-medium text-muted-foreground">Execution</div>
                <div className="mt-2 font-medium">Queue-backed</div>
                <div className="mt-1 text-muted-foreground">Processing and retries visible in the shared jobs log.</div>
              </div>
            </div>
            <Separator />
            <div className="grid gap-2 text-muted-foreground">
              <div>Dry run: <span className="font-medium text-foreground">{dryRun ? 'enabled' : 'disabled'}</span></div>
              <div>Duplicate protection: <span className="font-medium text-foreground">{skipDuplicates ? 'enabled' : 'disabled'}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent imports</CardTitle>
            <CardDescription>Latest runs from the intake stations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRecent && <div className="text-sm text-muted-foreground">Loading...</div>}
            {!loadingRecent && !recentJobs.length && (
              <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                No import jobs yet.
              </div>
            )}
            {recentJobs.map(job => {
              const meta = getJobKindMeta(job.kind)
              return (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="secondary">{meta.station}</Badge>
                      <div className="mt-2 font-medium">{job.fileName}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{job.id}</div>
                    </div>
                    <StatusPill status={job.status} />
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
