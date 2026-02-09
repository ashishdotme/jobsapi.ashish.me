export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'partial'
export type RowStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped'

export interface ImportJobSummary {
  id: string
  type: 'movies' | 'shows'
  source: 'letterboxd'
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
  rawPayload: Record<string, string>
  normalizedPayload?: {
    title: string
    date: string
    yearHint?: number
    sourceUri?: string
  }
  status: RowStatus
  errorCode?: string
  errorMessage?: string
  targetRecordId?: string
  attemptCount: number
  updatedAt: string
}
