import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TodosWorkspaceOverviewPayload } from '../../types'
import { TodosOverview } from './TodosOverview'

const populatedOverview: TodosWorkspaceOverviewPayload = {
  generatedAt: '2026-04-14T10:00:00.000Z',
  projects: [
    {
      id: 'jobsapi',
      name: 'jobsapi.ashish.me',
      sourceProjectId: 'ticktick-jobsapi',
      taskCount: 4,
      openTaskCount: 3,
      overdueTaskCount: 1,
      dueSoonTaskCount: 2,
      updatedAt: '2026-04-14T09:55:00.000Z',
    },
    {
      id: 'api',
      name: 'api.ashish.me',
      sourceProjectId: 'ticktick-api',
      taskCount: 2,
      openTaskCount: 2,
      overdueTaskCount: 0,
      dueSoonTaskCount: 1,
      updatedAt: '2026-04-14T09:50:00.000Z',
    },
  ],
  normalizedBoard: {
    columns: [
      {
        id: 'backlog',
        label: 'Backlog',
        taskCount: 3,
        tasks: [
          {
            id: 'todo-10',
            todoId: 'ticktick-10',
            taskId: '10',
            title: 'Model workspace aggregate cards',
            projectId: 'jobsapi',
            projectName: 'jobsapi.ashish.me',
            sourceCategoryId: 'cat-10',
            sourceCategory: 'Backlog',
            columnId: 'backlog',
            completed: false,
            dueDate: '2026-04-17',
            completedAt: null,
            sourceUpdatedAt: '2026-04-14T09:46:00.000Z',
            description: 'Show all projects in one normalized lane',
          },
        ],
      },
      {
        id: 'in_progress',
        label: 'In Progress',
        taskCount: 2,
        tasks: [
          {
            id: 'todo-11',
            todoId: 'ticktick-11',
            taskId: '11',
            title: 'Wire board refresh',
            projectId: 'api',
            projectName: 'api.ashish.me',
            sourceCategoryId: 'cat-11',
            sourceCategory: 'In Progress',
            columnId: 'in_progress',
            completed: false,
            dueDate: '2026-04-16',
            completedAt: null,
            sourceUpdatedAt: '2026-04-14T09:41:00.000Z',
            description: null,
          },
        ],
      },
      {
        id: 'blocked',
        label: 'Blocked',
        taskCount: 1,
        tasks: [],
      },
      {
        id: 'done',
        label: 'Done',
        taskCount: 1,
        tasks: [
          {
            id: 'todo-12',
            todoId: 'ticktick-12',
            taskId: '12',
            title: 'Ship completed task',
            projectId: 'jobsapi',
            projectName: 'jobsapi.ashish.me',
            sourceCategoryId: 'cat-12',
            sourceCategory: 'Done',
            columnId: 'done',
            completed: true,
            dueDate: null,
            completedAt: '2026-04-14T09:30:00.000Z',
            sourceUpdatedAt: '2026-04-14T09:30:00.000Z',
            description: 'Should stay out of the normalized done lane UI',
          },
        ],
      },
    ],
    totalTaskCount: 6,
  },
  overdueTasks: [
    {
      id: 'todo-1',
      todoId: 'ticktick-1',
      taskId: '1',
      title: 'Fix dashboard auth',
      projectId: 'jobsapi',
      projectName: 'jobsapi.ashish.me',
      sourceCategoryId: 'cat-1',
      sourceCategory: 'Backlog',
      columnId: 'backlog',
      completed: false,
      dueDate: '2026-04-12',
      completedAt: null,
      sourceUpdatedAt: '2026-04-14T09:45:00.000Z',
      description: 'Keep dashboard auth wired',
    },
  ],
  dueSoonTasks: [
    {
      id: 'todo-2',
      todoId: 'ticktick-2',
      taskId: '2',
      title: 'Review proxy routes',
      projectId: 'api',
      projectName: 'api.ashish.me',
      sourceCategoryId: 'cat-2',
      sourceCategory: 'In Progress',
      columnId: 'in_progress',
      completed: false,
      dueDate: '2026-04-16',
      completedAt: null,
      sourceUpdatedAt: '2026-04-14T09:40:00.000Z',
      description: null,
    },
  ],
}

const malformedDateOverview: TodosWorkspaceOverviewPayload = {
  ...populatedOverview,
  generatedAt: 'not-a-date',
  projects: [
    {
      ...populatedOverview.projects[0],
      updatedAt: '',
    },
  ],
}

const malformedTaskDateOverview: TodosWorkspaceOverviewPayload = {
  ...populatedOverview,
  overdueTasks: [
    {
      ...populatedOverview.overdueTasks[0],
      dueDate: 'not-a-date',
      completedAt: 'also-not-a-date',
    },
  ],
}

const emptyOverview: TodosWorkspaceOverviewPayload = {
  generatedAt: '2026-04-14T10:00:00.000Z',
  projects: [],
  normalizedBoard: {
    columns: [],
    totalTaskCount: 0,
  },
  overdueTasks: [],
  dueSoonTasks: [],
}

describe('TodosOverview', () => {
  it('renders project cards, board summary, and task slices', () => {
    render(<TodosOverview overview={populatedOverview} />)

    expect(screen.getByRole('heading', { name: 'Project summary', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'jobsapi.ashish.me', level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'api.ashish.me', level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Normalized board', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Backlog', level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'In Progress', level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Done', level: 4 })).toBeInTheDocument()
    expect(screen.queryByText('Ship completed task')).not.toBeInTheDocument()
    expect(screen.getAllByText(/no tasks in this lane yet\./i).length).toBeGreaterThan(0)
    expect(screen.getByTestId('normalized-board-grid')).not.toHaveTextContent(/\bbacklog\s+backlog\b/i)
    expect(screen.getByTestId('normalized-board-grid')).not.toHaveTextContent(/\bin progress\s+in progress\b/i)
    expect(screen.getByText('Model workspace aggregate cards')).toBeInTheDocument()
    expect(screen.getByText('Wire board refresh')).toBeInTheDocument()
    expect(screen.getAllByText('jobsapi.ashish.me').length).toBeGreaterThan(0)
    expect(screen.getAllByText('api.ashish.me').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Overdue', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Due soon', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Fix dashboard auth')).toBeInTheDocument()
    expect(screen.getByText('Review proxy routes')).toBeInTheDocument()
  })

  it('renders helpful empty state copy for overdue and due-soon sections', () => {
    render(<TodosOverview overview={emptyOverview} />)

    expect(screen.getByText(/no projects discovered yet/i)).toBeInTheDocument()
    expect(screen.getByText(/no board data available yet/i)).toBeInTheDocument()
    expect(screen.getByText(/no overdue tasks right now/i)).toBeInTheDocument()
    expect(screen.getByText(/no tasks due in the next 7 days/i)).toBeInTheDocument()
  })

  it('falls back to a safe label for malformed dates', () => {
    render(<TodosOverview overview={malformedDateOverview} />)

    expect(screen.getByText(/updated unknown/i)).toBeInTheDocument()
    expect(screen.getByText(/last refreshed unknown/i)).toBeInTheDocument()
  })

  it('falls back to safe labels for malformed task dates', () => {
    render(<TodosOverview overview={malformedTaskDateOverview} />)

    expect(screen.getByText(/due unknown/i)).toBeInTheDocument()
    expect(screen.getByText(/completed unknown/i)).toBeInTheDocument()
  })

  it('can hide optional sections while keeping the normalized board visible', () => {
    render(
      <TodosOverview
        overview={populatedOverview}
        showProjectSummary={false}
        showOverdue={false}
        showDueSoon={false}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Project summary', level: 3 })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Normalized board', level: 3 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Overdue', level: 3 })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Due soon', level: 3 })).not.toBeInTheDocument()
  })

  it('spreads visible kanban columns evenly across the container', () => {
    render(<TodosOverview overview={populatedOverview} />)

    expect(screen.getByTestId('normalized-board-grid')).toHaveStyle({
      '--kanban-columns': '4',
    })
  })
})
