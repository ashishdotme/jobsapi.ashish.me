import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { selectApiKey, useAuthStore } from '@/state/auth-store'
import {
  selectCompletedTasksVisibleByProjectId,
  selectSelectedProjectId,
  useTodosUiStore,
} from '@/state/todos-ui-store'
import {
  completeTodoTask,
  createTodoTask,
  getTodoProject,
  getTodoProjectCompleted,
  getTodosOverview,
  moveTodoTask,
  updateTodoTask,
} from '../lib/api'
import type {
  TodosWorkspaceCompletedTasksPayload,
  TodosWorkspaceNormalizedBoardColumnId,
  TodosWorkspaceMoveTaskPayload,
  TodosWorkspaceOverviewPayload,
  TodosWorkspaceProjectDetailPayload,
  TodosWorkspaceTask,
  TodosWorkspaceUpdateTaskPayload,
} from '../types'
import { ProjectBoard } from '../components/todos/ProjectBoard'
import { resolveNormalizedBoardDropAction } from '../components/todos/normalized-board-dnd'
import {
  applyOptimisticProjectTaskCompletion,
  applyOptimisticProjectTaskMove,
} from '../components/todos/project-board-state'
import { TodosOverview } from '../components/todos/TodosOverview'
import {
  applyOptimisticOverviewTaskCompletion,
  applyOptimisticOverviewTaskMove,
} from '../components/todos/todos-overview-state'
import { ProjectTaskList } from '../components/todos/ProjectTaskList'
import { TaskEditor, type TaskEditorRequest } from '../components/todos/TaskEditor'
import { dashboardQueryKeys } from '@/queries/query-keys'
import {
  todoProjectQueryOptions,
  useTodoCompletedTasksQuery,
  useTodoProjectQuery,
  useTodosOverviewQuery,
} from '@/queries/todos'

const emptyOverview: TodosWorkspaceOverviewPayload = {
  generatedAt: '',
  projects: [],
  normalizedBoard: {
    columns: [],
    totalTaskCount: 0,
  },
  overdueTasks: [],
  dueSoonTasks: [],
}

const emptyProjectDetail: TodosWorkspaceProjectDetailPayload = {
  project: {
    id: '',
    name: '',
    sourceProjectId: '',
    taskCount: 0,
    openTaskCount: 0,
    overdueTaskCount: 0,
    dueSoonTaskCount: 0,
    updatedAt: '',
  },
  projectBoard: {
    columns: [],
    totalTaskCount: 0,
  },
  normalizedBoard: {
    columns: [],
    totalTaskCount: 0,
  },
  tasks: [],
}

const upsertCompletedTasksPayload = (
  current: TodosWorkspaceCompletedTasksPayload | undefined,
  task: TodosWorkspaceTask,
): TodosWorkspaceCompletedTasksPayload | undefined => {
  if (!current) {
    return current
  }

  const nextTask = {
    ...task,
    completed: true,
    completedAt: task.completedAt ?? new Date().toISOString(),
    sourceCategoryId: `${task.projectId}:done`,
    sourceCategory: 'Done',
    columnId: 'done' as const,
  }

  const tasks = current.tasks.some(currentTask => currentTask.id === task.id)
    ? current.tasks.map(currentTask => (currentTask.id === task.id ? nextTask : currentTask))
    : [...current.tasks, nextTask]

  return {
    tasks,
  }
}

export const TodosPage = () => {
  const apiKey = useAuthStore(selectApiKey)
  const queryClient = useQueryClient()
  const selectedProjectId = useTodosUiStore(selectSelectedProjectId)
  const completedTasksVisibleByProjectId = useTodosUiStore(selectCompletedTasksVisibleByProjectId)
  const setSelectedProjectId = useTodosUiStore(state => state.setSelectedProjectId)
  const setCompletedTasksVisible = useTodosUiStore(state => state.setCompletedTasksVisible)
  const toggleCompletedTasksVisible = useTodosUiStore(state => state.toggleCompletedTasksVisible)
  const [mutationNotice, setMutationNotice] = useState('')
  const [editorRequest, setEditorRequest] = useState<TaskEditorRequest>(null)

  const overviewQuery = useTodosOverviewQuery(apiKey)
  const overview = overviewQuery.data ?? emptyOverview
  const projectQuery = useTodoProjectQuery(apiKey, selectedProjectId)
  const projectDetail = projectQuery.data ?? null
  const completedTasksVisible = selectedProjectId
    ? Boolean(completedTasksVisibleByProjectId[selectedProjectId])
    : false
  const completedTasksQuery = useTodoCompletedTasksQuery(apiKey, selectedProjectId, completedTasksVisible)

  useEffect(() => {
    if (!overviewQuery.isSuccess) {
      return
    }

    if (overview.projects.length === 0) {
      if (selectedProjectId !== null) {
        setSelectedProjectId(null)
      }
      return
    }

    if (!selectedProjectId || !overview.projects.some(project => project.id === selectedProjectId)) {
      setSelectedProjectId(overview.projects[0].id)
    }
  }, [overview.projects, overviewQuery.isSuccess, selectedProjectId, setSelectedProjectId])

  const getProjectDetailForProject = async (projectId: string) => {
    if (!apiKey) {
      throw new Error('Set the API key in Settings to load project details')
    }

    if (projectDetail?.project.id === projectId) {
      return projectDetail
    }

    return queryClient.ensureQueryData(todoProjectQueryOptions(apiKey, projectId))
  }

  const refreshWorkspace = async (
    options: { projectId?: string | null; silent?: boolean } = {},
  ) => {
    const { silent = false } = options
    const refreshProjectId = options.projectId ?? selectedProjectId
    if (!apiKey) {
      return
    }

    const refreshErrors: string[] = []

    try {
      const nextOverview = await getTodosOverview(apiKey)
      queryClient.setQueryData(dashboardQueryKeys.todos.overview(apiKey), nextOverview)
    } catch (error) {
      refreshErrors.push(error instanceof Error ? error.message : 'Failed to refresh todos overview')
    }

    try {
      if (refreshProjectId) {
        const nextProject = await getTodoProject(apiKey, refreshProjectId)
        queryClient.setQueryData(dashboardQueryKeys.todos.project(apiKey, refreshProjectId), nextProject)

        if (completedTasksVisibleByProjectId[refreshProjectId]) {
          const nextCompletedTasks = await getTodoProjectCompleted(apiKey, refreshProjectId)
          queryClient.setQueryData(
            dashboardQueryKeys.todos.completed(apiKey, refreshProjectId),
            nextCompletedTasks,
          )
        }
      }
    } catch (error) {
      if (!silent) {
        refreshErrors.push(error instanceof Error ? error.message : 'Failed to refresh project details')
      }
    }

    setMutationNotice(
      refreshErrors.length > 0 ? `Task saved, but refresh failed: ${refreshErrors[0]}` : '',
    )
  }

  const runMutation = async (mutation: (currentApiKey: string) => Promise<unknown>) => {
    if (!apiKey) {
      throw new Error('Set the API key in Settings to load the todos workspace')
    }

    setMutationNotice('')
    await mutation(apiKey)
    await refreshWorkspace()
  }

  const runOptimisticWorkspaceMutation = async <T,>(
    optimisticOverview: TodosWorkspaceOverviewPayload,
    optimisticDetail: TodosWorkspaceProjectDetailPayload | null | undefined,
    affectedProjectId: string,
    mutation: (currentApiKey: string) => Promise<T>,
  ) => {
    if (!apiKey) {
      throw new Error('Set the API key in Settings to load the todos workspace')
    }

    const overviewKey = dashboardQueryKeys.todos.overview(apiKey)
    const projectKey = dashboardQueryKeys.todos.project(apiKey, affectedProjectId)
    const previousOverview = queryClient.getQueryData<TodosWorkspaceOverviewPayload>(overviewKey)
    const previousProject =
      queryClient.getQueryData<TodosWorkspaceProjectDetailPayload>(projectKey) ?? null

    setMutationNotice('')
    queryClient.setQueryData(overviewKey, optimisticOverview)
    if (optimisticDetail) {
      queryClient.setQueryData(projectKey, optimisticDetail)
    }

    try {
      const result = await mutation(apiKey)
      await refreshWorkspace({ silent: true, projectId: affectedProjectId })
      return result
    } catch (error) {
      if (previousOverview) {
        queryClient.setQueryData(overviewKey, previousOverview)
      }
      if (previousProject) {
        queryClient.setQueryData(projectKey, previousProject)
      } else {
        queryClient.removeQueries({
          queryKey: projectKey,
          exact: true,
        })
      }
      throw error
    }
  }

  const handleMoveTask = async (taskId: string, payload: TodosWorkspaceMoveTaskPayload) => {
    if (!projectDetail) {
      throw new Error('Project details are not loaded yet')
    }

    const optimisticDetail = applyOptimisticProjectTaskMove(projectDetail, taskId, payload)
    const task = projectDetail.tasks.find(currentTask => currentTask.taskId === taskId)
    const optimisticOverview = task
      ? applyOptimisticOverviewTaskMove(overview, task, payload.targetColumnId, {
          sourceCategoryId: payload.targetSourceCategoryId,
          sourceCategory: payload.targetSourceCategory,
        })
      : overview

    await runOptimisticWorkspaceMutation(
      optimisticOverview,
      optimisticDetail,
      task?.projectId ?? projectDetail.project.id,
      currentApiKey => moveTodoTask(currentApiKey, taskId, payload),
    )
  }

  const handleCompleteTask = async (
    taskId: string,
    payload: { completedAt?: string } = {},
  ) => {
    if (!projectDetail) {
      throw new Error('Project details are not loaded yet')
    }

    const completedAt = payload.completedAt ?? new Date().toISOString()
    const optimisticDetail = applyOptimisticProjectTaskCompletion(projectDetail, taskId, completedAt)
    const task = projectDetail.tasks.find(currentTask => currentTask.taskId === taskId)
    const optimisticOverview = task
      ? applyOptimisticOverviewTaskCompletion(overview, task, completedAt)
      : overview

    const result = await runOptimisticWorkspaceMutation(
      optimisticOverview,
      optimisticDetail,
      task?.projectId ?? projectDetail.project.id,
      currentApiKey => completeTodoTask(currentApiKey, taskId, { completedAt }),
    )

    if (task) {
      queryClient.setQueryData<TodosWorkspaceCompletedTasksPayload | undefined>(
        dashboardQueryKeys.todos.completed(apiKey, task.projectId),
        current => upsertCompletedTasksPayload(current, result.task),
      )
    }
  }

  const handleOverviewMoveTask = async (
    task: TodosWorkspaceTask,
    targetColumnId: TodosWorkspaceNormalizedBoardColumnId,
  ) => {
    if (!apiKey) {
      throw new Error('Set the API key in Settings to load the todos workspace')
    }

    const taskProjectDetail = await getProjectDetailForProject(task.projectId)
    const action = resolveNormalizedBoardDropAction(task, targetColumnId, taskProjectDetail)

    if (action.type === 'noop') {
      return
    }

    if (action.type === 'complete') {
      const completedAt = new Date().toISOString()
      const optimisticOverview = applyOptimisticOverviewTaskCompletion(overview, task, completedAt)
      const optimisticDetail =
        projectDetail?.project.id === task.projectId
          ? applyOptimisticProjectTaskCompletion(projectDetail, action.payload.taskId, completedAt)
          : undefined

      const result = await runOptimisticWorkspaceMutation(
        optimisticOverview,
        optimisticDetail,
        task.projectId,
        currentApiKey => completeTodoTask(currentApiKey, action.payload.taskId, { completedAt }),
      )

      queryClient.setQueryData<TodosWorkspaceCompletedTasksPayload | undefined>(
        dashboardQueryKeys.todos.completed(apiKey, task.projectId),
        current => upsertCompletedTasksPayload(current, result.task),
      )
      return
    }

    const optimisticOverview = applyOptimisticOverviewTaskMove(
      overview,
      task,
      action.payload.targetColumnId,
      {
        sourceCategoryId: action.payload.targetSourceCategoryId,
        sourceCategory: action.payload.targetSourceCategory,
      },
    )
    const optimisticDetail =
      projectDetail?.project.id === task.projectId
        ? applyOptimisticProjectTaskMove(projectDetail, action.payload.taskId, action.payload)
        : undefined

    await runOptimisticWorkspaceMutation(
      optimisticOverview,
      optimisticDetail,
      task.projectId,
      currentApiKey => moveTodoTask(currentApiKey, action.payload.taskId, action.payload),
    )
  }

  if (overviewQuery.isPending) {
    return (
      <section className="space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight">Todos</h2>
        <div className="text-sm text-muted-foreground">Loading todos overview...</div>
      </section>
    )
  }

  if (overviewQuery.isError) {
    return (
      <section className="space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight">Todos</h2>

        <Alert variant="destructive">
          <AlertTitle>Todos workspace unavailable</AlertTitle>
          <AlertDescription>{overviewQuery.error.message}</AlertDescription>
        </Alert>
      </section>
    )
  }

  const projectError = projectQuery.isError ? projectQuery.error.message : ''
  const hasProjectDetailForSelection =
    selectedProjectId !== null &&
    projectDetail !== null &&
    projectDetail.project.id === selectedProjectId
  const showProjectLoading =
    overview.projects.length > 0 &&
    !projectError &&
    (!selectedProjectId || (!hasProjectDetailForSelection && projectDetail === null))
  const isSwitchingProject =
    projectQuery.isFetching &&
    projectDetail !== null &&
    selectedProjectId !== null &&
    projectDetail.project.id !== selectedProjectId
  const displayedProjectCompletedTasks = completedTasksQuery.data?.tasks
  const displayedProjectCompletedTasksVisible = selectedProjectId
    ? Boolean(completedTasksVisibleByProjectId[selectedProjectId])
    : false
  const displayedProjectCompletedTasksLoading =
    completedTasksQuery.isFetching && !completedTasksQuery.data
  const displayedProjectCompletedTasksError = completedTasksQuery.isError
    ? completedTasksQuery.error.message
    : ''

  return (
    <section className="space-y-6">
      <h2 className="text-3xl font-semibold tracking-tight">Todos</h2>

      {mutationNotice ? (
        <Alert>
          <AlertTitle>Refresh incomplete</AlertTitle>
          <AlertDescription>{mutationNotice}</AlertDescription>
        </Alert>
      ) : null}

      <TodosOverview overview={overview} boardOnly onMoveTask={handleOverviewMoveTask} />

      {overview.projects.length > 0 ? (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-heading text-sm font-medium">Projects</h3>
                  {isSwitchingProject ? (
                    <p className="text-xs text-muted-foreground">Loading project…</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {overview.projects.map(project => {
                  const selected = project.id === selectedProjectId

                  return (
                    <Button
                      key={project.id}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      {project.name}
                      <span aria-hidden="true" className="ml-1 text-[11px] opacity-70">
                        {project.openTaskCount}
                      </span>
                    </Button>
                  )
                })}
              </div>
            </div>

            {projectError ? (
              <Alert variant="destructive">
                <AlertTitle>Project drilldown unavailable</AlertTitle>
                <AlertDescription>{projectError}</AlertDescription>
              </Alert>
            ) : null}

            {showProjectLoading && !projectDetail ? (
              <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
                Loading project detail...
              </div>
            ) : projectDetail ? (
              <ProjectBoard
                detail={projectDetail}
                disabled={isSwitchingProject}
                onCreateTask={lane => setEditorRequest({
                  type: 'create',
                  sourceCategoryId: lane.sourceCategoryId,
                })}
                onEditTask={task => setEditorRequest({
                  type: 'edit',
                  taskId: task.id,
                })}
                onMoveTask={handleMoveTask}
                onCompleteTask={handleCompleteTask}
              />
            ) : (
              <ProjectBoard detail={emptyProjectDetail} />
            )}

            {!showProjectLoading && !projectError && projectDetail && !isSwitchingProject ? (
              <TaskEditor
                detail={projectDetail}
                request={editorRequest}
                onRequestHandled={() => setEditorRequest(null)}
                onCreate={payload => runMutation(currentApiKey => createTodoTask({ apiKey: currentApiKey, ...payload }))}
                onEdit={(taskId: string, payload: TodosWorkspaceUpdateTaskPayload) =>
                  runMutation(currentApiKey => updateTodoTask(currentApiKey, taskId, payload))
                }
              />
            ) : null}

            {projectDetail ? (
              <ProjectTaskList
                detail={projectDetail}
                disabled={isSwitchingProject}
                completedTasks={displayedProjectCompletedTasks}
                completedTasksVisible={displayedProjectCompletedTasksVisible}
                completedTasksLoading={displayedProjectCompletedTasksLoading}
                completedTasksError={displayedProjectCompletedTasksError}
                onLoadCompletedTasks={() => setCompletedTasksVisible(projectDetail.project.id, true)}
                onToggleCompletedTasks={() => toggleCompletedTasksVisible(projectDetail.project.id)}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
