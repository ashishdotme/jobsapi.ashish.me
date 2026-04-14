import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StatCard } from '@/components/StatCard'
import { StatusPill } from '@/components/StatusPill'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getUpdatesOverview, listRecentUpdates, startThreadsAuth, syncUpdatesNow } from '@/lib/api'
import { getApiKey } from '@/lib/storage'
import type { UpdatesBridgePost, UpdatesOverview } from '@/types'

const REFRESH_INTERVAL_MS = 15000

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Not yet'
  }

  return new Date(value).toLocaleString()
}

const truncate = (value: string, limit = 140) => {
  if (value.length <= limit) {
    return value
  }

  return `${value.slice(0, limit - 1)}...`
}

const renderThreadsState = (overview: UpdatesOverview | null) => {
  if (!overview) {
    return '...'
  }

  return overview.threads.connected ? 'Live' : 'Idle'
}

const renderBlueskyState = (overview: UpdatesOverview | null) => {
  if (!overview) {
    return '...'
  }

  return overview.bluesky.configured ? 'Ready' : 'Missing'
}

export const UpdatesPage = () => {
  const [searchParams] = useSearchParams()
  const [overview, setOverview] = useState<UpdatesOverview | null>(null)
  const [posts, setPosts] = useState<UpdatesBridgePost[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const apiKey = getApiKey()
  const threadsConnected = searchParams.get('threads') === 'connected'

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!apiKey) {
        if (!active) {
          return
        }

        setLoading(false)
        setError('Set the API key in Settings to load the updates bridge workspace')
        return
      }

      try {
        const [overviewResponse, postsResponse] = await Promise.all([
          getUpdatesOverview(apiKey),
          listRecentUpdates(apiKey, 12),
        ])

        if (!active) {
          return
        }

        setOverview(overviewResponse)
        setPosts(postsResponse)
        setError('')
      } catch (err) {
        if (!active) {
          return
        }

        setError(err instanceof Error ? err.message : 'Failed to load updates workspace')
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

  const queueTone = useMemo(() => {
    if (!overview) {
      return 'neutral' as const
    }

    return overview.delivery.failed > 0 ? 'bad' : overview.delivery.pending > 0 ? 'warn' : 'good'
  }, [overview])

  const onConnect = async () => {
    if (!apiKey) {
      setError('Set the API key in Settings before connecting Threads')
      return
    }

    setConnecting(true)
    setError('')

    try {
      const result = await startThreadsAuth({
        apiKey,
        returnTo: '/dashboard/updates',
      })
      window.location.href = result.authorizationUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Threads OAuth')
      setConnecting(false)
    }
  }

  const refreshWorkspace = async () => {
    if (!apiKey) {
      setLoading(false)
      setError('Set the API key in Settings to load the updates bridge workspace')
      return
    }

    const [overviewResponse, postsResponse] = await Promise.all([
      getUpdatesOverview(apiKey),
      listRecentUpdates(apiKey, 12),
    ])

    setOverview(overviewResponse)
    setPosts(postsResponse)
  }

  const onSyncNow = async () => {
    if (!apiKey) {
      setError('Set the API key in Settings before starting a manual sync')
      return
    }

    setSyncing(true)
    setError('')

    try {
      const result = await syncUpdatesNow(apiKey)
      if (result.status === 'already_running') {
        setError('A sync is already running')
      }
      await refreshWorkspace()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start manual sync')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Threads</Badge>
          <Badge variant="secondary">Bluesky</Badge>
          <Badge variant="secondary">Canonical Updates</Badge>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Updates Bridge</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Operate the Threads intake path, Bluesky delivery target, and recent bridged update stream.
          </p>
        </div>
      </div>

      {threadsConnected && (
        <Alert className="border-success/20 bg-success/5">
          <AlertTitle className="text-success">Threads connected</AlertTitle>
          <AlertDescription className="text-success">
            The OAuth callback completed and the bridge can start polling on the next cycle.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Updates workspace unavailable</AlertTitle>
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
          <StatCard label="Threads" value={renderThreadsState(overview)} tone={overview?.threads.connected ? 'good' : 'bad'} />
          <StatCard label="Bluesky" value={renderBlueskyState(overview)} tone={overview?.bluesky.configured ? 'good' : 'warn'} />
          <StatCard label="Last Sync" value={overview?.sync.lastCheckedAt ? formatDateTime(overview.sync.lastCheckedAt) : 'Not yet'} tone="neutral" />
          <StatCard label="Queue" value={`${overview?.delivery.pending ?? 0} / ${overview?.delivery.failed ?? 0}`} tone={queueTone} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-gradient-to-br from-primary/5 via-background to-background">
          <CardHeader>
            <CardTitle>Bridge control</CardTitle>
            <CardDescription>
              Connect Threads, confirm downstream readiness, and monitor the scheduler checkpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-card/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Threads</div>
                    <div className="mt-2 text-base font-semibold">
                      {overview?.threads.connected ? `@${overview.threads.username}` : 'Disconnected'}
                    </div>
                  </div>
                  <StatusPill status={overview?.threads.connected ? 'connected' : 'disconnected'} />
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div>Connected at: <span className="text-foreground">{formatDateTime(overview?.threads.connectedAt ?? null)}</span></div>
                  <div>Token expires: <span className="text-foreground">{formatDateTime(overview?.threads.accessTokenExpiresAt ?? null)}</span></div>
                  <div>Bootstrap since: <span className="font-mono text-foreground">{overview?.threads.bootstrapSince ?? 'Not set'}</span></div>
                </div>
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void onConnect()} disabled={connecting}>
                      {connecting ? 'Redirecting...' : overview?.threads.connected ? 'Reconnect Threads' : 'Connect Threads'}
                    </Button>
                    <Button variant="outline" onClick={() => void onSyncNow()} disabled={syncing || !overview?.threads.connected}>
                      {syncing ? 'Syncing...' : 'Sync now'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Bluesky</div>
                    <div className="mt-2 text-base font-semibold">
                      {overview?.bluesky.handle ?? 'Not configured'}
                    </div>
                  </div>
                  <StatusPill status={overview?.bluesky.configured ? 'ready' : 'missing'} />
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div>Delivery target: <span className="text-foreground">app.bsky.feed.post</span></div>
                  <div>Canonical sink: <span className="text-foreground">api.ashish.me/updates</span></div>
                  <div>Last sync checkpoint: <span className="text-foreground">{formatDateTime(overview?.sync.lastCheckedAt ?? null)}</span></div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              The bridge writes canonical updates upstream first, then publishes to Bluesky, then patches the upstream record with the `blueskyUri`.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery health</CardTitle>
            <CardDescription>Current queue shape and last delivery attempt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs font-medium text-muted-foreground">Delivered</div>
                <div className="mt-2 text-2xl font-semibold text-success">{overview?.delivery.delivered ?? 0}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  API: {overview?.delivery.apiDelivered ?? 0} · Bluesky: {overview?.delivery.blueskyDelivered ?? 0}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs font-medium text-muted-foreground">Pending / Failed</div>
                <div className="mt-2 text-2xl font-semibold">
                  {overview?.delivery.pending ?? 0} / {overview?.delivery.failed ?? 0}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Total tracked posts: {overview?.delivery.total ?? 0}
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Scheduler</span>
                <StatusPill status={overview?.sync.processing ? 'running' : 'idle'} />
              </div>
              <div className="mt-3 grid gap-2 text-muted-foreground">
                <div>Last attempt: <span className="text-foreground">{formatDateTime(overview?.delivery.lastAttemptedAt ?? null)}</span></div>
                <div>Last seen post: <span className="font-mono text-foreground">{overview?.sync.lastSeenPostId ?? 'None yet'}</span></div>
              </div>
            </div>

            {!apiKey && (
              <Alert className="border-warning/20 bg-warning/5">
                <AlertTitle className="text-warning">API key required</AlertTitle>
                <AlertDescription className="text-warning/80">
                  Save the dashboard API key in <Link to="/settings" className="font-semibold underline underline-offset-4">Settings</Link> before connecting Threads.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent updates</CardTitle>
          <CardDescription>
            Latest bridged records ordered by source publish time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map(post => (
                  <TableRow key={post.id}>
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{post.sourcePostType}</Badge>
                          {post.mediaUrls.length > 0 && <Badge variant="secondary">{post.mediaUrls.length} media</Badge>}
                        </div>
                        <div className="font-medium">{post.title}</div>
                        <div className="max-w-xl text-sm text-muted-foreground">{truncate(post.content || post.title)}</div>
                        {post.lastError && (
                          <div className="text-xs text-danger">{truncate(post.lastError, 120)}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {formatDateTime(post.sourcePublishedAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-xs text-muted-foreground">API</span>
                          <StatusPill status={post.apiStatus} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-xs text-muted-foreground">Bsky</span>
                          <StatusPill status={post.blueskyStatus} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      <div>{post.attemptCount}</div>
                      <div>{formatDateTime(post.lastAttemptedAt)}</div>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={post.sourceUrl} target="_blank" rel="noreferrer">Threads</a>
                        </Button>
                        {post.blueskyUri ? (
                          <Button asChild variant="outline" size="sm">
                            <a href={`https://bsky.app/profile/${overview?.bluesky.handle?.replace(/^@/, '') ?? ''}`} target="_blank" rel="noreferrer">
                              Bluesky
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!loading && posts.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No bridged posts yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
