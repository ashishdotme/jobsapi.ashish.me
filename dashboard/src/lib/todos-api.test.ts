import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  completeTodoTask,
  createTodoTask,
  getTodoProject,
  getTodoProjectCompleted,
  getTodosOverview,
  listTodoProjects,
  moveTodoTask,
  updateTodoTask,
} from './api'

const createJsonResponse = (body: unknown, init?: { ok?: boolean; status?: number }) =>
  ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
  }) as Response

const createTextResponse = (body: string, init?: { ok?: boolean; status?: number }) =>
  ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => body,
    json: async () => {
      throw new SyntaxError('Unexpected token')
    },
  }) as unknown as Response

describe('todos api helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches the todos overview with the api key header and query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        generatedAt: '2026-04-14T10:00:00.000Z',
        projects: [],
        normalizedBoard: { columns: [], totalTaskCount: 0 },
        overdueTasks: [],
        dueSoonTasks: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getTodosOverview('  api-key  ')

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos/overview')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      headers: {
        apiKey: 'api-key',
      },
    })
  })

  it('fetches the todos project list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ projects: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await listTodoProjects('api-key')

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos/projects')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      headers: {
        apiKey: 'api-key',
      },
    })
  })

  it('fetches a todos project detail payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        project: {
          id: 'project-alpha',
          name: 'Project Alpha',
          sourceProjectId: 'project-alpha',
          taskCount: 0,
          openTaskCount: 0,
          overdueTaskCount: 0,
          dueSoonTaskCount: 0,
          updatedAt: '2026-04-14T10:00:00.000Z',
        },
        projectBoard: { columns: [], totalTaskCount: 0 },
        normalizedBoard: { columns: [], totalTaskCount: 0 },
        tasks: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getTodoProject('api-key', 'project-alpha')

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos/projects/project-alpha')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      headers: {
        apiKey: 'api-key',
      },
    })
  })

  it('fetches completed tasks for a todos project on demand', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        tasks: [
          {
            id: 'project-alpha:42',
            todoId: '42',
            taskId: '42',
            title: 'Ship it',
            projectId: 'project-alpha',
            projectName: 'Project Alpha',
            sourceCategoryId: 'project-alpha:done',
            sourceCategory: 'Done',
            columnId: 'done',
            completed: true,
            dueDate: null,
            completedAt: '2026-04-14T10:00:00.000Z',
            sourceUpdatedAt: '2026-04-14T09:59:00.000Z',
            description: 'Launch the feature',
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getTodoProjectCompleted('api-key', 'project-alpha')

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos/projects/project-alpha/completed')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      headers: {
        apiKey: 'api-key',
      },
    })
  })

  it('encodes reserved characters in todos project detail paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        project: {
          id: 'project-alpha',
          name: 'Project Alpha',
          sourceProjectId: 'project-alpha',
          taskCount: 0,
          openTaskCount: 0,
          overdueTaskCount: 0,
          dueSoonTaskCount: 0,
          updatedAt: '2026-04-14T10:00:00.000Z',
        },
        projectBoard: { columns: [], totalTaskCount: 0 },
        normalizedBoard: { columns: [], totalTaskCount: 0 },
        tasks: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getTodoProject('api-key', 'project alpha/one?x=1#frag')

    const [url] = fetchMock.mock.calls[0]

    expect(url as string).toContain('/ops/todos/projects/project%20alpha%2Fone%3Fx%3D1%23frag')
  })

  it('posts a create task payload without the api key in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        taskId: '701',
        projectId: 'project-alpha',
        sourceCategoryId: 'project-alpha:backlog',
        sourceCategory: 'Backlog',
        columnId: 'backlog',
        syncedAt: '2026-04-14T10:00:00.000Z',
        task: {
          id: 'project-alpha:701',
          todoId: '701',
          taskId: '42',
          title: 'Ship it',
          projectId: 'project-alpha',
          projectName: 'Project Alpha',
          sourceCategoryId: 'project-alpha:backlog',
          sourceCategory: 'Backlog',
          columnId: 'backlog',
          completed: false,
          dueDate: null,
          completedAt: null,
          sourceUpdatedAt: '2026-04-14T10:00:00.000Z',
          description: 'Launch the feature',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createTodoTask({
      apiKey: 'api-key',
      projectId: 'project-alpha',
      sourceCategoryId: 'project-alpha:backlog',
      sourceCategory: 'Backlog',
      columnId: 'backlog',
      title: 'Ship it',
      description: 'Launch the feature',
      dueDate: '2026-04-15',
    })

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      method: 'POST',
      headers: {
        apiKey: 'api-key',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      projectId: 'project-alpha',
      sourceCategoryId: 'project-alpha:backlog',
      sourceCategory: 'Backlog',
      columnId: 'backlog',
      title: 'Ship it',
      description: 'Launch the feature',
      dueDate: '2026-04-15',
    })
  })

  it('patches a todo task with the provided update payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        taskId: '42',
        projectId: 'project-alpha',
        sourceCategoryId: 'project-alpha:backlog',
        sourceCategory: 'Backlog',
        columnId: 'backlog',
        syncedAt: '2026-04-14T10:00:00.000Z',
        task: {
          id: 'project-alpha:701',
          todoId: '701',
          taskId: '42',
          title: 'Ship it',
          projectId: 'project-alpha',
          projectName: 'Project Alpha',
          sourceCategoryId: 'project-alpha:backlog',
          sourceCategory: 'Backlog',
          columnId: 'backlog',
          completed: false,
          dueDate: null,
          completedAt: null,
          sourceUpdatedAt: '2026-04-14T10:00:00.000Z',
          description: 'Launch the feature',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await updateTodoTask('api-key', '42', {
      title: 'Ship it',
      description: 'Launch the feature',
      dueDate: '2026-04-15',
    })

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos/42')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      method: 'PATCH',
      headers: {
        apiKey: 'api-key',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      title: 'Ship it',
      description: 'Launch the feature',
      dueDate: '2026-04-15',
    })
  })

  it('encodes reserved characters in mutation task paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        taskId: '42',
        projectId: 'project-alpha',
        sourceCategoryId: 'project-alpha:backlog',
        sourceCategory: 'Backlog',
        columnId: 'backlog',
        syncedAt: '2026-04-14T10:00:00.000Z',
        task: {
          id: 'project-alpha:701',
          todoId: '701',
          taskId: '42',
          title: 'Ship it',
          projectId: 'project-alpha',
          projectName: 'Project Alpha',
          sourceCategoryId: 'project-alpha:backlog',
          sourceCategory: 'Backlog',
          columnId: 'backlog',
          completed: false,
          dueDate: null,
          completedAt: null,
          sourceUpdatedAt: '2026-04-14T10:00:00.000Z',
          description: 'Launch the feature',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await updateTodoTask('api-key', 'task/42?x=1#frag', {
      title: 'Ship it',
    })

    const [url] = fetchMock.mock.calls[0]

    expect(url as string).toContain('/ops/todos/task%2F42%3Fx%3D1%23frag')
  })

  it('posts a move task payload to the move route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        taskId: '42',
        projectId: 'project-beta',
        sourceCategoryId: 'project-beta:in-progress',
        sourceCategory: 'In Progress',
        columnId: 'in_progress',
        syncedAt: '2026-04-14T10:00:00.000Z',
        task: {
          id: 'project-beta:42',
          todoId: '42',
          taskId: '42',
          title: 'Ship it',
          projectId: 'project-beta',
          projectName: 'Project Beta',
          sourceCategoryId: 'project-beta:in-progress',
          sourceCategory: 'In Progress',
          columnId: 'in_progress',
          completed: false,
          dueDate: null,
          completedAt: null,
          sourceUpdatedAt: '2026-04-14T10:00:00.000Z',
          description: null,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await moveTodoTask('api-key', '42', {
      targetProjectId: 'project-beta',
      targetSourceCategoryId: 'project-beta:in-progress',
      targetSourceCategory: 'In Progress',
      targetColumnId: 'in_progress',
    })

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos/42/move')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      method: 'POST',
      headers: {
        apiKey: 'api-key',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      targetProjectId: 'project-beta',
      targetSourceCategoryId: 'project-beta:in-progress',
      targetSourceCategory: 'In Progress',
      targetColumnId: 'in_progress',
    })
  })

  it('posts a complete task payload with the provided timestamp', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        taskId: '42',
        projectId: 'project-alpha',
        sourceCategoryId: 'project-alpha:done',
        sourceCategory: 'Done',
        columnId: 'done',
        syncedAt: '2026-04-14T10:00:00.000Z',
        task: {
          id: 'project-alpha:42',
          todoId: '42',
          taskId: '42',
          title: 'Ship it',
          projectId: 'project-alpha',
          projectName: 'Project Alpha',
          sourceCategoryId: 'project-alpha:done',
          sourceCategory: 'Done',
          columnId: 'done',
          completed: true,
          dueDate: null,
          completedAt: '2026-04-14T09:30:00.000Z',
          sourceUpdatedAt: '2026-04-14T10:00:00.000Z',
          description: null,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await completeTodoTask('api-key', '42', {
      completedAt: '2026-04-14T09:30:00.000Z',
    })

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos/42/complete')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      method: 'POST',
      headers: {
        apiKey: 'api-key',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      completedAt: '2026-04-14T09:30:00.000Z',
    })
  })

  it('defaults complete task requests to an empty body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        taskId: '42',
        projectId: 'project-alpha',
        sourceCategoryId: 'project-alpha:done',
        sourceCategory: 'Done',
        columnId: 'done',
        syncedAt: '2026-04-14T10:00:00.000Z',
        task: {
          id: 'project-alpha:42',
          todoId: '42',
          taskId: '42',
          title: 'Ship it',
          projectId: 'project-alpha',
          projectName: 'Project Alpha',
          sourceCategoryId: 'project-alpha:done',
          sourceCategory: 'Done',
          columnId: 'done',
          completed: true,
          dueDate: null,
          completedAt: null,
          sourceUpdatedAt: '2026-04-14T10:00:00.000Z',
          description: null,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await completeTodoTask('api-key', '42')

    const [url, options] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(url as string)

    expect(parsedUrl.pathname).toBe('/ops/todos/42/complete')
    expect(parsedUrl.searchParams.get('apikey')).toBe('api-key')
    expect(options).toMatchObject({
      method: 'POST',
      headers: {
        apiKey: 'api-key',
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
  })

  it('propagates api errors from the parse helper', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({ error: 'Todos upstream unavailable' }, { ok: false, status: 503 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getTodosOverview('api-key')).rejects.toThrow('Todos upstream unavailable')
  })

  it('surfaces json message errors from the parse helper', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({ message: 'Readable upstream failure' }, { ok: false, status: 503 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getTodosOverview('api-key')).rejects.toThrow('Readable upstream failure')
  })

  it('surfaces json errorMessage errors from the parse helper', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({ errorMessage: 'Readable upstream failure' }, { ok: false, status: 503 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getTodosOverview('api-key')).rejects.toThrow('Readable upstream failure')
  })

  it('surfaces plain-text api errors from the parse helper', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createTextResponse('Todos upstream unavailable', { ok: false, status: 503 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getTodosOverview('api-key')).rejects.toThrow('Todos upstream unavailable')
  })
})
