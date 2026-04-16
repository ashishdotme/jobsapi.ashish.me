import type {
  TodosWorkspaceCompleteTaskPayload,
  TodosWorkspaceMoveTaskPayload,
  TodosWorkspaceProjectDetailPayload,
  TodosWorkspaceProjectBoardColumn,
  TodosWorkspaceTask,
} from '../../types'

const removeTaskId = (taskIds: string[], todoId: string) => taskIds.filter(taskId => taskId !== todoId)

const appendTaskId = (taskIds: string[], todoId: string) => (
  taskIds.includes(todoId) ? taskIds : [...taskIds, todoId]
)

const updateColumnTaskIds = (
  column: TodosWorkspaceProjectBoardColumn,
  taskIds: string[],
): TodosWorkspaceProjectBoardColumn => ({
  ...column,
  taskIds,
  taskCount: taskIds.length,
})

const findTaskByTaskId = (detail: TodosWorkspaceProjectDetailPayload, taskId: string) => (
  detail.tasks.find(task => task.taskId === taskId) ?? null
)

export const applyOptimisticProjectTaskMove = (
  detail: TodosWorkspaceProjectDetailPayload,
  taskId: string,
  payload: TodosWorkspaceMoveTaskPayload,
): TodosWorkspaceProjectDetailPayload => {
  const task = findTaskByTaskId(detail, taskId)

  if (!task || !task.todoId) {
    return detail
  }

  const tasks = detail.tasks.map(currentTask => {
    if (currentTask.taskId !== taskId) {
      return currentTask
    }

    return {
      ...currentTask,
      sourceCategoryId: payload.targetSourceCategoryId,
      sourceCategory: payload.targetSourceCategory,
      columnId: payload.targetColumnId,
    } satisfies TodosWorkspaceTask
  })

  const columns = detail.projectBoard.columns.map(column => {
    if (column.sourceCategoryId === task.sourceCategoryId) {
      return updateColumnTaskIds(column, removeTaskId(column.taskIds, task.todoId))
    }

    if (column.sourceCategoryId === payload.targetSourceCategoryId) {
      return updateColumnTaskIds(column, appendTaskId(column.taskIds, task.todoId))
    }

    return column
  })

  return {
    ...detail,
    tasks,
    projectBoard: {
      ...detail.projectBoard,
      columns,
    },
  }
}

export const applyOptimisticProjectTaskCompletion = (
  detail: TodosWorkspaceProjectDetailPayload,
  taskId: string,
  completedAt: TodosWorkspaceCompleteTaskPayload['completedAt'],
): TodosWorkspaceProjectDetailPayload => {
  const task = findTaskByTaskId(detail, taskId)

  if (!task || !task.todoId) {
    return detail
  }

  const doneColumn = detail.projectBoard.columns.find(column => column.normalizedColumnId === 'done') ?? null
  const completedTimestamp = completedAt ?? new Date().toISOString()

  const tasks = detail.tasks.map(currentTask => {
    if (currentTask.taskId !== taskId) {
      return currentTask
    }

    return {
      ...currentTask,
      completed: true,
      completedAt: completedTimestamp,
      sourceCategoryId: doneColumn?.sourceCategoryId ?? `${detail.project.id}:done`,
      sourceCategory: doneColumn?.sourceCategory ?? 'Done',
      columnId: 'done',
    } satisfies TodosWorkspaceTask
  })

  const columns = detail.projectBoard.columns.map(column => {
    if (column.sourceCategoryId === task.sourceCategoryId) {
      return updateColumnTaskIds(column, removeTaskId(column.taskIds, task.todoId))
    }

    if (doneColumn && column.sourceCategoryId === doneColumn.sourceCategoryId) {
      return updateColumnTaskIds(column, appendTaskId(column.taskIds, task.todoId))
    }

    return column
  })

  return {
    ...detail,
    project: {
      ...detail.project,
      openTaskCount: Math.max(0, detail.project.openTaskCount - 1),
    },
    tasks,
    projectBoard: {
      ...detail.projectBoard,
      columns,
    },
  }
}
