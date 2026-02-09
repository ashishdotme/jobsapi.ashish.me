import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listJobs } from '../lib/api'
import { getApiKey } from '../lib/storage'
import type { ImportJobSummary } from '../types'
import { StatusPill } from '../components/StatusPill'

export const JobsPage = () => {
  const [jobs, setJobs] = useState<ImportJobSummary[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      const apiKey = getApiKey()
      if (!apiKey) {
        setError('Set API key in Settings to load job history')
        setLoading(false)
        return
      }

      try {
        const response = await listJobs(apiKey, 50, 0)
        setJobs(response.jobs)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load jobs')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [])

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Jobs</h2>
          <p className="text-sm text-muted">Recent bulk imports and their outcomes.</p>
        </div>
      </header>

      {loading && <div className="text-sm text-muted">Loading...</div>}
      {error && <div className="rounded-xl border border-bad/20 bg-bad/10 p-3 text-sm text-bad">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface/70 shadow-uiTight">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-th">File</th>
                <th className="ui-th">Status</th>
                <th className="ui-th">Rows</th>
                <th className="ui-th">Created</th>
                <th className="ui-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className="ui-tr">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{job.fileName}</div>
                    <div className="mt-1 font-mono text-xs text-muted">{job.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={job.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{job.processedRows}</span> / {job.totalRows}
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(job.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface2/60 px-3 py-1.5 text-xs font-semibold text-ink/90 hover:border-accent/30 hover:bg-accent/10"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!jobs.length && <div className="p-8 text-center text-sm text-muted">No jobs yet.</div>}
        </div>
      )}
    </section>
  )
}
