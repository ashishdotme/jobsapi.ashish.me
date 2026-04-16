import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import type { ImportJobSummary, MediaRecord, MetadataField } from '../types'
import { StatCard } from './StatCard'

type MissingFilter = 'missing_either' | 'missing_poster' | 'missing_tmdb' | 'complete' | 'all'
type DialogMode = 'selected' | 'filtered'

type NormalizedMediaRecord = {
  id: string
  title: string
  posterUrl?: string | null
  tmdbId?: string | number | null
  hasPoster: boolean
  hasTmdb: boolean
  missingFields: MetadataField[]
}

type MediaMaintenanceWorkspaceProps = {
  entityLabel: 'movie' | 'show'
  entityLabelPlural: string
  loadRecords: (apiKey: string) => Promise<MediaRecord[]>
  createBackfillJob: (apiKey: string, ids: string[]) => Promise<ImportJobSummary>
}

const getDisplayTitle = (record: MediaRecord, entityLabel: string) => {
  const candidates = [record.title, record.name, record.originalTitle, record.originalName]
  const match = candidates.find(candidate => typeof candidate === 'string' && candidate.trim())
  return typeof match === 'string' ? match.trim() : `${entityLabel} ${record.id}`
}

const getMissingFields = (record: MediaRecord): MetadataField[] => {
  const missingFields: MetadataField[] = []
  if (!record.posterUrl) {
    missingFields.push('posterUrl')
  }
  if (record.tmdbId === null || record.tmdbId === undefined || record.tmdbId === '') {
    missingFields.push('tmdbId')
  }
  return missingFields
}

const normalizeRecord = (record: MediaRecord, entityLabel: string): NormalizedMediaRecord => {
  const missingFields = getMissingFields(record)

  return {
    id: String(record.id),
    title: getDisplayTitle(record, entityLabel),
    posterUrl: typeof record.posterUrl === 'string' ? record.posterUrl : null,
    tmdbId: record.tmdbId ?? null,
    hasPoster: !missingFields.includes('posterUrl'),
    hasTmdb: !missingFields.includes('tmdbId'),
    missingFields,
  }
}

const formatMissingField = (field: MetadataField) => (field === 'posterUrl' ? 'Poster URL' : 'TMDB ID')

export const MediaMaintenanceWorkspace = ({
  entityLabel,
  entityLabelPlural,
  loadRecords,
  createBackfillJob,
}: MediaMaintenanceWorkspaceProps) => {
  const apiKey = useAuthStore(selectApiKey)
  const navigate = useNavigate()
  const [records, setRecords] = useState<NormalizedMediaRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [missingFilter, setMissingFilter] = useState<MissingFilter>('missing_either')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>('filtered')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!apiKey) {
        if (active) {
          setError('Set the API key in Settings before loading the catalog')
          setLoading(false)
        }
        return
      }

      try {
        const response = await loadRecords(apiKey)
        if (!active) {
          return
        }

        setRecords(response.map(record => normalizeRecord(record, entityLabel)))
        setError('')
      } catch (err) {
        if (!active) {
          return
        }

        setError(err instanceof Error ? err.message : `Failed to load ${entityLabelPlural.toLowerCase()}`)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [apiKey, entityLabel, entityLabelPlural, loadRecords])

  useEffect(() => {
    setSelectedIds(current => current.filter(id => records.some(record => record.id === id)))
  }, [records])

  const filteredRecords = useMemo(() => {
    const searchValue = deferredSearch.trim().toLowerCase()

    return records.filter(record => {
      if (searchValue && !record.title.toLowerCase().includes(searchValue)) {
        return false
      }

      switch (missingFilter) {
        case 'missing_poster':
          return !record.hasPoster
        case 'missing_tmdb':
          return !record.hasTmdb
        case 'complete':
          return record.hasPoster && record.hasTmdb
        case 'all':
          return true
        case 'missing_either':
        default:
          return !record.hasPoster || !record.hasTmdb
      }
    })
  }, [deferredSearch, missingFilter, records])

  const filteredIds = useMemo(() => filteredRecords.map(record => record.id), [filteredRecords])
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleSelectedCount = useMemo(() => filteredIds.filter(id => selectedIdsSet.has(id)).length, [filteredIds, selectedIdsSet])

  const allVisibleSelected = filteredIds.length > 0 && visibleSelectedCount === filteredIds.length
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected

  const stats = useMemo(
    () => ({
      total: records.length,
      missingEither: records.filter(record => record.missingFields.length > 0).length,
      missingPoster: records.filter(record => !record.hasPoster).length,
      missingTmdb: records.filter(record => !record.hasTmdb).length,
    }),
    [records],
  )

  const dialogTargetIds = dialogMode === 'selected' ? selectedIds : filteredIds

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds(current =>
      checked ? Array.from(new Set([...current, id])) : current.filter(candidate => candidate !== id),
    )
  }

  const toggleSelectVisible = (checked: boolean) => {
    setSelectedIds(current => {
      const currentSet = new Set(current)

      if (checked) {
        filteredIds.forEach(id => currentSet.add(id))
      } else {
        filteredIds.forEach(id => currentSet.delete(id))
      }

      return Array.from(currentSet)
    })
  }

  const openDialog = (mode: DialogMode) => {
    setDialogMode(mode)
    setActionError('')
    setDialogOpen(true)
  }

  const onCreateJob = async () => {
    if (!apiKey) {
      setActionError('Set the API key in Settings before creating a job')
      return
    }

    if (!dialogTargetIds.length) {
      setActionError(`No ${entityLabelPlural.toLowerCase()} match the current target`)
      return
    }

    setSubmitting(true)
    setActionError('')

    try {
      const job = await createBackfillJob(apiKey, dialogTargetIds)
      setSelectedIds([])
      setDialogOpen(false)
      navigate(`/jobs/${job.id}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create metadata backfill job')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Catalog unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={stats.total} tone="neutral" />
        <StatCard label="Missing Either" value={stats.missingEither} tone="warn" />
        <StatCard label="Missing Poster" value={stats.missingPoster} tone="warn" />
        <StatCard label="Missing TMDB" value={stats.missingTmdb} tone="warn" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle>{entityLabelPlural} maintenance</CardTitle>
              <CardDescription>
                Filter the catalog, inspect missing metadata, then queue a background repair job.
              </CardDescription>
            </div>
            <CardAction>
              <div className="flex flex-wrap gap-2">
                {selectedIds.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => openDialog('selected')}>
                    Queue Selected ({selectedIds.length})
                  </Button>
                )}
                <Button size="sm" onClick={() => openDialog('filtered')} disabled={!filteredRecords.length}>
                  Queue Filtered ({filteredRecords.length})
                </Button>
              </div>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
            <Input
              value={search}
              onChange={event => startTransition(() => setSearch(event.target.value))}
              placeholder={`Search ${entityLabelPlural.toLowerCase()} by title`}
            />
            <Tabs value={missingFilter} onValueChange={value => startTransition(() => setMissingFilter(value as MissingFilter))}>
              <TabsList className="grid w-full grid-cols-5 xl:w-[580px]">
                <TabsTrigger value="missing_either">Missing Either</TabsTrigger>
                <TabsTrigger value="missing_poster">Poster</TabsTrigger>
                <TabsTrigger value="missing_tmdb">TMDB</TabsTrigger>
                <TabsTrigger value="complete">Complete</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2.5">
            <span className="text-sm text-muted-foreground">
              {filteredRecords.length} matching · {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.length > 0 && (
                <Badge variant="secondary">Selected subset</Badge>
              )}
              <Badge variant="secondary" className="capitalize">
                {missingFilter.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={checked => toggleSelectVisible(checked === true)}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Missing</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`loading-${index}`}>
                      <TableCell colSpan={5} className="h-16 animate-pulse text-muted-foreground">
                        Loading {entityLabelPlural.toLowerCase()}...
                      </TableCell>
                    </TableRow>
                  ))}

                {!loading &&
                  filteredRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIdsSet.has(record.id)}
                          onCheckedChange={checked => toggleSelection(record.id, checked === true)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{record.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {record.hasPoster && record.hasTmdb ? 'Complete' : 'Needs backfill'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {record.missingFields.length ? (
                            record.missingFields.map(field => (
                              <Badge key={field} variant="outline">{formatMissingField(field)}</Badge>
                            ))
                          ) : (
                            <Badge className="bg-success/15 text-success">Complete</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge className={record.hasPoster
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning'
                          }>
                            {record.hasPoster ? 'Poster' : 'No poster'}
                          </Badge>
                          <Badge className={record.hasTmdb
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning'
                          }>
                            {record.hasTmdb ? 'TMDB' : 'No TMDB'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{record.id}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {!loading && !filteredRecords.length && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No {entityLabelPlural.toLowerCase()} match the current filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {entityLabel} metadata backfill</DialogTitle>
            <DialogDescription>
              Queue a background repair for {dialogTargetIds.length} {entityLabelPlural.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="text-xs font-medium text-muted-foreground">Target</div>
            <div className="mt-1">
              {dialogMode === 'selected'
                ? `Selected rows (${selectedIds.length})`
                : `All filtered rows (${filteredRecords.length})`}
            </div>
          </div>

          {actionError && (
            <Alert variant="destructive">
              <AlertTitle>Job creation failed</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={onCreateJob} disabled={submitting || !dialogTargetIds.length}>
              {submitting ? 'Queueing...' : 'Create Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
