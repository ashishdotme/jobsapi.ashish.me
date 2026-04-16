import type {
  TodosWorkspaceNormalizedBoardColumnId,
  TodosWorkspaceOverviewPayload,
  TodosWorkspaceTask,
} from '../../types'

const replaceTaskInList = (
  tasks: TodosWorkspaceTask[] | undefined,
  matcher: (task: TodosWorkspaceTask) => boolean,
  nextTasks: TodosWorkspaceTask[],
) => {
  if (!tasks) {
    return tasks
  }

  return tasks.filter(task => !matcher(task)).concat(nextTasks)
}

const removeTaskFromList = (
  tasks: TodosWorkspaceTask[] | undefined,
  matcher: (task: TodosWorkspaceTask) => boolean,
) => {
  if (!tasks) {
    return tasks
  }

  return tasks.filter(task => !matcher(task))
}

const updateTask = (
  task: TodosWorkspaceTask,
  updates: Partial<TodosWorkspaceTask>,
): TodosWorkspaceTask => ({
  ...task,
  ...updates,
})

const isTaskVisibleInOverviewBoard = (
  overview: TodosWorkspaceOverviewPayload,
  task: TodosWorkspaceTask,
) => overview.normalizedBoard.columns.some(column => column.tasks?.some(item => item.id === task.id))

export const applyOptimisticOverviewTaskMove = (
  overview: TodosWorkspaceOverviewPayload,
  task: TodosWorkspaceTask,
  targetColumnId: TodosWorkspaceNormalizedBoardColumnId,
  targetLane: { sourceCategoryId: string; sourceCategory: string },
): TodosWorkspaceOverviewPayload => {
  if (!isTaskVisibleInOverviewBoard(overview, task)) {
    return overview
  }

  const nextTask = updateTask(task, {
    columnId: targetColumnId,
    sourceCategoryId: targetLane.sourceCategoryId,
    sourceCategory: targetLane.sourceCategory,
  })

  const columns = overview.normalizedBoard.columns.map(column => {
    if (column.id === task.columnId) {
      const tasks = removeTaskFromList(column.tasks, current => current.id === task.id) ?? []
      return { ...column, tasks, taskCount: tasks.length }
    }

    if (column.id === targetColumnId) {
      const tasks = replaceTaskInList(column.tasks, current => current.id === task.id, [nextTask]) ?? [nextTask]
      return { ...column, tasks, taskCount: tasks.length }
    }

    return column
  })

  return {
    ...overview,
    normalizedBoard: {
      ...overview.normalizedBoard,
      columns,
    },
  }
}

export const applyOptimisticOverviewTaskCompletion = (
  overview: TodosWorkspaceOverviewPayload,
  task: TodosWorkspaceTask,
  completedAt: string,
): TodosWorkspaceOverviewPayload => {
  if (!isTaskVisibleInOverviewBoard(overview, task)) {
    return overview
  }

  const nextTask = updateTask(task, {
    completed: true,
    completedAt,
    columnId: 'done',
    sourceCategory: 'Done',
  })

  const columns = overview.normalizedBoard.columns.map(column => {
    if (column.id === task.columnId) {
      const tasks = removeTaskFromList(column.tasks, current => current.id === task.id) ?? []
      return { ...column, tasks, taskCount: tasks.length }
    }

    if (column.id === 'done') {
      const tasks = replaceTaskInList(column.tasks, current => current.id === task.id, [nextTask]) ?? [nextTask]
      return { ...column, tasks, taskCount: tasks.length }
    }

    return column
  })

  return {
    ...overview,
    projects: overview.projects.map(project =>
      project.id === task.projectId
        ? {
            ...project,
            openTaskCount: Math.max(0, project.openTaskCount - 1),
          }
        : project,
    ),
    normalizedBoard: {
      ...overview.normalizedBoard,
      columns,
    },
    overdueTasks: removeTaskFromList(overview.overdueTasks, current => current.id === task.id) ?? [],
    dueSoonTasks: removeTaskFromList(overview.dueSoonTasks, current => current.id === task.id) ?? [],
  }
}
