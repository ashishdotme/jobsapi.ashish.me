export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'partial'
export type RowStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped'
export type JobKind = 'import_movies' | 'import_shows' | 'backfill_movie_metadata' | 'backfill_show_metadata'
export type ImportSource = 'letterboxd' | 'metadata'
export type ImportType = 'movies' | 'shows'
export type MetadataField = 'posterUrl' | 'tmdbId'

export interface ImportMovieNormalizedPayload {
  title: string
  date: string
  yearHint?: number
  sourceUri?: string
}

export interface MetadataBackfillNormalizedPayload {
  entityId: string
  entityType: 'movie' | 'show'
  missingFields: MetadataField[]
  title: string
}

export type ImportRowNormalizedPayload = ImportMovieNormalizedPayload | MetadataBackfillNormalizedPayload

export interface ImportJobSummary {
  id: string
  kind: JobKind
  type: ImportType
  source: ImportSource
  status: JobStatus
  fileName: string
  totalRows: number
  processedRows: number
  successRows: number
  failedRows: number
  skippedRows: number
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  recentErrors: Array<{ rowNumber: number; errorCode?: string; errorMessage?: string }>
}

export interface ImportRow {
  id: string
  rowNumber: number
  rawPayload: Record<string, unknown>
  normalizedPayload?: ImportRowNormalizedPayload
  status: RowStatus
  errorCode?: string
  errorMessage?: string
  targetRecordId?: string
  attemptCount: number
  updatedAt: string
}

export interface MediaRecord {
  id: string | number
  title?: string
  name?: string
  posterUrl?: string | null
  tmdbId?: string | number | null
  [key: string]: unknown
}

export type BridgeDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'failed_permanent'

export interface UpdatesOverview {
  threads: {
    connected: boolean
    username: string | null
    connectedAt: string | null
    accessTokenExpiresAt: string | null
    bootstrapSince: string | null
  }
  bluesky: {
    configured: boolean
    handle: string | null
  }
  sync: {
    processing: boolean
    lastCheckedAt: string | null
    lastSeenPostId: string | null
  }
  delivery: {
    total: number
    delivered: number
    pending: number
    failed: number
    apiDelivered: number
    blueskyDelivered: number
    lastAttemptedAt: string | null
  }
}

export interface UpdatesBridgePost {
  id: string
  sourcePlatform: 'threads'
  sourcePostId: string
  sourcePostType: 'post' | 'repost' | 'quote'
  sourceUrl: string
  sourcePublishedAt: string
  title: string
  content: string
  mediaUrls: string[]
  referencedSourceId?: string | null
  referencedSourceUrl?: string | null
  apiUpdateId: string | null
  apiStatus: BridgeDeliveryStatus
  blueskyUri: string | null
  blueskyStatus: BridgeDeliveryStatus
  attemptCount: number
  nextAttemptAt: string | null
  lastError: string | null
  lastAttemptedAt: string | null
  createdAt: string
  updatedAt: string
}
