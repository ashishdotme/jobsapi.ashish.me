import { describe, expect, it } from 'vitest'
import type { TodosWorkspaceProjectDetailPayload, TodosWorkspaceTask } from '../types'
import { invalidateProjectWorkspaceCache } from './todos-page-state'

const buildDetail = (projectId: string): TodosWorkspaceProjectDetailPayload => ({
  project: {
    id: projectId,
    name: projectId,
    sourceProjectId: `${projectId}-source`,
    taskCount: 1,
    openTaskCount: 1,
    overdueTaskCount: 0,
    dueSoonTaskCount: 0,
    updatedAt: '2026-04-16T10:00:00.000Z',
  },
  projectBoard: {
    columns: [],
    totalTaskCount: 1,
  },
  normalizedBoard: {
    columns: [],
    totalTaskCount: 1,
  },
  tasks: [],
})

const completedTask: TodosWorkspaceTask = {
  id: 'api:task-1',
  todoId: 'task-1',
  taskId: 'task-1',
  title: 'Completed task',
  projectId: 'api',
  projectName: 'api',
  sourceCategoryId: 'api:done',
  sourceCategory: 'Done',
  columnId: 'done',
  completed: true,
  dueDate: null,
  completedAt: '2026-04-16T10:00:00.000Z',
  sourceUpdatedAt: '2026-04-16T10:00:00.000Z',
  description: null,
}

describe('invalidateProjectWorkspaceCache', () => {
  it('drops the affected project detail and completed-task cache while preserving others', () => {
    const detailCache = new Map<string, TodosWorkspaceProjectDetailPayload>([
      ['jobsapi', buildDetail('jobsapi')],
      ['api', buildDetail('api')],
    ])

    const nextState = invalidateProjectWorkspaceCache({
      projectId: 'api',
      detailCache,
      completedTasksByProjectId: {
        jobsapi: [completedTask],
        api: [completedTask],
      },
      completedTasksVisibleByProjectId: {
        jobsapi: true,
        api: true,
      },
      completedTasksErrorByProjectId: {
        jobsapi: '',
        api: 'stale error',
      },
    })

    expect(detailCache.has('jobsapi')).toBe(true)
    expect(detailCache.has('api')).toBe(false)
    expect(nextState.completedTasksByProjectId).toEqual({
      jobsapi: [completedTask],
    })
    expect(nextState.completedTasksVisibleByProjectId).toEqual({
      jobsapi: true,
    })
    expect(nextState.completedTasksErrorByProjectId).toEqual({
      jobsapi: '',
    })
  })
})
