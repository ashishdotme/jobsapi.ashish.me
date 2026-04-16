import { describe, expect, it } from 'vitest'
import type { TodosWorkspaceTask } from '../../types'
import {
  appendSyntheticDoneLane,
  resolveProjectBoardDropAction,
  type ProjectBoardLane,
} from './project-board-dnd'

const task: TodosWorkspaceTask = {
  id: 'jobsapi:todo-1',
  todoId: 'todo-1',
  taskId: '101',
  title: 'Map import jobs',
  projectId: 'jobsapi',
  projectName: 'jobsapi.ashish.me',
  sourceCategoryId: 'jobsapi:planning',
  sourceCategory: 'Planning',
  columnId: 'backlog',
  completed: false,
  dueDate: '2026-04-16',
  completedAt: null,
  sourceUpdatedAt: '2026-04-14T09:50:00.000Z',
  description: 'Plan the next import lane',
}

describe('project board dnd helpers', () => {
  it('orders visible lanes as backlog, in progress, blocked, then done', () => {
    const lanes = appendSyntheticDoneLane('jobsapi', [
      {
        sourceCategoryId: 'jobsapi:blocked',
        sourceCategory: 'Blocked',
        normalizedColumnId: 'blocked',
        normalizedColumnLabel: 'Blocked',
        taskCount: 1,
        taskIds: ['todo-3'],
      },
      {
        sourceCategoryId: 'jobsapi:backlog',
        sourceCategory: 'Backlog',
        normalizedColumnId: 'backlog',
        normalizedColumnLabel: 'Backlog',
        taskCount: 1,
        taskIds: ['todo-1'],
      },
      {
        sourceCategoryId: 'jobsapi:doing',
        sourceCategory: 'Doing',
        normalizedColumnId: 'in_progress',
        normalizedColumnLabel: 'In Progress',
        taskCount: 1,
        taskIds: ['todo-2'],
      },
    ])

    expect(lanes.map(lane => lane.normalizedColumnId)).toEqual([
      'backlog',
      'in_progress',
      'blocked',
      'done',
    ])
  })

  it('appends an empty synthetic done lane at the end of the board', () => {
    const lanes = appendSyntheticDoneLane('jobsapi', [
      {
        sourceCategoryId: 'jobsapi:planning',
        sourceCategory: 'Planning',
        normalizedColumnId: 'backlog',
        normalizedColumnLabel: 'Backlog',
        taskCount: 1,
        taskIds: ['todo-1'],
      },
    ])

    expect(lanes).toEqual([
      expect.objectContaining({
        sourceCategoryId: 'jobsapi:planning',
      }),
      expect.objectContaining({
        sourceCategoryId: 'jobsapi:done',
        sourceCategory: 'Done',
        normalizedColumnId: 'done',
        taskCount: 0,
        taskIds: [],
      }),
    ])
  })

  it('resolves a drop into a non-done lane as a same-project move', () => {
    const lane: ProjectBoardLane = {
      sourceCategoryId: 'jobsapi:doing',
      sourceCategory: 'Doing',
      normalizedColumnId: 'in_progress',
      normalizedColumnLabel: 'In Progress',
      taskCount: 1,
      taskIds: ['todo-2'],
    }

    expect(resolveProjectBoardDropAction(task, lane)).toEqual({
      type: 'move',
      payload: {
        taskId: '101',
        targetProjectId: 'jobsapi',
        targetSourceCategoryId: 'jobsapi:doing',
        targetSourceCategory: 'Doing',
        targetColumnId: 'in_progress',
      },
    })
  })

  it('resolves a drop into the synthetic done lane as completion', () => {
    const doneLane: ProjectBoardLane = {
      sourceCategoryId: 'jobsapi:done',
      sourceCategory: 'Done',
      normalizedColumnId: 'done',
      normalizedColumnLabel: 'Done',
      taskCount: 0,
      taskIds: [],
    }

    expect(resolveProjectBoardDropAction(task, doneLane)).toEqual({
      type: 'complete',
      payload: {
        taskId: '101',
      },
    })
  })
})
