import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { dashboardQueryClient } from '@/app/query-client'
import { useAuthStore } from '../../state/auth-store'
import { useTodosUiStore } from '../../state/todos-ui-store'
import { ProjectBoard } from './ProjectBoard'
import { ProjectTaskList } from './ProjectTaskList'
import { TodosPage } from '../../pages/TodosPage'
import type { TodosWorkspaceProjectDetailPayload, TodosWorkspaceOverviewPayload } from '../../types'

const jobsapiDetail: TodosWorkspaceProjectDetailPayload = {
  project: {
    id: 'jobsapi',
    name: 'jobsapi.ashish.me',
    sourceProjectId: 'ticktick-jobsapi',
    taskCount: 4,
    openTaskCount: 3,
    overdueTaskCount: 1,
    dueSoonTaskCount: 1,
    updatedAt: '2026-04-14T09:55:00.000Z',
  },
  projectBoard: {
    columns: [
      {
        sourceCategoryId: 'jobsapi:planning',
        sourceCategory: 'Planning',
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
      {
        sourceCategoryId: 'jobsapi:blocking',
        sourceCategory: 'Blocked',
        normalizedColumnId: 'blocked',
        normalizedColumnLabel: 'Blocked',
        taskCount: 1,
        taskIds: ['todo-3'],
      },
      {
        sourceCategoryId: 'jobsapi:ship',
        sourceCategory: 'Ready to ship',
        normalizedColumnId: 'done',
        normalizedColumnLabel: 'Done',
        taskCount: 1,
        taskIds: ['todo-4'],
      },
    ],
    totalTaskCount: 4,
  },
  normalizedBoard: {
    columns: [
      { id: 'backlog', label: 'Backlog', taskCount: 1 },
      { id: 'in_progress', label: 'In Progress', taskCount: 1 },
      { id: 'blocked', label: 'Blocked', taskCount: 1 },
      { id: 'done', label: 'Done', taskCount: 1 },
    ],
    totalTaskCount: 4,
  },
  tasks: [
    {
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
    },
    {
      id: 'jobsapi:todo-2',
      todoId: 'todo-2',
      taskId: '102',
      title: 'Wire API proxy',
      projectId: 'jobsapi',
      projectName: 'jobsapi.ashish.me',
      sourceCategoryId: 'jobsapi:doing',
      sourceCategory: 'Doing',
      columnId: 'in_progress',
      completed: false,
      dueDate: '2026-04-15',
      completedAt: null,
      sourceUpdatedAt: '2026-04-14T09:48:00.000Z',
      description: null,
    },
    {
      id: 'jobsapi:todo-3',
      todoId: 'todo-3',
      taskId: '103',
      title: 'Fix blocked deployment',
      projectId: 'jobsapi',
      projectName: 'jobsapi.ashish.me',
      sourceCategoryId: 'jobsapi:blocking',
      sourceCategory: 'Blocked',
      columnId: 'blocked',
      completed: false,
      dueDate: '2026-04-14',
      completedAt: null,
      sourceUpdatedAt: '2026-04-14T09:46:00.000Z',
      description: 'Waiting on upstream data',
    },
    {
      id: 'jobsapi:todo-4',
      todoId: 'todo-4',
      taskId: '104',
      title: 'Ship backlog cleanup',
      projectId: 'jobsapi',
      projectName: 'jobsapi.ashish.me',
      sourceCategoryId: 'jobsapi:ship',
      sourceCategory: 'Ready to ship',
      columnId: 'done',
      completed: true,
      dueDate: null,
      completedAt: '2026-04-14T09:45:00.000Z',
      sourceUpdatedAt: '2026-04-14T09:45:00.000Z',
      description: null,
    },
  ],
}

const apiDetail: TodosWorkspaceProjectDetailPayload = {
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
  tasks: [
    {
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
    },
    {
      id: 'api:todo-12',
      todoId: 'todo-12',
      taskId: '202',
      title: 'Review auth guard',
      projectId: 'api',
      projectName: 'api.ashish.me',
      sourceCategoryId: 'api:doing',
      sourceCategory: 'Doing',
      columnId: 'in_progress',
      completed: false,
      dueDate: '2026-04-19',
      completedAt: null,
      sourceUpdatedAt: '2026-04-14T09:38:00.000Z',
      description: null,
    },
  ],
}

const emptyDetail: TodosWorkspaceProjectDetailPayload = {
  project: {
    id: 'empty',
    name: 'Empty project',
    sourceProjectId: 'ticktick-empty',
    taskCount: 0,
    openTaskCount: 0,
    overdueTaskCount: 0,
    dueSoonTaskCount: 0,
    updatedAt: '2026-04-14T09:55:00.000Z',
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

const overview: TodosWorkspaceOverviewPayload = {
  generatedAt: '2026-04-14T10:00:00.000Z',
  projects: [jobsapiDetail.project, apiDetail.project],
  normalizedBoard: {
    columns: [
      { id: 'backlog', label: 'Backlog', taskCount: 2 },
      { id: 'in_progress', label: 'In Progress', taskCount: 2 },
      { id: 'blocked', label: 'Blocked', taskCount: 1 },
      { id: 'done', label: 'Done', taskCount: 1 },
    ],
    totalTaskCount: 6,
  },
  overdueTasks: [],
  dueSoonTasks: [],
}

afterEach(() => {
  vi.restoreAllMocks()
  dashboardQueryClient.clear()
  useAuthStore.getState().clearApiKey()
  useTodosUiStore.setState({
    selectedProjectId: null,
    completedTasksVisibleByProjectId: {},
  })
  window.localStorage.clear()
})

const renderTodosPage = () =>
  render(
    <AppProviders>
      <TodosPage />
    </AppProviders>,
  )

describe('Todos workspace drilldown', () => {
  it('replaces project done lanes with a synthetic empty done lane', () => {
    render(<ProjectBoard detail={jobsapiDetail} />)

    expect(screen.getByText(/^3 open$/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Planning', level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Doing', level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Blocked', level: 4 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ready to ship', level: 4 })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Done', level: 4 })).toBeInTheDocument()
    expect(screen.queryByText('Ship backlog cleanup')).not.toBeInTheDocument()
  })

  it('shows a synthetic empty done lane at the end of the project board', () => {
    render(<ProjectBoard detail={jobsapiDetail} />)

    const headings = screen.getAllByRole('heading', { level: 4 }).map(node => node.textContent)
    expect(headings.at(-1)).toBe('Done')
    expect(screen.getByRole('heading', { name: 'Done', level: 4 })).toBeInTheDocument()
    expect(screen.queryByText('Ship backlog cleanup')).not.toBeInTheDocument()
    expect(screen.getByText(/no tasks in this lane\./i)).toBeInTheDocument()
  })

  it('shows a loading state instead of an empty drilldown while the first project detail is loading', async () => {
    useAuthStore.getState().setApiKey('valid-key')

    let resolveJobsapiDetail: ((value: TodosWorkspaceProjectDetailPayload) => void) | null = null
    const jobsapiDetailPromise = new Promise<TodosWorkspaceProjectDetailPayload>(resolve => {
      resolveJobsapiDetail = resolve
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/ops/todos/overview')) {
        return { ok: true, json: async () => overview }
      }

      if (url.includes('/ops/todos/projects/jobsapi')) {
        return { ok: true, json: async () => jobsapiDetailPromise }
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /^jobsapi\.ashish\.me$/i })).toBeInTheDocument()
    expect(screen.getByText(/loading project detail/i)).toBeInTheDocument()
    expect(screen.queryByText(/no tasks in this project yet/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no tasks available for this project yet/i)).not.toBeInTheDocument()

    expect(resolveJobsapiDetail).not.toBeNull()
    resolveJobsapiDetail!(jobsapiDetail)

    expect(await screen.findByRole('heading', { name: /^jobsapi\.ashish\.me$/, level: 3 })).toBeInTheDocument()
  })

  it('renders selected project detail and allows switching projects', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setApiKey('valid-key')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/ops/todos/overview')) {
        return { ok: true, json: async () => overview }
      }

      if (url.includes('/ops/todos/projects/jobsapi')) {
        return { ok: true, json: async () => jobsapiDetail }
      }

      if (url.includes('/ops/todos/projects/api')) {
        return { ok: true, json: async () => apiDetail }
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /^jobsapi\.ashish\.me$/i })).toBeInTheDocument()
    expect(await screen.findByText(/^3 open$/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /completed tasks/i, level: 3 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^api\.ashish\.me$/i }))

    expect((await screen.findAllByText(/refresh upstream schema/i)).length).toBeGreaterThan(0)
  })

  it('keeps the previous project detail mounted while a new project selection is loading', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setApiKey('valid-key')

    let resolveApiDetail: ((value: TodosWorkspaceProjectDetailPayload) => void) | null = null
    const apiDetailPromise = new Promise<TodosWorkspaceProjectDetailPayload>(resolve => {
      resolveApiDetail = resolve
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/ops/todos/overview')) {
        return { ok: true, json: async () => overview }
      }

      if (url.includes('/ops/todos/projects/jobsapi')) {
        return { ok: true, json: async () => jobsapiDetail }
      }

      if (url.includes('/ops/todos/projects/api')) {
        return { ok: true, json: async () => apiDetailPromise }
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderTodosPage()

    expect(await screen.findByRole('heading', { name: /^jobsapi\.ashish\.me$/, level: 3 })).toBeInTheDocument()
    expect(screen.getByText(/map import jobs/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add task to planning/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /edit map import jobs/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /load completed tasks/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /^api\.ashish\.me$/i }))

    expect(screen.getByText(/map import jobs/i)).toBeInTheDocument()
    expect(screen.queryByText(/loading project detail/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add task to planning/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /edit map import jobs/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /load completed tasks/i })).toBeDisabled()

    expect(resolveApiDetail).not.toBeNull()
    resolveApiDetail!(apiDetail)

    expect(await screen.findByRole('heading', { name: /^api\.ashish\.me$/, level: 3 })).toBeInTheDocument()
  })

  it('keeps the newest project detail when an older request resolves late', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setApiKey('valid-key')

    let resolveJobsapiDetail: ((value: TodosWorkspaceProjectDetailPayload) => void) | null = null
    let resolveApiDetail: ((value: TodosWorkspaceProjectDetailPayload) => void) | null = null
    const jobsapiDetailPromise = new Promise<TodosWorkspaceProjectDetailPayload>(resolve => {
      resolveJobsapiDetail = resolve
    })
    const apiDetailPromise = new Promise<TodosWorkspaceProjectDetailPayload>(resolve => {
      resolveApiDetail = resolve
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/ops/todos/overview')) {
        return { ok: true, json: async () => overview }
      }

      if (url.includes('/ops/todos/projects/jobsapi')) {
        return { ok: true, json: async () => jobsapiDetailPromise }
      }

      if (url.includes('/ops/todos/projects/api')) {
        return { ok: true, json: async () => apiDetailPromise }
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /^jobsapi\.ashish\.me$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^api\.ashish\.me$/i }))

    expect(resolveApiDetail).not.toBeNull()
    resolveApiDetail!(apiDetail)

    expect((await screen.findAllByText(/keep the dashboard contract aligned/i)).length).toBeGreaterThan(0)

    expect(resolveJobsapiDetail).not.toBeNull()
    resolveJobsapiDetail!(jobsapiDetail)

    expect((await screen.findAllByText(/keep the dashboard contract aligned/i)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/loading project detail/i)).not.toBeInTheDocument()
  })

  it('renders project-faithful lanes', () => {
    render(<ProjectBoard detail={jobsapiDetail} />)

    expect(screen.getByRole('heading', { name: /planning/i, level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /doing/i, level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /blocked/i, level: 4 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /ready to ship/i, level: 4 })).not.toBeInTheDocument()
    expect(screen.queryByText(/^backlog$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^in progress$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/map import jobs/i)).toBeInTheDocument()
    expect(screen.getByText(/wire api proxy/i)).toBeInTheDocument()
    expect(screen.queryByText(/ship backlog cleanup/i)).not.toBeInTheDocument()
  })

  it('shows a create button only on the backlog lane', () => {
    render(<ProjectBoard detail={jobsapiDetail} onCreateTask={vi.fn()} />)

    expect(screen.getByRole('button', { name: /add task to planning/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add task to doing/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add task to blocked/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add task to done/i })).not.toBeInTheDocument()
  })

  it('shows edit actions on task cards', () => {
    render(<ProjectBoard detail={jobsapiDetail} onEditTask={vi.fn()} />)

    expect(screen.getByRole('button', { name: /edit map import jobs/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit wire api proxy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit fix blocked deployment/i })).toBeInTheDocument()
  })

  it('spreads visible project board columns evenly across the container', () => {
    render(<ProjectBoard detail={jobsapiDetail} />)

    expect(screen.getByTestId('project-board-grid')).toHaveStyle({
      '--kanban-columns': '4',
    })
  })

  it('matches lane tasks using todo ids only', () => {
    const mismatchedDetail: TodosWorkspaceProjectDetailPayload = {
      ...jobsapiDetail,
      projectBoard: {
        ...jobsapiDetail.projectBoard,
        columns: [
          {
            ...jobsapiDetail.projectBoard.columns[0],
            taskIds: ['101'],
          },
        ],
      },
    }

    render(<ProjectBoard detail={mismatchedDetail} />)

    expect(screen.queryByText(/map import jobs/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/no tasks in this lane\./i)).toHaveLength(2)
  })

  it('renders completed tasks only', () => {
    render(<ProjectTaskList detail={jobsapiDetail} />)

    expect(screen.getByRole('columnheader', { name: /task/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /lane/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /completed/i })).toBeInTheDocument()
    expect(screen.getByText(/ship backlog cleanup/i)).toBeInTheDocument()
    expect(screen.queryByText(/map import jobs/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/wire api proxy/i)).not.toBeInTheDocument()
  })

  it('shows empty states when the selected project has no tasks or lanes', () => {
    render(<ProjectBoard detail={emptyDetail} />)
    render(<ProjectTaskList detail={emptyDetail} />)

    expect(screen.getByRole('heading', { name: 'Done', level: 4 })).toBeInTheDocument()
    expect(screen.getByText(/no tasks in this lane\./i)).toBeInTheDocument()
    expect(screen.getByText(/no completed tasks yet\./i)).toBeInTheDocument()
  })
})
