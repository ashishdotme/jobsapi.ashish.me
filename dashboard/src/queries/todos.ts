import { useQuery } from '@tanstack/react-query'
import { getTodoProject, getTodoProjectCompleted, getTodosOverview } from '@/lib/api'
import type {
  TodosWorkspaceCompletedTasksPayload,
  TodosWorkspaceOverviewPayload,
  TodosWorkspaceProjectDetailPayload,
} from '@/types'
import { dashboardQueryKeys } from './query-keys'

const TODOS_STALE_TIME_MS = 60_000
const TODOS_GC_TIME_MS = 10 * 60_000

export const todosOverviewQueryOptions = (apiKey: string) => ({
  queryKey: dashboardQueryKeys.todos.overview(apiKey),
  queryFn: async (): Promise<TodosWorkspaceOverviewPayload> => getTodosOverview(apiKey),
  enabled: Boolean(apiKey),
  retry: false,
  staleTime: TODOS_STALE_TIME_MS,
  gcTime: TODOS_GC_TIME_MS,
})

export const todoProjectQueryOptions = (apiKey: string, projectId: string) => ({
  queryKey: dashboardQueryKeys.todos.project(apiKey, projectId),
  queryFn: async (): Promise<TodosWorkspaceProjectDetailPayload> => getTodoProject(apiKey, projectId),
  enabled: Boolean(apiKey && projectId),
  retry: false,
  staleTime: TODOS_STALE_TIME_MS,
  gcTime: TODOS_GC_TIME_MS,
})

export const todoCompletedTasksQueryOptions = (apiKey: string, projectId: string) => ({
  queryKey: dashboardQueryKeys.todos.completed(apiKey, projectId),
  queryFn: async (): Promise<TodosWorkspaceCompletedTasksPayload> =>
    getTodoProjectCompleted(apiKey, projectId),
  enabled: Boolean(apiKey && projectId),
  retry: false,
  staleTime: TODOS_STALE_TIME_MS,
  gcTime: TODOS_GC_TIME_MS,
})

export const useTodosOverviewQuery = (apiKey: string) => {
  return useQuery(todosOverviewQueryOptions(apiKey))
}

export const useTodoProjectQuery = (apiKey: string, projectId: string | null) => {
  return useQuery({
    ...todoProjectQueryOptions(apiKey, projectId ?? ''),
    placeholderData: previousData => previousData,
    enabled: Boolean(apiKey && projectId),
  })
}

export const useTodoCompletedTasksQuery = (
  apiKey: string,
  projectId: string | null,
  enabled: boolean,
) => {
  return useQuery({
    ...todoCompletedTasksQueryOptions(apiKey, projectId ?? ''),
    enabled: Boolean(apiKey && projectId && enabled),
  })
}
