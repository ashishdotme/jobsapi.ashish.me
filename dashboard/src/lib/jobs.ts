import type {
  ImportJobSummary,
  ImportRow,
  ImportRowNormalizedPayload,
  JobKind,
  JobStatus,
  MetadataBackfillNormalizedPayload,
  RowStatus,
} from '../types'

type Tone = 'default' | 'info' | 'success' | 'warn' | 'danger'

const JOB_KIND_META: Record<
  JobKind,
  { label: string; summary: string; station: string; tone: Tone }
> = {
  import_movies: {
    label: 'Import Movies',
    summary: 'Letterboxd CSV intake',
    station: 'I-01',
    tone: 'default',
  },
  import_shows: {
    label: 'Import Shows',
    summary: 'Show catalog intake',
    station: 'I-02',
    tone: 'default',
  },
  backfill_movie_metadata: {
    label: 'Movie Metadata',
    summary: 'Poster and TMDB repair',
    station: 'M-03',
    tone: 'warn',
  },
  backfill_show_metadata: {
    label: 'Show Metadata',
    summary: 'Poster and TMDB repair',
    station: 'S-04',
    tone: 'warn',
  },
}

const STATUS_TONE: Record<JobStatus | RowStatus, Tone> = {
  queued: 'default',
  processing: 'info',
  completed: 'success',
  failed: 'danger',
  partial: 'warn',
  pending: 'default',
  success: 'success',
  skipped: 'warn',
}

export const getJobKindMeta = (kind: JobKind) => JOB_KIND_META[kind]

export const getStatusTone = (status: JobStatus | RowStatus): Tone => STATUS_TONE[status]

export const getJobProgressValue = (job: Pick<ImportJobSummary, 'processedRows' | 'totalRows'>) => {
  if (!job.totalRows) {
    return 0
  }

  return Math.min(100, Math.round((job.processedRows / job.totalRows) * 100))
}

export const isMetadataBackfillPayload = (
  payload?: ImportRowNormalizedPayload,
): payload is MetadataBackfillNormalizedPayload =>
  Boolean(payload && 'entityId' in payload && 'missingFields' in payload)

export const getRowTitle = (row: ImportRow) => {
  if (row.normalizedPayload?.title) {
    return row.normalizedPayload.title
  }

  const rawTitle =
    row.rawPayload.title ??
    row.rawPayload.Name ??
    row.rawPayload.name ??
    row.rawPayload.id

  return typeof rawTitle === 'string' ? rawTitle : 'Untitled row'
}

export const getRowSubtitle = (row: ImportRow) => {
  if (isMetadataBackfillPayload(row.normalizedPayload)) {
    return `${row.normalizedPayload.entityType} · ${row.normalizedPayload.entityId}`
  }

  if (!row.normalizedPayload) {
    return 'Raw payload only'
  }

  const segments = [
    row.normalizedPayload.yearHint ? String(row.normalizedPayload.yearHint) : undefined,
    row.normalizedPayload.date,
  ].filter(Boolean)

  return segments.join(' · ') || 'Import row'
}

export const getRowActionLabel = (job: Pick<ImportJobSummary, 'kind'>, row: ImportRow) => {
  if (isMetadataBackfillPayload(row.normalizedPayload)) {
    const label = row.normalizedPayload.entityType === 'show' ? 'Backfill show' : 'Backfill movie'
    return `${label} metadata`
  }

  return job.kind === 'import_shows' ? 'Import show' : 'Import movie'
}

export const formatMetadataFields = (fields: string[]) =>
  fields.map(field => (field === 'posterUrl' ? 'Poster URL' : field === 'tmdbId' ? 'TMDB ID' : field))
