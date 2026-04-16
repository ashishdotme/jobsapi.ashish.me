import type {
  TodosWorkspaceMoveTaskPayload,
  TodosWorkspaceProjectBoardColumn,
  TodosWorkspaceTask,
} from '../../types'

export type ProjectBoardLane = TodosWorkspaceProjectBoardColumn

export type ProjectBoardDropAction =
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

const PROJECT_BOARD_ORDER: Record<string, number> = {
  backlog: 0,
  in_progress: 1,
  blocked: 2,
}

export const appendSyntheticDoneLane = (
  projectId: string,
  columns: TodosWorkspaceProjectBoardColumn[],
): ProjectBoardLane[] => {
  const nonDoneColumns = columns.filter(column => column.normalizedColumnId !== 'done')
  const orderedColumns = nonDoneColumns
    .map((column, index) => ({ column, index }))
    .sort((left, right) => {
      const leftOrder = PROJECT_BOARD_ORDER[left.column.normalizedColumnId] ?? Number.MAX_SAFE_INTEGER
      const rightOrder = PROJECT_BOARD_ORDER[right.column.normalizedColumnId] ?? Number.MAX_SAFE_INTEGER

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }

      return left.index - right.index
    })
    .map(entry => entry.column)

  return [
    ...orderedColumns,
    {
      sourceCategoryId: `${projectId}:done`,
      sourceCategory: 'Done',
      normalizedColumnId: 'done',
      normalizedColumnLabel: 'Done',
      taskCount: 0,
      taskIds: [],
    },
  ]
}

export const resolveProjectBoardDropAction = (
  task: TodosWorkspaceTask,
  targetLane: ProjectBoardLane,
): ProjectBoardDropAction => {
  if (!task.taskId) {
    return { type: 'noop' }
  }

  if (targetLane.normalizedColumnId === 'done') {
    return {
      type: 'complete',
      payload: {
        taskId: task.taskId,
      },
    }
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
      targetColumnId: targetLane.normalizedColumnId,
    },
  }
}
