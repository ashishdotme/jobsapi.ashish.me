import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { selectApiKey, useAuthStore } from '@/state/auth-store'
import { getJob, getJobRows, retryFailedRows } from '../lib/api'
import {
  formatMetadataFields,
  getJobKindMeta,
  getJobProgressValue,
  getRowActionLabel,
  getRowSubtitle,
  getRowTitle,
  isMetadataBackfillPayload,
} from '../lib/jobs'
import type { ImportJobSummary, ImportRow, RowStatus } from '../types'
import { StatCard } from '../components/StatCard'
import { StatusPill } from '../components/StatusPill'

const REFRESH_INTERVAL_MS = 4000

export const JobDetailPage = () => {
  const apiKey = useAuthStore(selectApiKey)
  const params = useParams<{ jobId: string }>()
  const jobId = params.jobId ?? ''

  const [job, setJob] = useState<ImportJobSummary | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | RowStatus>('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const shouldPoll = useMemo(() => job?.status === 'queued' || job?.status === 'processing', [job?.status])

  const load = useCallback(async () => {
    if (!apiKey) {
      setError('Set the API key in Settings first')
      setLoading(false)
      return
    }

    try {
      const [jobResult, rowResult] = await Promise.all([
        getJob(apiKey, jobId),
        getJobRows(apiKey, jobId, {
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 200,
          offset: 0,
        }),
      ])

      setJob(jobResult)
      setRows(rowResult.rows)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details')
    } finally {
      setLoading(false)
    }
  }, [apiKey, jobId, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!shouldPoll) {
      return
    }

    const intervalId = window.setInterval(() => void load(), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [load, shouldPoll])

  const onRetryFailed = async () => {
    if (!apiKey) {
      setError('Set the API key in Settings first')
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
    return <div className="text-sm text-muted-foreground">Loading job details...</div>
  }

  if (!job) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Job not found</AlertTitle>
        <AlertDescription>The requested job could not be loaded.</AlertDescription>
      </Alert>
    )
  }

  const meta = getJobKindMeta(job.kind)
  const progressValue = getJobProgressValue(job)

  return (
    <section className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Job action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/jobs">Back to queue</Link>
              </Button>
              <Badge variant="secondary">{meta.station}</Badge>
              <StatusPill status={job.status} />
            </div>
            <CardTitle className="text-lg">{job.fileName}</CardTitle>
            <CardDescription>
              {meta.label} · {meta.summary}
              <span className="ml-2 font-mono text-[10px]">{job.id}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Total" value={job.totalRows} tone="neutral" />
              <StatCard label="Processed" value={job.processedRows} tone="neutral" />
              <StatCard label="Success" value={job.successRows} tone="good" />
              <StatCard label="Skipped" value={job.skippedRows} tone="warn" />
              <StatCard label="Failed" value={job.failedRows} tone="bad" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Queue controls</CardTitle>
            <CardDescription>Filter rows or requeue failures.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={statusFilter} onValueChange={value => setStatusFilter(value as 'all' | RowStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter row status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All row statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={onRetryFailed} disabled={retrying || job.failedRows === 0} className="w-full">
              {retrying ? 'Requeueing...' : 'Retry Failed Rows'}
            </Button>

            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="text-xs font-medium text-muted-foreground">
                Recent errors
              </div>
              <div className="mt-3 space-y-3 text-sm">
                {job.recentErrors.length ? (
                  job.recentErrors.slice(0, 4).map(errorItem => (
                    <div key={`${errorItem.rowNumber}-${errorItem.errorCode ?? 'unknown'}`} className="rounded-lg border border-danger/20 bg-danger/5 p-3">
                      <div className="font-medium">Row {errorItem.rowNumber}</div>
                      <div className="mt-1 text-danger">{errorItem.errorMessage ?? errorItem.errorCode ?? 'Unknown error'}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">No recent errors.</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Row diagnostics</CardTitle>
          <CardDescription>
            Individual row status and failure context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Diagnostics</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => {
                  const metadataPayload = isMetadataBackfillPayload(row.normalizedPayload) ? row.normalizedPayload : undefined

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium">{getRowTitle(row)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{getRowSubtitle(row)}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="text-sm">{getRowActionLabel(job, row)}</div>
                        {metadataPayload && metadataPayload.missingFields.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {formatMetadataFields(metadataPayload.missingFields).map(field => (
                              <Badge key={field} variant="outline">{field}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusPill status={row.status} />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="text-sm">{row.errorMessage ?? row.errorCode ?? 'Ready'}</div>
                        {row.targetRecordId && (
                          <div className="mt-1 font-mono text-xs text-muted-foreground">Target {row.targetRecordId}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top text-sm text-muted-foreground">
                        {row.attemptCount}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {!rows.length && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No rows match the current filter.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
