import { describe, expect, it } from 'vitest'
import type { TodosWorkspaceProjectDetailPayload, TodosWorkspaceTask } from '../../types'
import { resolveNormalizedBoardDropAction } from './normalized-board-dnd'

const task: TodosWorkspaceTask = {
  id: 'api:todo-11',
  todoId: 'todo-11',
  taskId: '201',
  title: 'Refresh upstream schema',
  projectId: 'api',
  projectName: 'api.ashish.me',
  sourceCategoryId: 'api:backlog',
  sourceCategory: 'Backlog',
  columnId: 'backlog',
  completed: false,
  dueDate: '2026-04-18',
  completedAt: null,
  sourceUpdatedAt: '2026-04-14T09:40:00.000Z',
  description: 'Keep the dashboard contract aligned',
}

const projectDetail: TodosWorkspaceProjectDetailPayload = {
  project: {
    id: 'api',
    name: 'api.ashish.me',
    sourceProjectId: 'ticktick-api',
    taskCount: 2,
    openTaskCount: 2,
    overdueTaskCount: 0,
    dueSoonTaskCount: 1,
    updatedAt: '2026-04-14T09:50:00.000Z',
  },
  projectBoard: {
    columns: [
      {
        sourceCategoryId: 'api:backlog',
        sourceCategory: 'Backlog',
        normalizedColumnId: 'backlog',
        normalizedColumnLabel: 'Backlog',
        taskCount: 1,
        taskIds: ['todo-11'],
      },
      {
        sourceCategoryId: 'api:doing',
        sourceCategory: 'Doing',
        normalizedColumnId: 'in_progress',
        normalizedColumnLabel: 'In Progress',
        taskCount: 1,
        taskIds: ['todo-12'],
      },
      {
        sourceCategoryId: 'api:blocking',
        sourceCategory: 'Blocked',
        normalizedColumnId: 'blocked',
        normalizedColumnLabel: 'Blocked',
        taskCount: 0,
        taskIds: [],
      },
    ],
    totalTaskCount: 2,
  },
  normalizedBoard: {
    columns: [
      { id: 'backlog', label: 'Backlog', taskCount: 1 },
      { id: 'in_progress', label: 'In Progress', taskCount: 1 },
      { id: 'blocked', label: 'Blocked', taskCount: 0 },
      { id: 'done', label: 'Done', taskCount: 0 },
    ],
    totalTaskCount: 2,
  },
  tasks: [task],
}

describe('normalized board dnd helpers', () => {
  it('resolves a cross-project visible-lane drop using the task project lane metadata', () => {
    expect(resolveNormalizedBoardDropAction(task, 'in_progress', projectDetail)).toEqual({
      type: 'move',
      payload: {
        taskId: '201',
        targetProjectId: 'api',
        targetSourceCategoryId: 'api:doing',
        targetSourceCategory: 'Doing',
        targetColumnId: 'in_progress',
      },
    })
  })

  it('treats same-column drops as no-ops', () => {
    expect(resolveNormalizedBoardDropAction(task, 'backlog', projectDetail)).toEqual({
      type: 'noop',
    })
  })

  it('returns a no-op when the dragged task project has no target lane for that normalized column', () => {
    const detailWithoutBlockedLane: TodosWorkspaceProjectDetailPayload = {
      ...projectDetail,
      projectBoard: {
        ...projectDetail.projectBoard,
        columns: projectDetail.projectBoard.columns.filter(column => column.normalizedColumnId !== 'blocked'),
      },
    }

    expect(resolveNormalizedBoardDropAction(task, 'blocked', detailWithoutBlockedLane)).toEqual({
      type: 'noop',
    })
  })
})
