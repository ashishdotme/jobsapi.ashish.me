import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TodosUpstreamClient } from './todos-upstream.client';
import { TodosWorkspaceModule } from './todos-workspace.module';

describe('TodosWorkspace mutation routes', () => {
	let app: INestApplication;
	const upstreamClientMock = {
		getProjects: jest.fn(),
		getProject: jest.fn(),
		createTask: jest.fn(),
		updateTask: jest.fn(),
		moveTask: jest.fn(),
		completeTask: jest.fn(),
	};

	const syncedAt = '2026-04-14T12:00:00.000Z';

	beforeEach(async () => {
		process.env.ASHISHDOTME_TOKEN = 'test-key';
		jest.useFakeTimers();
		jest.setSystemTime(new Date(syncedAt));

		upstreamClientMock.getProjects.mockReset();
		upstreamClientMock.getProject.mockReset();
		upstreamClientMock.createTask.mockReset();
		upstreamClientMock.updateTask.mockReset();
		upstreamClientMock.moveTask.mockReset();
		upstreamClientMock.completeTask.mockReset();

		upstreamClientMock.getProjects.mockResolvedValue([
			{ id: 'project-alpha', name: 'Alpha' },
			{ id: 'project-beta', name: 'Beta' },
		]);

		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [],
			columns: [],
		});

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [TodosWorkspaceModule],
		})
			.overrideProvider(TodosUpstreamClient)
			.useValue(upstreamClientMock)
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app?.close();
		jest.useRealTimers();
		delete process.env.ASHISHDOTME_TOKEN;
	});

	it('creates a task and resolves the created task from project detail', async () => {
		upstreamClientMock.createTask.mockResolvedValue({
			id: 701,
			todoId: 'ticktick-created',
		});
		upstreamClientMock.getProject.mockResolvedValueOnce({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'ticktick-created',
					projectId: 'project-alpha',
					title: 'Create dashboard task',
					category: 'Backlog',
					localTodoId: 701,
					dueDate: '2026-04-18T09:00:00.000Z',
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer())
			.post('/ops/todos')
			.set('apikey', 'test-key')
			.send({
				projectId: 'project-alpha',
				sourceCategoryId: 'project-alpha:backlog',
				sourceCategory: 'Backlog',
				columnId: 'backlog',
				title: 'Create dashboard task',
				description: 'Build the tasks workspace',
				dueDate: '2026-04-18T09:00:00.000Z',
			})
			.expect(200)
			.expect(({ body }) => {
				expect(body).toEqual(
					expect.objectContaining({
						taskId: '701',
						projectId: 'project-alpha',
						sourceCategory: 'Backlog',
						columnId: 'backlog',
						syncedAt,
						task: expect.objectContaining({
							id: 'project-alpha:ticktick-created',
							todoId: 'ticktick-created',
							taskId: '701',
							title: 'Create dashboard task',
							projectId: 'project-alpha',
							projectName: 'Alpha',
							sourceCategory: 'Backlog',
							columnId: 'backlog',
							completed: false,
							dueDate: '2026-04-18T09:00:00.000Z',
							completedAt: null,
							sourceUpdatedAt: syncedAt,
						}),
					}),
				);
			});

		expect(upstreamClientMock.createTask).toHaveBeenCalledWith({
			content: 'Create dashboard task',
			desc: 'Build the tasks workspace',
			projectId: 'project-alpha',
			category: 'Backlog',
			dueDate: '2026-04-18T09:00:00.000Z',
		});
	});

	it('does not forward a synthetic backlog column id upstream when creating a task', async () => {
		upstreamClientMock.createTask.mockResolvedValue({
			id: 701,
			todoId: 'ticktick-created',
		});
		upstreamClientMock.getProject.mockResolvedValueOnce({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'ticktick-created',
					projectId: 'project-alpha',
					title: 'Create dashboard task',
					category: 'Backlog',
					localTodoId: 701,
					status: 0,
				},
			],
			columns: [
				{ id: 'col-backlog', projectId: 'project-alpha', name: 'Backlog' },
				{ id: 'col-doing', projectId: 'project-alpha', name: 'Doing' },
			],
		});

		await request(app.getHttpServer())
			.post('/ops/todos')
			.set('apikey', 'test-key')
			.send({
				projectId: 'project-alpha',
				sourceCategoryId: 'project-alpha:backlog',
				sourceCategory: 'Backlog',
				columnId: 'backlog',
				title: 'Create dashboard task',
				description: null,
				dueDate: null,
			})
			.expect(200);

		expect(upstreamClientMock.createTask).toHaveBeenCalledWith({
			content: 'Create dashboard task',
			projectId: 'project-alpha',
			category: 'Backlog',
			dueDate: null,
		});
	});

	it('forwards the raw TickTick column id when creating a task', async () => {
		upstreamClientMock.createTask.mockResolvedValue({
			id: 701,
			todoId: 'ticktick-created',
		});
		upstreamClientMock.getProject.mockResolvedValueOnce({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'ticktick-created',
					projectId: 'project-alpha',
					title: 'Create dashboard task',
					category: 'Backlog',
					columnId: 'col-backlog',
					localTodoId: 701,
					status: 0,
				},
			],
			columns: [{ id: 'col-backlog', projectId: 'project-alpha', name: 'Backlog' }],
		});

		await request(app.getHttpServer())
			.post('/ops/todos')
			.set('apikey', 'test-key')
			.send({
				projectId: 'project-alpha',
				sourceCategoryId: 'project-alpha:col-backlog',
				sourceCategory: 'Backlog',
				columnId: 'backlog',
				title: 'Create dashboard task',
				description: null,
				dueDate: null,
			})
			.expect(200);

		expect(upstreamClientMock.createTask).toHaveBeenCalledWith({
			content: 'Create dashboard task',
			projectId: 'project-alpha',
			category: 'Backlog',
			columnId: 'col-backlog',
			dueDate: null,
		});
	});

	it('creates a task without requiring a description', async () => {
		upstreamClientMock.createTask.mockResolvedValue({
			id: 701,
			todoId: 'ticktick-created',
		});
		upstreamClientMock.getProject.mockResolvedValueOnce({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'ticktick-created',
					projectId: 'project-alpha',
					title: 'Create dashboard task',
					category: 'Backlog',
					localTodoId: 701,
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer())
			.post('/ops/todos')
			.set('apikey', 'test-key')
			.send({
				projectId: 'project-alpha',
				sourceCategoryId: 'project-alpha:backlog',
				sourceCategory: 'Backlog',
				columnId: 'backlog',
				title: 'Create dashboard task',
				description: null,
				dueDate: null,
			})
			.expect(200);

		expect(upstreamClientMock.createTask).toHaveBeenCalledWith({
			content: 'Create dashboard task',
			projectId: 'project-alpha',
			category: 'Backlog',
			dueDate: null,
		});
	});

	it('updates a task after resolving the current task by local id', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [
					{
						id: 'ticktick-task-1',
						projectId: 'project-alpha',
						title: 'Old dashboard task',
						category: 'Backlog',
						localTodoId: 701,
						dueDate: '2026-04-17T09:00:00.000Z',
						status: 0,
					},
				],
				columns: [],
			})
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [
					{
						id: 'ticktick-task-1',
						projectId: 'project-alpha',
						title: 'Updated dashboard task',
						category: 'Backlog',
						localTodoId: 701,
						dueDate: '2026-04-19T09:00:00.000Z',
						status: 0,
					},
				],
				columns: [],
			});
		upstreamClientMock.updateTask.mockResolvedValue({ id: 701, todoId: 'ticktick-task-1' });

		await request(app.getHttpServer())
			.patch('/ops/todos/701')
			.set('apikey', 'test-key')
			.send({
				title: 'Updated dashboard task',
				description: 'Update the task notes',
				dueDate: '2026-04-19T09:00:00.000Z',
			})
			.expect(200)
			.expect(({ body }) => {
				expect(body).toEqual(
					expect.objectContaining({
						taskId: '701',
						projectId: 'project-alpha',
						sourceCategory: 'Backlog',
						columnId: 'backlog',
						syncedAt,
						task: expect.objectContaining({
							id: 'project-alpha:ticktick-task-1',
							todoId: 'ticktick-task-1',
							taskId: '701',
							title: 'Updated dashboard task',
							projectId: 'project-alpha',
							projectName: 'Alpha',
							sourceCategory: 'Backlog',
							columnId: 'backlog',
							completed: false,
							dueDate: '2026-04-19T09:00:00.000Z',
							completedAt: null,
							sourceUpdatedAt: syncedAt,
						}),
					}),
				);
			});

		expect(upstreamClientMock.updateTask).toHaveBeenCalledWith('701', {
			content: 'Updated dashboard task',
			desc: 'Update the task notes',
			dueDate: '2026-04-19T09:00:00.000Z',
		});
	});

	it('ignores a null due date on update instead of proxying it upstream', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [
					{
						id: 'ticktick-task-1',
						projectId: 'project-alpha',
						title: 'Old dashboard task',
						category: 'Backlog',
						localTodoId: 701,
						status: 0,
					},
				],
				columns: [],
			})
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [
					{
						id: 'ticktick-task-1',
						projectId: 'project-alpha',
						title: 'Updated dashboard task',
						category: 'Backlog',
						localTodoId: 701,
						status: 0,
					},
				],
				columns: [],
			});
		upstreamClientMock.updateTask.mockResolvedValue({ id: 701, todoId: 'ticktick-task-1' });

		await request(app.getHttpServer())
			.patch('/ops/todos/701')
			.set('apikey', 'test-key')
			.send({
				title: 'Updated dashboard task',
				description: 'Update the task notes',
				dueDate: null,
			})
			.expect(200);

		expect(upstreamClientMock.updateTask).toHaveBeenCalledWith('701', {
			content: 'Updated dashboard task',
			desc: 'Update the task notes',
		});
	});

	it('moves a task to another project and returns the refreshed task', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([
			{ id: 'project-alpha', name: 'Alpha' },
			{ id: 'project-beta', name: 'Beta' },
		]);
		let moved = false;
		upstreamClientMock.getProject.mockImplementation(async (projectId: string) => {
			if (projectId === 'project-alpha') {
				return {
					project: { id: 'project-alpha', name: 'Alpha' },
					tasks: [
						{
							id: 'ticktick-task-1',
							projectId: 'project-alpha',
							title: 'Move me',
							category: 'Backlog',
							localTodoId: 701,
							status: 0,
						},
					],
					columns: [],
				};
			}

			return {
				project: { id: 'project-beta', name: 'Beta' },
				tasks: moved
					? [
							{
								id: 'ticktick-task-1',
								projectId: 'project-beta',
								title: 'Move me',
								category: 'Blocked',
								localTodoId: 701,
								status: 0,
							},
						]
					: [],
				columns: [],
			};
		});
		upstreamClientMock.moveTask.mockImplementation(async () => {
			moved = true;
		});

		await request(app.getHttpServer())
			.post('/ops/todos/701/move')
			.set('apikey', 'test-key')
			.send({
				targetProjectId: 'project-beta',
				targetSourceCategoryId: 'project-beta:blocked',
				targetSourceCategory: 'Blocked',
				targetColumnId: 'blocked',
			})
			.expect(200)
			.expect(({ body }) => {
				expect(body).toEqual(
					expect.objectContaining({
						taskId: '701',
						projectId: 'project-beta',
						sourceCategory: 'Blocked',
						columnId: 'blocked',
						syncedAt,
						task: expect.objectContaining({
							id: 'project-beta:ticktick-task-1',
							todoId: 'ticktick-task-1',
							taskId: '701',
							title: 'Move me',
							projectId: 'project-beta',
							projectName: 'Beta',
							sourceCategory: 'Blocked',
							columnId: 'blocked',
							completed: false,
							completedAt: null,
							sourceUpdatedAt: syncedAt,
						}),
					}),
				);
			});

		expect(upstreamClientMock.moveTask).toHaveBeenCalledWith('701', {
			projectId: 'project-beta',
			category: 'Blocked',
			columnId: 'blocked',
		});
	});

	it('passes the raw TickTick column id when moving within a kanban project', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		let moved = false;
		upstreamClientMock.getProject.mockImplementation(async () => ({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: moved
				? [
						{
							id: 'ticktick-task-1',
							projectId: 'project-alpha',
							title: 'Move me',
							columnId: 'col-done',
							localTodoId: 701,
							status: 0,
						},
					]
				: [
						{
							id: 'ticktick-task-1',
							projectId: 'project-alpha',
							title: 'Move me',
							columnId: 'col-backlog',
							localTodoId: 701,
							status: 0,
						},
					],
			columns: [
				{ id: 'col-backlog', projectId: 'project-alpha', name: 'Backlog' },
				{ id: 'col-done', projectId: 'project-alpha', name: 'Done' },
			],
		}));
		upstreamClientMock.moveTask.mockImplementation(async () => {
			moved = true;
		});

		await request(app.getHttpServer())
			.post('/ops/todos/701/move')
			.set('apikey', 'test-key')
			.send({
				targetProjectId: 'project-alpha',
				targetSourceCategoryId: 'project-alpha:col-done',
				targetSourceCategory: 'Done',
				targetColumnId: 'done',
			})
			.expect(200)
			.expect(({ body }) => {
				expect(body.task.sourceCategory).toBe('Done');
				expect(body.task.columnId).toBe('done');
			});

		expect(upstreamClientMock.moveTask).toHaveBeenCalledWith('701', {
			projectId: 'project-alpha',
			category: 'Done',
			columnId: 'col-done',
		});
	});

	it('marks a task completed when moving it into the done lane', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		let movedToDone = false;
		let completed = false;
		upstreamClientMock.getProject.mockImplementation(async () => ({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks:
				movedToDone && completed
					? [
							{
								id: 'ticktick-task-1',
								projectId: 'project-alpha',
								title: 'Move me',
								columnId: 'col-done',
								category: 'Done',
								localTodoId: 701,
								status: 2,
								completedTime: '2026-04-14T12:00:02.000Z',
							},
						]
					: [
							{
								id: 'ticktick-task-1',
								projectId: 'project-alpha',
								title: 'Move me',
								columnId: 'col-backlog',
								category: 'Backlog',
								localTodoId: 701,
								status: 0,
							},
						],
			columns: [
				{ id: 'col-backlog', projectId: 'project-alpha', name: 'Backlog' },
				{ id: 'col-done', projectId: 'project-alpha', name: 'Done' },
			],
		}));
		upstreamClientMock.moveTask.mockImplementation(async () => {
			movedToDone = true;
		});
		upstreamClientMock.completeTask.mockImplementation(async () => {
			completed = true;
		});

		await request(app.getHttpServer())
			.post('/ops/todos/701/move')
			.set('apikey', 'test-key')
			.send({
				targetProjectId: 'project-alpha',
				targetSourceCategoryId: 'project-alpha:col-done',
				targetSourceCategory: 'Done',
				targetColumnId: 'done',
			})
			.expect(200)
			.expect(({ body }) => {
				expect(body.task.sourceCategory).toBe('Done');
				expect(body.task.columnId).toBe('done');
				expect(body.task.completed).toBe(true);
				expect(body.task.completedAt).toBe('2026-04-14T12:00:02.000Z');
			});

		expect(upstreamClientMock.moveTask).toHaveBeenCalledWith('701', {
			projectId: 'project-alpha',
			category: 'Done',
			columnId: 'col-done',
		});
		expect(upstreamClientMock.completeTask).toHaveBeenCalledWith('701', 'ticktick-task-1');
	});

	it('completes a task and returns the refreshed task when the task remains visible', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [
					{
						id: 'ticktick-task-1',
						projectId: 'project-alpha',
						title: 'Complete me',
						category: 'Now',
						localTodoId: 701,
						status: 0,
					},
				],
				columns: [],
			})
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [
					{
						id: 'ticktick-task-1',
						projectId: 'project-alpha',
						title: 'Complete me',
						category: 'Done',
						localTodoId: 701,
						completedTime: '2026-04-14T12:00:02.000Z',
						status: 2,
					},
				],
				columns: [],
			});

		await request(app.getHttpServer())
			.post('/ops/todos/701/complete')
			.set('apikey', 'test-key')
			.send({})
			.expect(200)
			.expect(({ body }) => {
				expect(body).toEqual(
					expect.objectContaining({
						taskId: '701',
						projectId: 'project-alpha',
						sourceCategory: 'Done',
						columnId: 'done',
						syncedAt,
						task: expect.objectContaining({
							id: 'project-alpha:ticktick-task-1',
							todoId: 'ticktick-task-1',
							taskId: '701',
							title: 'Complete me',
							projectId: 'project-alpha',
							projectName: 'Alpha',
							sourceCategory: 'Done',
							columnId: 'done',
							completed: true,
							completedAt: '2026-04-14T12:00:02.000Z',
							sourceUpdatedAt: '2026-04-14T12:00:02.000Z',
						}),
					}),
				);
			});

		expect(upstreamClientMock.completeTask).toHaveBeenCalledWith('701', 'ticktick-task-1');
	});

	it('synthesizes a completion response when the completed task no longer appears in detail', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [
					{
						id: 'ticktick-task-1',
						projectId: 'project-alpha',
						title: 'Complete me',
						category: 'Now',
						localTodoId: 701,
						dueDate: '2026-04-17T09:00:00.000Z',
						status: 0,
					},
				],
				columns: [],
			})
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [],
				columns: [],
			});

		await request(app.getHttpServer())
			.post('/ops/todos/701/complete')
			.set('apikey', 'test-key')
			.send({})
			.expect(200)
			.expect(({ body }) => {
				expect(body).toEqual(
					expect.objectContaining({
						taskId: '701',
						projectId: 'project-alpha',
						sourceCategory: 'Now',
						columnId: 'in_progress',
						syncedAt,
						task: expect.objectContaining({
							id: 'project-alpha:ticktick-task-1',
							todoId: 'ticktick-task-1',
							taskId: '701',
							title: 'Complete me',
							projectId: 'project-alpha',
							projectName: 'Alpha',
							sourceCategory: 'Now',
							columnId: 'in_progress',
							completed: true,
							dueDate: '2026-04-17T09:00:00.000Z',
							completedAt: syncedAt,
							sourceUpdatedAt: syncedAt,
						}),
					}),
				);
			});

		expect(upstreamClientMock.completeTask).toHaveBeenCalledWith('701', 'ticktick-task-1');
	});

	it('rejects invalid task ids before proxying upstream', async () => {
		await request(app.getHttpServer()).post('/ops/todos/not-a-number/complete').set('apikey', 'test-key').send({}).expect(400);

		await request(app.getHttpServer()).patch('/ops/todos/01').set('apikey', 'test-key').send({ title: 'Updated dashboard task' }).expect(400);

		await request(app.getHttpServer())
			.post('/ops/todos/1e3/move')
			.set('apikey', 'test-key')
			.send({
				targetProjectId: 'project-beta',
				targetSourceCategoryId: 'project-beta:blocked',
				targetSourceCategory: 'Blocked',
				targetColumnId: 'blocked',
			})
			.expect(400);

		expect(upstreamClientMock.getProjects).not.toHaveBeenCalled();
		expect(upstreamClientMock.getProject).not.toHaveBeenCalled();
		expect(upstreamClientMock.completeTask).not.toHaveBeenCalled();
	});

	it('uses a provided completedAt when synthesizing a completion response', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [
					{
						id: 'ticktick-task-1',
						projectId: 'project-alpha',
						title: 'Complete me',
						category: 'Now',
						localTodoId: 701,
						dueDate: '2026-04-17T09:00:00.000Z',
						status: 0,
					},
				],
				columns: [],
			})
			.mockResolvedValueOnce({
				project: { id: 'project-alpha', name: 'Alpha' },
				tasks: [],
				columns: [],
			});

		await request(app.getHttpServer())
			.post('/ops/todos/701/complete')
			.set('apikey', 'test-key')
			.send({
				completedAt: '2026-04-14T12:05:00.000Z',
			})
			.expect(200)
			.expect(({ body }) => {
				expect(body.task.completedAt).toBe('2026-04-14T12:05:00.000Z');
				expect(body.task.sourceUpdatedAt).toBe(syncedAt);
			});

		expect(upstreamClientMock.completeTask).toHaveBeenCalledWith('701', 'ticktick-task-1');
	});

	it('rejects malformed completedAt values before synthesizing completion responses', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'ticktick-task-1',
					projectId: 'project-alpha',
					title: 'Complete me',
					category: 'Now',
					localTodoId: 701,
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer())
			.post('/ops/todos/701/complete')
			.set('apikey', 'test-key')
			.send({
				completedAt: 'not-a-date',
			})
			.expect(400);

		expect(upstreamClientMock.completeTask).not.toHaveBeenCalled();
	});

	it('returns 404 when an update target cannot be resolved', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'ticktick-task-1',
					projectId: 'project-alpha',
					title: 'Another task',
					category: 'Backlog',
					localTodoId: 999,
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).patch('/ops/todos/701').set('apikey', 'test-key').send({ title: 'Updated dashboard task' }).expect(404);

		expect(upstreamClientMock.updateTask).not.toHaveBeenCalled();
	});

	it('returns 404 when a completion target cannot be resolved', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'ticktick-task-1',
					projectId: 'project-alpha',
					title: 'Another task',
					category: 'Backlog',
					localTodoId: 999,
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).post('/ops/todos/701/complete').set('apikey', 'test-key').send({}).expect(404);

		expect(upstreamClientMock.completeTask).not.toHaveBeenCalled();
	});

	it('returns 503 when the same local task id appears in multiple discovered projects', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([
			{ id: 'project-alpha', name: 'Alpha' },
			{ id: 'project-beta', name: 'Beta' },
		]);
		upstreamClientMock.getProject.mockImplementation(async (projectId: string) => {
			if (projectId === 'project-alpha') {
				return {
					project: { id: 'project-alpha', name: 'Alpha' },
					tasks: [
						{
							id: 'ticktick-task-1',
							projectId: 'project-alpha',
							title: 'Duplicate task',
							category: 'Backlog',
							localTodoId: 701,
							status: 0,
						},
					],
					columns: [],
				};
			}

			return {
				project: { id: 'project-beta', name: 'Beta' },
				tasks: [
					{
						id: 'ticktick-task-2',
						projectId: 'project-beta',
						title: 'Duplicate task',
						category: 'Now',
						localTodoId: 701,
						status: 0,
					},
				],
				columns: [],
			};
		});

		await request(app.getHttpServer()).patch('/ops/todos/701').set('apikey', 'test-key').send({ title: 'Updated dashboard task' }).expect(503);

		expect(upstreamClientMock.updateTask).not.toHaveBeenCalled();
	});
});
