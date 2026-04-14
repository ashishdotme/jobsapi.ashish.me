import type { ImportJobSummary, ImportRow, MediaRecord, RowStatus, UpdatesBridgePost, UpdatesOverview } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const API_KEY_REQUIRED_MESSAGE = 'Set API key in Settings first'

const normalizeApiKey = (apiKey: string): string => apiKey.trim()

const requireApiKey = (apiKey: string): string => {
  const normalized = normalizeApiKey(apiKey)
  if (!normalized) {
    throw new Error(API_KEY_REQUIRED_MESSAGE)
  }

  return normalized
}

const buildUrl = (path: string, apiKey: string, params?: Record<string, string>) => {
  const normalizedApiKey = requireApiKey(apiKey)
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  url.searchParams.set('apikey', normalizedApiKey)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value)
      }
    })
  }

  return url.toString()
}

const parseApiResponse = async <T>(response: Response): Promise<T> => {
  const data = await response.json()
  if (!response.ok || data?.error) {
    throw new Error(data?.error ?? `Request failed with status ${response.status}`)
  }
  return data as T
}

export const uploadMovieCsv = async (payload: {
  apiKey: string
  file: File
  dryRun: boolean
  skipDuplicates: boolean
}): Promise<ImportJobSummary> => {
  const apiKey = requireApiKey(payload.apiKey)
  const formData = new FormData()
  formData.append('file', payload.file)
  formData.append('source', 'letterboxd')
  formData.append('dryRun', String(payload.dryRun))
  formData.append('skipDuplicates', String(payload.skipDuplicates))

  const response = await fetch(buildUrl('/ops/imports/movies', apiKey), {
    method: 'POST',
    headers: {
      apiKey,
    },
    body: formData,
  })

  return parseApiResponse<ImportJobSummary>(response)
}

export const listJobs = async (apiKey: string, limit = 25, offset = 0): Promise<{ total: number; jobs: ImportJobSummary[] }> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(
    buildUrl('/ops/jobs', normalizedApiKey, {
      limit: String(limit),
      offset: String(offset),
    }),
    {
      headers: {
        apiKey: normalizedApiKey,
      },
    },
  )

  return parseApiResponse<{ total: number; jobs: ImportJobSummary[] }>(response)
}

export const getJob = async (apiKey: string, jobId: string): Promise<ImportJobSummary> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(buildUrl(`/ops/jobs/${jobId}`, normalizedApiKey), {
    headers: {
      apiKey: normalizedApiKey,
    },
  })
  return parseApiResponse<ImportJobSummary>(response)
}

export const getJobRows = async (
  apiKey: string,
  jobId: string,
  options: { status?: RowStatus; limit?: number; offset?: number },
): Promise<{ total: number; rows: ImportRow[] }> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(
    buildUrl(`/ops/jobs/${jobId}/rows`, normalizedApiKey, {
      status: options.status ?? '',
      limit: String(options.limit ?? 100),
      offset: String(options.offset ?? 0),
    }),
    {
      headers: {
        apiKey: normalizedApiKey,
      },
    },
  )

  return parseApiResponse<{ total: number; rows: ImportRow[] }>(response)
}

export const retryFailedRows = async (
  apiKey: string,
  jobId: string,
  payload: { dryRun: boolean; skipDuplicates: boolean },
): Promise<ImportJobSummary> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(buildUrl(`/ops/jobs/${jobId}/retry-failed`, normalizedApiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apiKey: normalizedApiKey },
    body: JSON.stringify(payload),
  })

  return parseApiResponse<ImportJobSummary>(response)
}

export const listMovies = async (apiKey: string): Promise<MediaRecord[]> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(buildUrl('/movies', normalizedApiKey), {
    headers: {
      apiKey: normalizedApiKey,
    },
  })

  return parseApiResponse<MediaRecord[]>(response)
}

export const listShows = async (apiKey: string): Promise<MediaRecord[]> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(buildUrl('/shows', normalizedApiKey), {
    headers: {
      apiKey: normalizedApiKey,
    },
  })

  return parseApiResponse<MediaRecord[]>(response)
}

export const createMovieMetadataBackfill = async (apiKey: string, movieIds: string[]): Promise<ImportJobSummary> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(buildUrl('/ops/backfills/movies/metadata', normalizedApiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apiKey: normalizedApiKey },
    body: JSON.stringify({ movieIds }),
  })

  return parseApiResponse<ImportJobSummary>(response)
}

export const createShowMetadataBackfill = async (apiKey: string, showIds: string[]): Promise<ImportJobSummary> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(buildUrl('/ops/backfills/shows/metadata', normalizedApiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apiKey: normalizedApiKey },
    body: JSON.stringify({ showIds }),
  })

  return parseApiResponse<ImportJobSummary>(response)
}

export const getUpdatesOverview = async (apiKey: string): Promise<UpdatesOverview> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(buildUrl('/ops/updates/overview', normalizedApiKey), {
    headers: {
      apiKey: normalizedApiKey,
    },
  })

  return parseApiResponse<UpdatesOverview>(response)
}

export const listRecentUpdates = async (apiKey: string, limit = 12): Promise<UpdatesBridgePost[]> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(
    buildUrl('/ops/updates/posts', normalizedApiKey, {
      limit: String(limit),
    }),
    {
      headers: {
        apiKey: normalizedApiKey,
      },
    },
  )

  return parseApiResponse<UpdatesBridgePost[]>(response)
}

export const startThreadsAuth = async (payload: { apiKey: string; returnTo: string }): Promise<{ authorizationUrl: string }> => {
  const normalizedApiKey = requireApiKey(payload.apiKey)
  const response = await fetch(buildUrl('/auth/threads/start', normalizedApiKey), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apiKey: normalizedApiKey,
    },
    body: JSON.stringify({
      returnTo: payload.returnTo,
    }),
  })

  return parseApiResponse<{ authorizationUrl: string }>(response)
}

export const syncUpdatesNow = async (apiKey: string): Promise<{ accepted: boolean; status: 'started' | 'already_running' }> => {
  const normalizedApiKey = requireApiKey(apiKey)
  const response = await fetch(buildUrl('/ops/updates/sync', normalizedApiKey), {
    method: 'POST',
    headers: {
      apiKey: normalizedApiKey,
    },
  })

  return parseApiResponse<{ accepted: boolean; status: 'started' | 'already_running' }>(response)
}
