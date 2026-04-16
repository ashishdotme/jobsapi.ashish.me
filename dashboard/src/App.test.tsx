import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { dashboardQueryClient } from '@/app/query-client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuthStore } from '@/state/auth-store'
import { useTodosUiStore } from '@/state/todos-ui-store'
import App from './App'
import type { TodosWorkspaceOverviewPayload, TodosWorkspaceProjectDetailPayload } from './types'

const renderApp = (path: string, apiKey = '') => {
  window.localStorage.clear()
  useAuthStore.getState().clearApiKey()

  if (apiKey) {
    useAuthStore.getState().setApiKey(apiKey)
  }

  return render(
    <TooltipProvider delayDuration={0}>
      <AppProviders>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AppProviders>
    </TooltipProvider>,
  )
}

const todosProjectDetail: TodosWorkspaceProjectDetailPayload = {
  project: {
    id: 'jobsapi',
    name: 'jobsapi.ashish.me',
    sourceProjectId: 'ticktick-jobsapi',
    taskCount: 4,
    openTaskCount: 3,
    overdueTaskCount: 1,
    dueSoonTaskCount: 2,
    updatedAt: '2026-04-14T09:55:00.000Z',
  },
  projectBoard: {
    columns: [
      {
        sourceCategoryId: 'jobsapi:backlog',
        sourceCategory: 'Backlog',
        normalizedColumnId: 'backlog',
        normalizedColumnLabel: 'Backlog',
        taskCount: 1,
        taskIds: ['todo-1'],
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
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  dashboardQueryClient.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useAuthStore.getState().clearApiKey()
  useTodosUiStore.setState({
    selectedProjectId: null,
    completedTasksVisibleByProjectId: {},
  })
})

describe('App auth routing', () => {
  it('redirects unauthenticated users to login', async () => {
    renderApp('/settings')

    expect(await screen.findByText(/sign in to jobsapi/i)).toBeInTheDocument()
  })

  it('allows authenticated users to access dashboard routes', async () => {
    renderApp('/settings', 'valid-key')

    expect(await screen.findByText(/configure dashboard runtime settings\./i)).toBeInTheDocument()
    expect(screen.getByText(/^api key$/i)).toBeInTheDocument()
  })

  it('shows the todos workspace for authenticated users', async () => {
    const overview: TodosWorkspaceOverviewPayload = {
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
          { id: 'backlog', label: 'Backlog', taskCount: 3 },
          { id: 'in_progress', label: 'In Progress', taskCount: 2 },
          { id: 'blocked', label: 'Blocked', taskCount: 1 },
          { id: 'done', label: 'Done', taskCount: 0 },
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

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/ops/todos/overview')) {
        return {
          ok: true,
          json: async () => overview,
        }
      }

      if (url.includes('/ops/todos/projects/jobsapi')) {
        return {
          ok: true,
          json: async () => todosProjectDetail,
        }
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    renderApp('/todos', 'valid-key')

    expect(await screen.findByRole('heading', { name: /todos/i, level: 2 })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /normalized board/i, level: 3 })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /^projects$/i, level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /todos/i })).toBeInTheDocument()
  })

  it('shows an error instead of empty todos summary cards when overview loading fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/ops/todos/overview')) {
        return {
          ok: false,
          status: 503,
          text: async () => 'Todos upstream unavailable',
        }
      }

      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    renderApp('/todos', 'valid-key')

    expect(await screen.findByText(/todos workspace unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/todos upstream unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/projects discovered/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/tasks in the normalized board/i)).not.toBeInTheDocument()
  })
})
