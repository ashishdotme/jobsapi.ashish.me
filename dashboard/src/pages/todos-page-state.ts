import type { TodosWorkspaceProjectDetailPayload, TodosWorkspaceTask } from '../types'

type ProjectWorkspaceCacheState = {
  completedTasksByProjectId: Record<string, TodosWorkspaceTask[]>
  completedTasksVisibleByProjectId: Record<string, boolean>
  completedTasksErrorByProjectId: Record<string, string>
}

type InvalidateProjectWorkspaceCacheInput = ProjectWorkspaceCacheState & {
  projectId: string
  detailCache: Map<string, TodosWorkspaceProjectDetailPayload>
}

const omitProjectKey = <T,>(value: Record<string, T>, projectId: string) => {
  const { [projectId]: _removed, ...rest } = value
  return rest
}

export const invalidateProjectWorkspaceCache = ({
  projectId,
  detailCache,
  completedTasksByProjectId,
  completedTasksVisibleByProjectId,
  completedTasksErrorByProjectId,
}: InvalidateProjectWorkspaceCacheInput): ProjectWorkspaceCacheState => {
  detailCache.delete(projectId)

  return {
    completedTasksByProjectId: omitProjectKey(completedTasksByProjectId, projectId),
    completedTasksVisibleByProjectId: omitProjectKey(completedTasksVisibleByProjectId, projectId),
    completedTasksErrorByProjectId: omitProjectKey(completedTasksErrorByProjectId, projectId),
  }
}
