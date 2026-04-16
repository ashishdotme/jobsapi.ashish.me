import type {
  TodosWorkspaceMoveTaskPayload,
  TodosWorkspaceNormalizedBoardColumnId,
  TodosWorkspaceProjectDetailPayload,
  TodosWorkspaceTask,
} from '../../types'

export type NormalizedBoardDropAction =
  | {
      type: 'move'
      payload: TodosWorkspaceMoveTaskPayload & { taskId: string }
    }
  | {
      type: 'complete'
      payload: { taskId: string }
    }
  | {
      type: 'noop'
    }

export const resolveNormalizedBoardDropAction = (
  task: TodosWorkspaceTask,
  targetColumnId: TodosWorkspaceNormalizedBoardColumnId,
  detail: TodosWorkspaceProjectDetailPayload,
): NormalizedBoardDropAction => {
  if (!task.taskId || task.completed) {
    return { type: 'noop' }
  }

  if (targetColumnId === 'done') {
    return {
      type: 'complete',
      payload: {
        taskId: task.taskId,
      },
    }
  }

  if (task.columnId === targetColumnId) {
    return { type: 'noop' }
  }

  const targetLane = detail.projectBoard.columns.find(column => column.normalizedColumnId === targetColumnId)
  if (!targetLane) {
    return { type: 'noop' }
  }

  if (task.sourceCategoryId === targetLane.sourceCategoryId) {
    return { type: 'noop' }
  }

  return {
    type: 'move',
    payload: {
      taskId: task.taskId,
      targetProjectId: task.projectId,
      targetSourceCategoryId: targetLane.sourceCategoryId,
      targetSourceCategory: targetLane.sourceCategory,
      targetColumnId,
    },
  }
}
