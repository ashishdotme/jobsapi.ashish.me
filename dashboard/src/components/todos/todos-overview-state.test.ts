import { describe, expect, it } from 'vitest'
import type { TodosWorkspaceOverviewPayload, TodosWorkspaceTask } from '../../types'
import {
  applyOptimisticOverviewTaskCompletion,
  applyOptimisticOverviewTaskMove,
} from './todos-overview-state'

const backlogTask: TodosWorkspaceTask = {
  id: 'todo:todo-1',
  todoId: 'todo-1',
  taskId: '701',
  title: 'Fix lane interaction',
  projectId: 'todo',
  projectName: 'Todo',
  sourceCategoryId: 'todo:backlog',
  sourceCategory: 'Backlog',
  columnId: 'backlog',
  completed: false,
  dueDate: null,
  completedAt: null,
  sourceUpdatedAt: '2026-04-15T10:00:00.000Z',
  description: null,
}

const overview: TodosWorkspaceOverviewPayload = {
  generatedAt: '2026-04-15T10:00:00.000Z',
  projects: [
    {
      id: 'todo',
      name: 'Todo',
      sourceProjectId: 'ticktick-todo',
      taskCount: 3,
      openTaskCount: 2,
      overdueTaskCount: 0,
      dueSoonTaskCount: 0,
      updatedAt: '2026-04-15T10:00:00.000Z',
    },
  ],
  normalizedBoard: {
    columns: [
      {
        id: 'backlog',
        label: 'Backlog',
        taskCount: 1,
        tasks: [backlogTask],
      },
      {
        id: 'in_progress',
        label: 'In Progress',
        taskCount: 0,
        tasks: [],
      },
      {
        id: 'blocked',
        label: 'Blocked',
        taskCount: 0,
        tasks: [],
      },
      {
        id: 'done',
        label: 'Done',
        taskCount: 0,
        tasks: [],
      },
    ],
    totalTaskCount: 1,
  },
  overdueTasks: [],
  dueSoonTasks: [],
}

describe('todos overview optimistic state', () => {
  it('moves a task between visible normalized columns immediately', () => {
    const result = applyOptimisticOverviewTaskMove(overview, backlogTask, 'in_progress', {
      sourceCategoryId: 'todo:doing',
      sourceCategory: 'In Progress',
    })

    expect(result.normalizedBoard.columns.find(column => column.id === 'backlog')).toEqual(
      expect.objectContaining({
        taskCount: 0,
        tasks: [],
      }),
    )
    expect(result.normalizedBoard.columns.find(column => column.id === 'in_progress')).toEqual(
      expect.objectContaining({
        taskCount: 1,
      }),
    )
    expect(result.normalizedBoard.columns.find(column => column.id === 'in_progress')?.tasks?.[0]).toEqual(
      expect.objectContaining({
        taskId: '701',
        columnId: 'in_progress',
        sourceCategory: 'In Progress',
      }),
    )
  })

  it('marks a task done immediately and updates project counts', () => {
    const result = applyOptimisticOverviewTaskCompletion(
      overview,
      backlogTask,
      '2026-04-15T10:05:00.000Z',
    )

    expect(result.projects[0]).toEqual(
      expect.objectContaining({
        openTaskCount: 1,
      }),
    )
    expect(result.normalizedBoard.columns.find(column => column.id === 'backlog')).toEqual(
      expect.objectContaining({
        taskCount: 0,
        tasks: [],
      }),
    )
    expect(result.normalizedBoard.columns.find(column => column.id === 'done')).toEqual(
      expect.objectContaining({
        taskCount: 1,
      }),
    )
    expect(result.normalizedBoard.columns.find(column => column.id === 'done')?.tasks?.[0]).toEqual(
      expect.objectContaining({
        taskId: '701',
        completed: true,
        completedAt: '2026-04-15T10:05:00.000Z',
        columnId: 'done',
      }),
    )
  })
})
