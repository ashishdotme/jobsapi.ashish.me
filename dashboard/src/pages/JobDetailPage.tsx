import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getJob, getJobRows, retryFailedRows } from '../lib/api'
import { getApiKey } from '../lib/storage'
import type { ImportJobSummary, ImportRow, RowStatus } from '../types'
import { StatusPill } from '../components/StatusPill'
import { StatCard } from '../components/StatCard'

const REFRESH_INTERVAL_MS = 4000

export const JobDetailPage = () => {
  const params = useParams<{ jobId: string }>()
  const jobId = params.jobId ?? ''

  const [job, setJob] = useState<ImportJobSummary | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [statusFilter, setStatusFilter] = useState<RowStatus | ''>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const shouldPoll = useMemo(() => job?.status === 'queued' || job?.status === 'processing', [job?.status])

  const load = useCallback(async () => {
    const apiKey = getApiKey()
    if (!apiKey) {
      setError('Set API key in Settings first')
      setLoading(false)
      return
    }

    try {
      const [jobResult, rowResult] = await Promise.all([
        getJob(apiKey, jobId),
        getJobRows(apiKey, jobId, { status: statusFilter || undefined, limit: 200, offset: 0 }),
      ])
      setJob(jobResult)
      setRows(rowResult.rows)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details')
    } finally {
      setLoading(false)
    }
  }, [jobId, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!shouldPoll) {
      return
    }

    const id = window.setInterval(() => {
      void load()
    }, REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(id)
    }
  }, [load, shouldPoll])

  const onRetryFailed = async () => {
    const apiKey = getApiKey()
    if (!apiKey) {
      setError('Set API key in Settings first')
      return
    }

    setRetrying(true)
    try {
      await retryFailedRows(apiKey, jobId, { dryRun: false, skipDuplicates: true })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted">Loading...</div>
  }

  if (!job) {
    return <div className="rounded-xl border border-bad/20 bg-bad/10 p-4 text-sm text-bad">Job not found.</div>
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface2/60 px-3 py-1.5 text-xs font-semibold text-ink/85 hover:border-accent/25 hover:bg-accent/10"
          >
            Back to Jobs
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">Job Details</h2>
          <StatusPill status={job.status} />
        </div>
        <p className="text-sm text-muted">{job.fileName}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={job.totalRows} tone="neutral" />
        <StatCard label="Processed" value={job.processedRows} tone="neutral" />
        <StatCard label="Success" value={job.successRows} tone="good" />
        <StatCard label="Skipped" value={job.skippedRows} tone="warn" />
        <StatCard label="Failed" value={job.failedRows} tone="bad" />
      </div>

      {error && <div className="rounded-xl border border-bad/20 bg-bad/10 p-3 text-sm text-bad">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value as RowStatus | '')}
          className="ui-select"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
        </select>

        <button
          onClick={onRetryFailed}
          disabled={retrying || job.failedRows === 0}
          className="ui-btn-primary px-4 py-2 disabled:opacity-40"
        >
          {retrying ? 'Retrying...' : 'Retry Failed Rows'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface/70 shadow-uiTight">
        <table className="ui-table">
          <thead>
            <tr>
              <th className="ui-th">Row</th>
              <th className="ui-th">Title</th>
              <th className="ui-th">Status</th>
              <th className="ui-th">Error</th>
              <th className="ui-th">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="ui-tr">
                <td className="px-4 py-3 font-mono text-xs text-muted">{row.rowNumber}</td>
                <td className="px-4 py-3">{row.normalizedPayload?.title ?? row.rawPayload.Name ?? 'N/A'}</td>
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-4 py-3 text-xs text-bad">{row.errorMessage ?? '-'}</td>
                <td className="px-4 py-3 text-muted">{row.attemptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length && <div className="p-6 text-center text-sm text-muted">No rows found.</div>}
      </div>
    </section>
  )
}
