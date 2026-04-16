import {
	asTodosWorkspaceSourceCategory,
	asTodosWorkspaceSourceCategoryId,
	TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS,
	type TodosWorkspaceCompleteTaskRequest,
	type TodosWorkspaceCompleteTaskResponse,
	type TodosWorkspaceCreateTaskRequest,
	type TodosWorkspaceCreateTaskResponse,
	type TodosWorkspaceMoveTaskRequest,
	type TodosWorkspaceMoveTaskResponse,
	type TodosWorkspaceNormalizedBoardColumnId,
	type TodosWorkspaceNormalizedBoardColumn,
	type TodosWorkspaceOverviewPayload,
	type TodosWorkspaceProjectBoardColumn,
	type TodosWorkspaceProjectDetailPayload,
	type TodosWorkspaceProjectListPayload,
	type TodosWorkspaceProjectSummary,
	type TodosWorkspaceSourceCategory,
	type TodosWorkspaceSourceCategoryId,
	type TodosWorkspaceSourceCategoryRef,
	type TodosWorkspaceTask,
	type TodosWorkspaceUpdateTaskRequest,
	type TodosWorkspaceUpdateTaskResponse,
} from './types';

describe('todos workspace contracts', () => {
	const allowedNormalizedColumnIds = ['backlog', 'in_progress', 'blocked', 'done'] as const satisfies readonly TodosWorkspaceNormalizedBoardColumnId[];

	const backlogLane = {
		sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-backlog'),
		sourceCategory: asTodosWorkspaceSourceCategory('Backlog'),
	} satisfies TodosWorkspaceSourceCategoryRef;

	const nowLane = {
		sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-now'),
		sourceCategory: asTodosWorkspaceSourceCategory('Now'),
	} satisfies TodosWorkspaceSourceCategoryRef;

	const blockedLane = {
		sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-blocked'),
		sourceCategory: asTodosWorkspaceSourceCategory('Blocked'),
	} satisfies TodosWorkspaceSourceCategoryRef;

	const doneLane = {
		sourceCategoryId: asTodosWorkspaceSourceCategoryId('ticktick-done'),
		sourceCategory: asTodosWorkspaceSourceCategory('Done'),
	} satisfies TodosWorkspaceSourceCategoryRef;

	// @ts-expect-error normalized columns must not accept source-category ids
	const invalidNormalizedColumnId: TodosWorkspaceNormalizedBoardColumnId = backlogLane.sourceCategoryId;

	// @ts-expect-error source-category ids must not accept normalized column ids
	const invalidSourceCategoryId: TodosWorkspaceSourceCategoryId = 'in_progress' as TodosWorkspaceNormalizedBoardColumnId;

	// @ts-expect-error source-category names must not accept normalized column ids
	const invalidSourceCategory: TodosWorkspaceSourceCategory = 'done' as TodosWorkspaceNormalizedBoardColumnId;

	const invalidUpdateRequest = {
		taskId: 'todo-1',
		// @ts-expect-error update requests must not require current project or lane state
		projectId: 'project-1',
		title: 'Ship todos workspace',
	} satisfies TodosWorkspaceUpdateTaskRequest;

	const invalidCompleteRequest = {
		taskId: 'todo-1',
		// @ts-expect-error complete requests must not require current project or lane state
		projectId: 'project-1',
	} satisfies TodosWorkspaceCompleteTaskRequest;

	it('defines normalized board columns', () => {
		expect(TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS).toEqual([
			{ id: 'backlog', label: 'Backlog' },
			{ id: 'in_progress', label: 'In Progress' },
			{ id: 'blocked', label: 'Blocked' },
			{ id: 'done', label: 'Done' },
		]);
		expect(TODOS_WORKSPACE_NORMALIZED_BOARD_COLUMNS.map(({ id }) => id)).toEqual(allowedNormalizedColumnIds);
		expect(invalidNormalizedColumnId).toBeDefined();
		expect(invalidSourceCategoryId).toBeDefined();
		expect(invalidSourceCategory).toBeDefined();
		expect(invalidUpdateRequest).toBeDefined();
		expect(invalidCompleteRequest).toBeDefined();
	});

	it('shapes the overview payload', () => {
		const payload = {
			generatedAt: '2026-04-14T12:00:00.000Z',
			projects: [
				{
					id: 'project-1',
					name: 'jobsapi.ashish.me',
					sourceProjectId: 'ticktick-project-1',
					taskCount: 10,
					openTaskCount: 7,
					overdueTaskCount: 1,
					dueSoonTaskCount: 2,
					updatedAt: '2026-04-14T11:55:00.000Z',
				},
			] satisfies TodosWorkspaceProjectSummary[],
			normalizedBoard: {
				columns: [
					{ id: 'backlog', label: 'Backlog', taskCount: 4 },
					{ id: 'in_progress', label: 'In Progress', taskCount: 2 },
					{ id: 'blocked', label: 'Blocked', taskCount: 1 },
					{ id: 'done', label: 'Done', taskCount: 3 },
				] satisfies TodosWorkspaceNormalizedBoardColumn[],
				totalTaskCount: 10,
			},
			overdueTasks: [
				{
					id: 'todo-1',
					todoId: 'ticktick-1',
					taskId: '401',
					title: 'Fix dashboard auth redirect',
					projectId: 'project-1',
					projectName: 'jobsapi.ashish.me',
					...nowLane,
					columnId: 'in_progress',
					completed: false,
					dueDate: '2026-04-13T09:00:00.000Z',
					completedAt: null,
					sourceUpdatedAt: '2026-04-14T11:50:00.000Z',
				} satisfies TodosWorkspaceTask,
			],
			dueSoonTasks: [],
		} satisfies TodosWorkspaceOverviewPayload;

		expect(payload.projects).toHaveLength(1);
		expect(payload.normalizedBoard.columns).toHaveLength(4);
		expect(payload.overdueTasks[0]?.columnId).toBe('in_progress');
		expect(payload.overdueTasks[0]?.sourceCategoryId).toBe(payload.overdueTasks[0]?.sourceCategoryId);
	});

	it('shapes the project list payload', () => {
		const payload = {
			projects: [
				{
					id: 'project-1',
					name: 'jobsapi.ashish.me',
					sourceProjectId: 'ticktick-project-1',
					taskCount: 10,
					openTaskCount: 7,
					overdueTaskCount: 1,
					dueSoonTaskCount: 2,
					updatedAt: '2026-04-14T11:55:00.000Z',
				},
			] satisfies TodosWorkspaceProjectSummary[],
		} satisfies TodosWorkspaceProjectListPayload;

		expect(payload.projects[0]?.name).toBe('jobsapi.ashish.me');
	});

	it('shapes the project detail payload', () => {
		const payload = {
			project: {
				id: 'project-1',
				name: 'jobsapi.ashish.me',
				sourceProjectId: 'ticktick-project-1',
				taskCount: 10,
				openTaskCount: 7,
				overdueTaskCount: 1,
				dueSoonTaskCount: 2,
				updatedAt: '2026-04-14T11:55:00.000Z',
			} satisfies TodosWorkspaceProjectSummary,
			projectBoard: {
				columns: [
					{
						...nowLane,
						normalizedColumnId: 'in_progress',
						normalizedColumnLabel: 'In Progress',
						taskCount: 3,
						taskIds: ['todo-1', 'todo-2'],
					},
				] satisfies TodosWorkspaceProjectBoardColumn[],
				totalTaskCount: 10,
			},
			normalizedBoard: {
				columns: [
					{ id: 'backlog', label: 'Backlog', taskCount: 4 },
					{ id: 'in_progress', label: 'In Progress', taskCount: 2 },
					{ id: 'blocked', label: 'Blocked', taskCount: 1 },
					{ id: 'done', label: 'Done', taskCount: 3 },
				],
				totalTaskCount: 10,
			},
			tasks: [
				{
					id: 'todo-1',
					todoId: 'ticktick-1',
					taskId: null,
					title: 'Fix dashboard auth redirect',
					projectId: 'project-1',
					projectName: 'jobsapi.ashish.me',
					...nowLane,
					columnId: 'in_progress',
					completed: false,
					dueDate: '2026-04-13T09:00:00.000Z',
					completedAt: null,
					sourceUpdatedAt: '2026-04-14T11:50:00.000Z',
				} satisfies TodosWorkspaceTask,
			],
		} satisfies TodosWorkspaceProjectDetailPayload;

		expect(payload.projectBoard.columns[0]?.sourceCategory).toBe('Now');
		expect(payload.projectBoard.columns[0]?.normalizedColumnId).toBe('in_progress');
		expect(payload.projectBoard.columns[0]?.normalizedColumnLabel).toBe('In Progress');
		expect(payload.projectBoard.columns[0]?.normalizedColumnId).toBe(payload.tasks[0]?.columnId);
		expect(payload.projectBoard.columns[0]?.sourceCategoryId).toBe(payload.tasks[0]?.sourceCategoryId);
		expect(payload.tasks[0]?.sourceCategoryId).toBe('ticktick-now');
		expect(payload.tasks).toHaveLength(1);
	});

	it('shapes task mutation payloads', () => {
		const createRequest = {
			projectId: 'project-1',
			...backlogLane,
			columnId: 'backlog',
			title: 'Ship todos workspace',
			description: 'Build the dashboard entrypoint',
			dueDate: '2026-04-20T09:00:00.000Z',
		} satisfies TodosWorkspaceCreateTaskRequest;

		const updateRequest = {
			taskId: 'todo-1',
			title: 'Ship todos workspace',
			description: 'Build the dashboard entrypoint',
			dueDate: null,
		} satisfies TodosWorkspaceUpdateTaskRequest;

		const moveRequest = {
			taskId: 'todo-1',
			targetProjectId: 'project-2',
			targetSourceCategoryId: blockedLane.sourceCategoryId,
			targetSourceCategory: blockedLane.sourceCategory,
			targetColumnId: 'blocked',
		} satisfies TodosWorkspaceMoveTaskRequest;

		const completeRequest = {
			taskId: 'todo-1',
			completedAt: '2026-04-14T12:05:00.000Z',
		} satisfies TodosWorkspaceCompleteTaskRequest;

		const createTask = {
			id: 'todo-1',
			todoId: 'ticktick-1',
			taskId: '401',
			title: 'Ship todos workspace',
			projectId: 'project-1',
			projectName: 'jobsapi.ashish.me',
			...backlogLane,
			columnId: 'backlog',
			completed: false,
			dueDate: '2026-04-20T09:00:00.000Z',
			completedAt: null,
			sourceUpdatedAt: '2026-04-14T11:50:00.000Z',
		} satisfies TodosWorkspaceTask;

		const createResponse = {
			taskId: 'todo-1',
			projectId: 'project-1',
			...backlogLane,
			columnId: 'backlog',
			syncedAt: '2026-04-14T11:51:00.000Z',
			task: createTask,
		} satisfies TodosWorkspaceCreateTaskResponse;

		const updateResponse = {
			taskId: 'todo-1',
			projectId: 'project-1',
			...nowLane,
			columnId: 'in_progress',
			syncedAt: '2026-04-14T11:52:00.000Z',
			task: {
				...createTask,
				...nowLane,
				columnId: 'in_progress',
			} satisfies TodosWorkspaceTask,
		} satisfies TodosWorkspaceUpdateTaskResponse;

		const moveResponse = {
			taskId: 'todo-1',
			projectId: 'project-2',
			...blockedLane,
			columnId: 'blocked',
			syncedAt: '2026-04-14T11:53:00.000Z',
			task: {
				...createTask,
				projectId: 'project-2',
				...blockedLane,
				columnId: 'blocked',
			} satisfies TodosWorkspaceTask,
		} satisfies TodosWorkspaceMoveTaskResponse;

		const completeResponse = {
			taskId: 'todo-1',
			projectId: 'project-1',
			...doneLane,
			columnId: 'done',
			syncedAt: '2026-04-14T12:05:00.000Z',
			task: {
				...createTask,
				...doneLane,
				columnId: 'done',
				completed: true,
				completedAt: '2026-04-14T12:05:00.000Z',
			} satisfies TodosWorkspaceTask,
		} satisfies TodosWorkspaceCompleteTaskResponse;

		expect(createRequest.columnId).toBe('backlog');
		expect(createRequest.sourceCategoryId).toBe('ticktick-backlog');
		expect(updateRequest.taskId).toBe('todo-1');
		expect(moveRequest.targetColumnId).toBe('blocked');
		expect(moveRequest.targetSourceCategoryId).toBe(blockedLane.sourceCategoryId);
		expect(completeRequest.completedAt).toBe('2026-04-14T12:05:00.000Z');
		expect(moveResponse.task.columnId).toBe(moveRequest.targetColumnId);
		expect(moveResponse.task.sourceCategoryId).toBe(moveRequest.targetSourceCategoryId);
		expect(moveResponse.task.projectId).toBe(moveRequest.targetProjectId);
		expect(completeResponse.task.completed).toBe(true);
		expect(updateResponse.task.todoId).toBe('ticktick-1');
		expect(createResponse.syncedAt).toBe('2026-04-14T11:51:00.000Z');
		expect(createResponse.sourceCategoryId).toBe(createResponse.task.sourceCategoryId);
		expect(completeResponse.sourceCategory).toBe(completeResponse.task.sourceCategory);
	});
});
