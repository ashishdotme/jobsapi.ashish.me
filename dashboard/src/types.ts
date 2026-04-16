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

export type TodosWorkspaceNormalizedBoardColumnId =
  | 'backlog'
  | 'in_progress'
  | 'blocked'
  | 'done'

export interface TodosWorkspaceNormalizedBoardColumn {
  id: TodosWorkspaceNormalizedBoardColumnId
  label: string
  taskCount: number
  tasks?: TodosWorkspaceTask[]
}

export interface TodosWorkspaceBoardSummary {
  columns: TodosWorkspaceNormalizedBoardColumn[]
  totalTaskCount: number
}

export interface TodosWorkspaceProjectSummary {
  id: string
  name: string
  sourceProjectId: string
  taskCount: number
  openTaskCount: number
  overdueTaskCount: number
  dueSoonTaskCount: number
  updatedAt: string
}

export interface TodosWorkspaceTask {
  id: string
  todoId: string
  taskId: string | null
  title: string
  projectId: string
  projectName: string
  sourceCategoryId: string
  sourceCategory: string
  columnId: TodosWorkspaceNormalizedBoardColumnId
  completed: boolean
  dueDate: string | null
  completedAt: string | null
  sourceUpdatedAt: string
  description?: string | null
}

export interface TodosWorkspaceOverviewPayload {
  generatedAt: string
  projects: TodosWorkspaceProjectSummary[]
  normalizedBoard: TodosWorkspaceBoardSummary
  overdueTasks: TodosWorkspaceTask[]
  dueSoonTasks: TodosWorkspaceTask[]
}

export interface TodosWorkspaceProjectListPayload {
  projects: TodosWorkspaceProjectSummary[]
}

export interface TodosWorkspaceCompletedTasksPayload {
  tasks: TodosWorkspaceTask[]
}

export interface TodosWorkspaceProjectBoardColumn {
  sourceCategoryId: string
  sourceCategory: string
  normalizedColumnId: TodosWorkspaceNormalizedBoardColumnId
  normalizedColumnLabel: string
  taskCount: number
  taskIds: string[]
}

export interface TodosWorkspaceProjectBoard {
  columns: TodosWorkspaceProjectBoardColumn[]
  totalTaskCount: number
}

export interface TodosWorkspaceProjectDetailPayload {
  project: TodosWorkspaceProjectSummary
  projectBoard: TodosWorkspaceProjectBoard
  normalizedBoard: TodosWorkspaceBoardSummary
  tasks: TodosWorkspaceTask[]
}

export interface TodosWorkspaceCreateTaskPayload {
  apiKey: string
  projectId: string
  sourceCategoryId: string
  sourceCategory: string
  columnId: TodosWorkspaceNormalizedBoardColumnId
  title: string
  description?: string | null
  dueDate?: string | null
}

export interface TodosWorkspaceUpdateTaskPayload {
  title?: string
  description?: string | null
  dueDate?: string | null
}

export interface TodosWorkspaceMoveTaskPayload {
  targetProjectId: string
  targetSourceCategoryId: string
  targetSourceCategory: string
  targetColumnId: TodosWorkspaceNormalizedBoardColumnId
}

export interface TodosWorkspaceCompleteTaskPayload {
  completedAt?: string
}

export interface TodosWorkspaceTaskMutationResponse {
  taskId: string
  projectId: string
  sourceCategoryId: string
  sourceCategory: string
  columnId: TodosWorkspaceNormalizedBoardColumnId
  syncedAt: string
  task: TodosWorkspaceTask
}

export interface TodosWorkspaceCreateTaskResponse extends TodosWorkspaceTaskMutationResponse {}

export interface TodosWorkspaceUpdateTaskResponse extends TodosWorkspaceTaskMutationResponse {}

export interface TodosWorkspaceMoveTaskResponse extends TodosWorkspaceTaskMutationResponse {}

export interface TodosWorkspaceCompleteTaskResponse extends TodosWorkspaceTaskMutationResponse {}
