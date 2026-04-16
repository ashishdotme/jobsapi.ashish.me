import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { dashboardQueryClient } from '@/app/query-client'
import { TodosPage } from '../../pages/TodosPage'
import { useAuthStore } from '../../state/auth-store'
import { useTodosUiStore } from '../../state/todos-ui-store'
import type { TodosWorkspaceOverviewPayload, TodosWorkspaceProjectDetailPayload } from '../../types'
import {
  createTodoTask,
  getTodoProject,
  getTodoProjectCompleted,
  getTodosOverview,
  updateTodoTask,
} from '../../lib/api'

vi.mock('../../lib/api', () => ({
  createTodoTask: vi.fn(),
  getTodoProject: vi.fn(),
  getTodoProjectCompleted: vi.fn(),
  getTodosOverview: vi.fn(),
  updateTodoTask: vi.fn(),
}))

const jobsapiDetail: TodosWorkspaceProjectDetailPayload = {
  project: {
    id: 'jobsapi',
    name: 'jobsapi.ashish.me',
    sourceProjectId: 'ticktick-jobsapi',
    taskCount: 2,
    openTaskCount: 2,
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
  ],
}

const apiDetail: TodosWorkspaceProjectDetailPayload = {
  project: {
    id: 'api',
    name: 'api.ashish.me',
    sourceProjectId: 'ticktick-api',
    taskCount: 1,
    openTaskCount: 1,
    overdueTaskCount: 0,
    dueSoonTaskCount: 0,
    updatedAt: '2026-04-14T09:54:00.000Z',
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
    ],
    totalTaskCount: 1,
  },
  normalizedBoard: {
    columns: [
      { id: 'backlog', label: 'Backlog', taskCount: 1 },
      { id: 'in_progress', label: 'In Progress', taskCount: 0 },
      { id: 'blocked', label: 'Blocked', taskCount: 0 },
      { id: 'done', label: 'Done', taskCount: 0 },
    ],
    totalTaskCount: 1,
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
  ],
}

const overview: TodosWorkspaceOverviewPayload = {
  generatedAt: '2026-04-14T10:00:00.000Z',
  projects: [jobsapiDetail.project, apiDetail.project],
  normalizedBoard: {
    columns: [
      { id: 'backlog', label: 'Backlog', taskCount: 2, tasks: [jobsapiDetail.tasks[0], apiDetail.tasks[0]] },
      { id: 'in_progress', label: 'In Progress', taskCount: 1, tasks: [jobsapiDetail.tasks[1]] },
      { id: 'blocked', label: 'Blocked', taskCount: 0, tasks: [] },
      { id: 'done', label: 'Done', taskCount: 0, tasks: [] },
    ],
    totalTaskCount: 3,
  },
  overdueTasks: [jobsapiDetail.tasks[0]],
  dueSoonTasks: [jobsapiDetail.tasks[1]],
}

const mockedGetTodosOverview = vi.mocked(getTodosOverview)
const mockedGetTodoProject = vi.mocked(getTodoProject)
const mockedGetTodoProjectCompleted = vi.mocked(getTodoProjectCompleted)
const mockedCreateTodoTask = vi.mocked(createTodoTask)
const mockedUpdateTodoTask = vi.mocked(updateTodoTask)

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  dashboardQueryClient.clear()
  useAuthStore.getState().clearApiKey()
  useTodosUiStore.setState({
    selectedProjectId: null,
    completedTasksVisibleByProjectId: {},
  })
  window.localStorage.clear()
})

const mockInitialLoads = () => {
  mockedGetTodosOverview.mockResolvedValue(overview)
  mockedGetTodoProject.mockImplementation(async (_apiKey, projectId) => {
    if (projectId === 'jobsapi') {
      return jobsapiDetail
    }

    if (projectId === 'api') {
      return apiDetail
    }

    throw new Error(`Unexpected project request: ${projectId}`)
  })
}

const buildTomorrowDateValue = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const renderTodosPage = () =>
  render(
    <AppProviders>
      <TodosPage />
    </AppProviders>,
  )

describe('Todos task mutations', () => {
  it('renders only the normalized board from the overview section', async () => {
    useAuthStore.getState().setApiKey('valid-key')
    mockInitialLoads()

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /add task to planning/i })).toBeInTheDocument()
    expect(screen.queryByText(/task actions/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Project summary', level: 3 })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Overdue', level: 3 })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Due soon', level: 3 })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Normalized board', level: 3 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /view options/i })).not.toBeInTheDocument()
  })

  it('loads completed tasks only after pressing the completed tasks button and reuses the cached results', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setApiKey('valid-key')
    mockInitialLoads()
    mockedGetTodoProjectCompleted.mockResolvedValue({
      tasks: [
        {
          ...jobsapiDetail.tasks[0],
          id: 'jobsapi:completed-1',
          taskId: '901',
          title: 'Ship dashboard task editor',
          completed: true,
          completedAt: '2026-04-14T10:15:00.000Z',
          columnId: 'done',
          sourceCategoryId: 'jobsapi:done',
          sourceCategory: 'Done',
        },
      ],
    })

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /load completed tasks/i })).toBeInTheDocument()
    expect(mockedGetTodoProjectCompleted).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /load completed tasks/i }))

    expect(await screen.findByText('Ship dashboard task editor')).toBeInTheDocument()
    expect(mockedGetTodoProjectCompleted).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /hide completed tasks/i }))
    expect(screen.queryByText('Ship dashboard task editor')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show completed tasks/i }))
    expect(screen.getByText('Ship dashboard task editor')).toBeInTheDocument()
    expect(mockedGetTodoProjectCompleted).toHaveBeenCalledTimes(1)
  })

  it('loads the todos workspace under React StrictMode', async () => {
    useAuthStore.getState().setApiKey('valid-key')
    mockInitialLoads()

    render(
      <StrictMode>
        <AppProviders>
          <TodosPage />
        </AppProviders>
      </StrictMode>,
    )

    expect(await screen.findByRole('button', { name: /add task to planning/i })).toBeInTheDocument()
    expect(screen.queryByText(/loading todos overview/i)).not.toBeInTheDocument()
    await waitFor(() => expect(mockedGetTodosOverview).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockedGetTodoProject).toHaveBeenCalledTimes(1))
  })

  it('creates a task from the selected project drilldown and refetches data', async () => {
    const user = userEvent.setup()
    const tomorrow = buildTomorrowDateValue()
    useAuthStore.getState().setApiKey('valid-key')
    mockInitialLoads()
    mockedCreateTodoTask.mockResolvedValue({
      taskId: '301',
      projectId: 'jobsapi',
      sourceCategoryId: 'jobsapi:planning',
      sourceCategory: 'Planning',
      columnId: 'backlog',
      syncedAt: '2026-04-14T10:05:00.000Z',
      task: jobsapiDetail.tasks[0],
    })

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /add task to planning/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add task to planning/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/due date/i)).toHaveValue(tomorrow)
    await user.type(screen.getByLabelText(/title/i), 'Ship dashboard task editor')
    await user.type(screen.getByLabelText(/description/i), 'Add the task mutation form')
    expect(screen.getByRole('button', { name: /save task/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save task/i }))

    await waitFor(() =>
      expect(mockedCreateTodoTask).toHaveBeenCalledWith({
        apiKey: 'valid-key',
        projectId: 'jobsapi',
        sourceCategoryId: 'jobsapi:planning',
        sourceCategory: 'Planning',
        columnId: 'backlog',
        title: 'Ship dashboard task editor',
        description: 'Add the task mutation form',
        dueDate: tomorrow,
      }),
    )
    await waitFor(() => expect(mockedGetTodosOverview).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockedGetTodoProject).toHaveBeenCalledTimes(2))
  })

  it('creates a task without requiring a description', async () => {
    const user = userEvent.setup()
    const tomorrow = buildTomorrowDateValue()
    useAuthStore.getState().setApiKey('valid-key')
    mockInitialLoads()
    mockedCreateTodoTask.mockResolvedValue({
      taskId: '301',
      projectId: 'jobsapi',
      sourceCategoryId: 'jobsapi:planning',
      sourceCategory: 'Planning',
      columnId: 'backlog',
      syncedAt: '2026-04-14T10:05:00.000Z',
      task: jobsapiDetail.tasks[0],
    })

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /add task to planning/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add task to planning/i }))
    await user.type(screen.getByLabelText(/title/i), 'Ship dashboard task editor')
    await user.click(screen.getByRole('button', { name: /save task/i }))

    await waitFor(() =>
      expect(mockedCreateTodoTask).toHaveBeenCalledWith({
        apiKey: 'valid-key',
        projectId: 'jobsapi',
        sourceCategoryId: 'jobsapi:planning',
        sourceCategory: 'Planning',
        columnId: 'backlog',
        title: 'Ship dashboard task editor',
        description: null,
        dueDate: tomorrow,
      }),
    )
  })

  it('keeps the workspace visible when a mutation succeeds but the refresh fails', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setApiKey('valid-key')
    mockedGetTodosOverview
      .mockResolvedValueOnce(overview)
      .mockRejectedValueOnce(new Error('refresh overview down'))
    mockedGetTodoProject.mockResolvedValue(jobsapiDetail)
    mockedCreateTodoTask.mockResolvedValue({
      taskId: '301',
      projectId: 'jobsapi',
      sourceCategoryId: 'jobsapi:planning',
      sourceCategory: 'Planning',
      columnId: 'backlog',
      syncedAt: '2026-04-14T10:05:00.000Z',
      task: jobsapiDetail.tasks[0],
    })

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /add task to planning/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add task to planning/i }))
    await user.type(screen.getByLabelText(/title/i), 'Ship dashboard task editor')
    await user.click(screen.getByRole('button', { name: /save task/i }))

    await waitFor(() => expect(mockedCreateTodoTask).toHaveBeenCalled())
    expect(await screen.findByText(/task saved, but refresh failed: refresh overview down/i)).toBeInTheDocument()
    expect(screen.queryByText(/todos workspace unavailable/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits a task from the selected project drilldown and refetches data', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setApiKey('valid-key')
    mockInitialLoads()
    mockedUpdateTodoTask.mockResolvedValue({
      taskId: '101',
      projectId: 'jobsapi',
      sourceCategoryId: 'jobsapi:planning',
      sourceCategory: 'Planning',
      columnId: 'backlog',
      syncedAt: '2026-04-14T10:06:00.000Z',
      task: jobsapiDetail.tasks[0],
    })

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /edit map import jobs/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /edit map import jobs/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/title/i))
    await user.type(screen.getByLabelText(/title/i), 'Map import jobs updated')
    await user.click(screen.getByRole('button', { name: /save task/i }))

    await waitFor(() =>
      expect(mockedUpdateTodoTask).toHaveBeenCalledWith('valid-key', '101', {
        title: 'Map import jobs updated',
        description: 'Plan the next import lane',
        dueDate: '2026-04-16',
      }),
    )
    await waitFor(() => expect(mockedGetTodosOverview).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockedGetTodoProject).toHaveBeenCalledTimes(2))
  })

  it('omits a blank due date when editing a task without an existing due date', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setApiKey('valid-key')
    mockedGetTodosOverview.mockResolvedValue(overview)
    mockedGetTodoProject.mockResolvedValue({
      ...jobsapiDetail,
      tasks: [
        {
          ...jobsapiDetail.tasks[0],
          dueDate: null,
        },
      ],
    })
    mockedUpdateTodoTask.mockResolvedValue({
      taskId: '101',
      projectId: 'jobsapi',
      sourceCategoryId: 'jobsapi:planning',
      sourceCategory: 'Planning',
      columnId: 'backlog',
      syncedAt: '2026-04-14T10:06:00.000Z',
      task: {
        ...jobsapiDetail.tasks[0],
        dueDate: null,
      },
    })

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /edit map import jobs/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /edit map import jobs/i }))
    await user.clear(screen.getByLabelText(/title/i))
    await user.type(screen.getByLabelText(/title/i), 'Map import jobs updated')
    await user.click(screen.getByRole('button', { name: /save task/i }))

    await waitFor(() =>
      expect(mockedUpdateTodoTask).toHaveBeenCalledWith('valid-key', '101', {
        title: 'Map import jobs updated',
        description: 'Plan the next import lane',
      }),
    )
  })

  it('removes the legacy task actions panel from the project drilldown', async () => {
    useAuthStore.getState().setApiKey('valid-key')
    mockInitialLoads()

    renderTodosPage()

    expect(await screen.findByRole('button', { name: /add task to planning/i })).toBeInTheDocument()
    expect(screen.queryByText(/task actions/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^create task$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^move task$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^complete task$/i })).not.toBeInTheDocument()
  })
})
