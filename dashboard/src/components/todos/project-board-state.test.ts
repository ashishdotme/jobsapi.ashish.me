import { describe, expect, it } from 'vitest'
import type { TodosWorkspaceProjectDetailPayload } from '../../types'
import {
  applyOptimisticProjectTaskCompletion,
  applyOptimisticProjectTaskMove,
} from './project-board-state'

const detail: TodosWorkspaceProjectDetailPayload = {
  project: {
    id: 'todo',
    name: 'Todo',
    sourceProjectId: 'ticktick-todo',
    taskCount: 3,
    openTaskCount: 2,
    overdueTaskCount: 0,
    dueSoonTaskCount: 0,
    updatedAt: '2026-04-15T10:00:00.000Z',
  },
  projectBoard: {
    columns: [
      {
        sourceCategoryId: 'todo:doing',
        sourceCategory: 'In Progress',
        normalizedColumnId: 'in_progress',
        normalizedColumnLabel: 'In Progress',
        taskCount: 1,
        taskIds: ['todo-2'],
      },
      {
        sourceCategoryId: 'todo:done-upstream',
        sourceCategory: 'Done',
        normalizedColumnId: 'done',
        normalizedColumnLabel: 'Done',
        taskCount: 1,
        taskIds: ['todo-3'],
      },
      {
        sourceCategoryId: 'todo:backlog',
        sourceCategory: 'Backlog',
        normalizedColumnId: 'backlog',
        normalizedColumnLabel: 'Backlog',
        taskCount: 1,
        taskIds: ['todo-1'],
      },
    ],
    totalTaskCount: 3,
  },
  normalizedBoard: {
    columns: [
      { id: 'backlog', label: 'Backlog', taskCount: 1 },
      { id: 'in_progress', label: 'In Progress', taskCount: 1 },
      { id: 'blocked', label: 'Blocked', taskCount: 0 },
      { id: 'done', label: 'Done', taskCount: 1 },
    ],
    totalTaskCount: 3,
  },
  tasks: [
    {
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
    },
    {
      id: 'todo:todo-2',
      todoId: 'todo-2',
      taskId: '702',
      title: 'Keep keyboard path',
      projectId: 'todo',
      projectName: 'Todo',
      sourceCategoryId: 'todo:doing',
      sourceCategory: 'In Progress',
      columnId: 'in_progress',
      completed: false,
      dueDate: null,
      completedAt: null,
      sourceUpdatedAt: '2026-04-15T10:00:00.000Z',
      description: null,
    },
    {
      id: 'todo:todo-3',
      todoId: 'todo-3',
      taskId: '703',
      title: 'Existing completed item',
      projectId: 'todo',
      projectName: 'Todo',
      sourceCategoryId: 'todo:done-upstream',
      sourceCategory: 'Done',
      columnId: 'done',
      completed: true,
      dueDate: null,
      completedAt: '2026-04-15T09:55:00.000Z',
      sourceUpdatedAt: '2026-04-15T09:55:00.000Z',
      description: null,
    },
  ],
}

describe('project board optimistic state', () => {
  it('moves a task into another open lane immediately', () => {
    const result = applyOptimisticProjectTaskMove(detail, '701', {
      targetProjectId: 'todo',
      targetSourceCategoryId: 'todo:doing',
      targetSourceCategory: 'In Progress',
      targetColumnId: 'in_progress',
    })

    expect(result.tasks.find(task => task.taskId === '701')).toEqual(
      expect.objectContaining({
        sourceCategoryId: 'todo:doing',
        sourceCategory: 'In Progress',
        columnId: 'in_progress',
        completed: false,
      }),
    )
    expect(result.projectBoard.columns.find(column => column.sourceCategoryId === 'todo:backlog')).toEqual(
      expect.objectContaining({
        taskCount: 0,
        taskIds: [],
      }),
    )
    expect(result.projectBoard.columns.find(column => column.sourceCategoryId === 'todo:doing')).toEqual(
      expect.objectContaining({
        taskCount: 2,
        taskIds: ['todo-2', 'todo-1'],
      }),
    )
  })

  it('marks a task complete immediately when dropped into done', () => {
    const result = applyOptimisticProjectTaskCompletion(
      detail,
      '701',
      '2026-04-15T10:05:00.000Z',
    )

    expect(result.project.openTaskCount).toBe(1)
    expect(result.tasks.find(task => task.taskId === '701')).toEqual(
      expect.objectContaining({
        completed: true,
        completedAt: '2026-04-15T10:05:00.000Z',
        sourceCategory: 'Done',
        columnId: 'done',
      }),
    )
    expect(result.projectBoard.columns.find(column => column.sourceCategoryId === 'todo:backlog')).toEqual(
      expect.objectContaining({
        taskCount: 0,
        taskIds: [],
      }),
    )
    expect(result.projectBoard.columns.find(column => column.sourceCategoryId === 'todo:done-upstream')).toEqual(
      expect.objectContaining({
        taskCount: 2,
        taskIds: ['todo-3', 'todo-1'],
      }),
    )
  })
})
