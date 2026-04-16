import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { selectApiKey, useAuthStore } from '@/state/auth-store'
import { listJobs } from '../lib/api'
import { getJobKindMeta, getJobProgressValue } from '../lib/jobs'
import type { ImportJobSummary, JobStatus } from '../types'
import { StatCard } from '../components/StatCard'
import { StatusPill } from '../components/StatusPill'

const REFRESH_INTERVAL_MS = 10000

type KindFilter = 'all' | 'imports' | 'movie_metadata' | 'show_metadata'

export const JobsPage = () => {
  const apiKey = useAuthStore(selectApiKey)
  const [jobs, setJobs] = useState<ImportJobSummary[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all')

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!apiKey) {
        if (!active) {
          return
        }

        setError('Set the API key in Settings to load the operations queue')
        setLoading(false)
        return
      }

      try {
        const response = await listJobs(apiKey, 100, 0)
        if (!active) {
          return
        }

        setJobs(response.jobs)
        setError('')
      } catch (err) {
        if (!active) {
          return
        }

        setError(err instanceof Error ? err.message : 'Failed to load jobs')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void run()
    const intervalId = window.setInterval(() => void run(), REFRESH_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [apiKey])

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesKind =
        kindFilter === 'all'
          ? true
          : kindFilter === 'imports'
            ? job.kind === 'import_movies' || job.kind === 'import_shows'
            : kindFilter === 'movie_metadata'
              ? job.kind === 'backfill_movie_metadata'
              : job.kind === 'backfill_show_metadata'

      const matchesStatus = statusFilter === 'all' ? true : job.status === statusFilter

      return matchesKind && matchesStatus
    })
  }, [jobs, kindFilter, statusFilter])

  const summary = useMemo(
    () => ({
      queued: filteredJobs.filter(job => job.status === 'queued').length,
      processing: filteredJobs.filter(job => job.status === 'processing').length,
      attention: filteredJobs.filter(job => job.status === 'failed' || job.status === 'partial').length,
      completed: filteredJobs.filter(job => job.status === 'completed').length,
    }),
    [filteredJobs],
  )

  return (
    <section className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Queue unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Queued" value={summary.queued} tone="neutral" />
          <StatCard label="Processing" value={summary.processing} tone="neutral" />
          <StatCard label="Needs Attention" value={summary.attention} tone="bad" />
          <StatCard label="Completed" value={summary.completed} tone="good" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Operations queue</CardTitle>
          <CardDescription>
            Imports and metadata repair jobs share one execution log.
          </CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link to="/imports">Launch new import</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Tabs value={kindFilter} onValueChange={value => setKindFilter(value as KindFilter)} className="w-full xl:w-auto">
              <TabsList className="grid w-full grid-cols-4 xl:w-[520px]">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="imports">Imports</TabsTrigger>
                <TabsTrigger value="movie_metadata">Movie Metadata</TabsTrigger>
                <TabsTrigger value="show_metadata">Show Metadata</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={statusFilter} onValueChange={value => setStatusFilter(value as 'all' | JobStatus)}>
              <SelectTrigger className="w-full xl:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map(job => {
                  const meta = getJobKindMeta(job.kind)
                  const progressValue = getJobProgressValue(job)

                  return (
                    <TableRow key={job.id}>
                      <TableCell className="align-top">
                        <div className="flex items-start gap-3">
                          <Badge variant="secondary" className="mt-0.5">{meta.station}</Badge>
                          <div className="space-y-1">
                            <div className="font-medium">{job.fileName}</div>
                            <div className="text-sm text-muted-foreground">{meta.label}</div>
                            <div className="font-mono text-xs text-muted-foreground">{job.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusPill status={job.status} />
                        {job.recentErrors.length > 0 && (
                          <div className="mt-2 text-xs text-danger">
                            {job.recentErrors.length} recent error{job.recentErrors.length === 1 ? '' : 's'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[200px] align-top">
                        <div className="space-y-2">
                          <Progress value={progressValue} className="h-2" />
                          <div className="text-xs text-muted-foreground">{progressValue}%</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        <div>{job.processedRows} / {job.totalRows}</div>
                        <div>{job.successRows} ok · {job.failedRows} fail · {job.skippedRows} skip</div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {new Date(job.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/jobs/${job.id}`}>Inspect</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {!loading && !filteredJobs.length && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No jobs match the current filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
