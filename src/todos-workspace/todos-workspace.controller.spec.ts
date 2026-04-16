import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TodosUpstreamClient } from './todos-upstream.client';
import { TodosWorkspaceModule } from './todos-workspace.module';

describe('TodosWorkspace ops routes', () => {
	let app: INestApplication;
	const upstreamClientMock = {
		getProjects: jest.fn(),
		getProject: jest.fn(),
	};

	beforeEach(async () => {
		process.env.ASHISHDOTME_TOKEN = 'test-key';
		upstreamClientMock.getProjects.mockReset();
		upstreamClientMock.getProject.mockReset();
		upstreamClientMock.getProjects.mockResolvedValue([]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-1', name: 'Todos Workspace' },
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

	it('boots the module and exposes the overview route', async () => {
		await request(app.getHttpServer())
			.get('/ops/todos/overview')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body).toEqual(
					expect.objectContaining({
						generatedAt: expect.any(String),
						projects: expect.any(Array),
						normalizedBoard: expect.objectContaining({
							columns: expect.any(Array),
							totalTaskCount: expect.any(Number),
						}),
						overdueTasks: expect.any(Array),
						dueSoonTasks: expect.any(Array),
					}),
				);
			});
	});

	it('shapes the overview route from upstream projects and tasks', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-04-14T12:00:00.000Z'));

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
							id: 'task-1',
							projectId: 'project-alpha',
							title: 'Backlog overdue task',
							category: 'Backlog',
							localTodoId: 501,
							dueDate: '2026-04-10T09:00:00.000Z',
							status: 0,
						},
						{
							id: 'task-2',
							projectId: 'project-alpha',
							title: 'In progress due soon',
							category: 'Now',
							dueDate: '2026-04-16T09:00:00.000Z',
							status: 0,
						},
						{
							id: 'task-3',
							projectId: 'project-alpha',
							title: 'Second backlog due soon task',
							category: 'Backlog',
							dueDate: '2026-04-17T09:00:00.000Z',
							status: 0,
						},
						{
							id: 'task-4',
							projectId: 'project-alpha',
							title: 'Completed task stays out of slices',
							category: 'Blocked',
							dueDate: '2026-04-15T09:00:00.000Z',
							completedTime: '2026-04-12T09:00:00.000Z',
							status: 2,
						},
					],
					columns: [
						{ id: 'alpha-backlog', projectId: 'project-alpha', name: 'Backlog' },
						{ id: 'alpha-doing', projectId: 'project-alpha', name: 'Doing' },
					],
				};
			}

			return {
				project: { id: 'project-beta', name: 'Beta' },
				tasks: [
					{
						id: 'task-5',
						projectId: 'project-beta',
						title: 'Done task',
						category: 'Done',
						dueDate: '2026-04-11T09:00:00.000Z',
						completedTime: '2026-04-13T09:00:00.000Z',
						status: 2,
					},
					{
						id: 'task-6',
						projectId: 'project-beta',
						title: 'Second in progress task',
						category: 'Now',
						status: 0,
					},
				],
				columns: [
					{ id: 'beta-backlog', projectId: 'project-beta', name: 'Backlog' },
					{ id: 'beta-done', projectId: 'project-beta', name: 'Done' },
				],
			};
		});

		await request(app.getHttpServer())
			.get('/ops/todos/overview')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.generatedAt).toBe('2026-04-14T12:00:00.000Z');
				expect(body.projects).toEqual([
					expect.objectContaining({
						id: 'project-alpha',
						name: 'Alpha',
						sourceProjectId: 'project-alpha',
						taskCount: 4,
						openTaskCount: 3,
						overdueTaskCount: 1,
						dueSoonTaskCount: 2,
						updatedAt: '2026-04-14T12:00:00.000Z',
					}),
					expect.objectContaining({
						id: 'project-beta',
						name: 'Beta',
						sourceProjectId: 'project-beta',
						taskCount: 2,
						openTaskCount: 1,
						overdueTaskCount: 0,
						dueSoonTaskCount: 0,
						updatedAt: '2026-04-14T12:00:00.000Z',
					}),
				]);
				expect(body.normalizedBoard).toEqual({
					columns: [
						expect.objectContaining({
							id: 'backlog',
							label: 'Backlog',
							taskCount: 2,
							tasks: expect.arrayContaining([
								expect.objectContaining({ todoId: 'task-1', title: 'Backlog overdue task' }),
								expect.objectContaining({ todoId: 'task-3', title: 'Second backlog due soon task' }),
							]),
						}),
						expect.objectContaining({
							id: 'in_progress',
							label: 'In Progress',
							taskCount: 2,
							tasks: expect.arrayContaining([
								expect.objectContaining({ todoId: 'task-2', title: 'In progress due soon' }),
								expect.objectContaining({ todoId: 'task-6', title: 'Second in progress task' }),
							]),
						}),
						expect.objectContaining({
							id: 'blocked',
							label: 'Blocked',
							taskCount: 1,
							tasks: [expect.objectContaining({ todoId: 'task-4', title: 'Completed task stays out of slices' })],
						}),
						expect.objectContaining({
							id: 'done',
							label: 'Done',
							taskCount: 1,
							tasks: [expect.objectContaining({ todoId: 'task-5', title: 'Done task' })],
						}),
					],
					totalTaskCount: 6,
				});
				expect(body.overdueTasks).toEqual([
					expect.objectContaining({
						id: 'project-alpha:task-1',
						todoId: 'task-1',
						taskId: '501',
						projectId: 'project-alpha',
						projectName: 'Alpha',
						columnId: 'backlog',
						completed: false,
						dueDate: '2026-04-10T09:00:00.000Z',
					}),
				]);
				expect(body.dueSoonTasks).toEqual([
					expect.objectContaining({
						id: 'project-alpha:task-2',
						todoId: 'task-2',
						taskId: null,
						projectId: 'project-alpha',
						projectName: 'Alpha',
						columnId: 'in_progress',
						completed: false,
						dueDate: '2026-04-16T09:00:00.000Z',
					}),
					expect.objectContaining({
						id: 'project-alpha:task-3',
						todoId: 'task-3',
						projectId: 'project-alpha',
						projectName: 'Alpha',
						columnId: 'backlog',
						sourceCategory: 'Backlog',
						completed: false,
						dueDate: '2026-04-17T09:00:00.000Z',
					}),
				]);
			});

		expect(upstreamClientMock.getProjects).toHaveBeenCalledTimes(1);
		expect(upstreamClientMock.getProject).toHaveBeenCalledTimes(2);
		expect(upstreamClientMock.getProject).toHaveBeenCalledWith('project-alpha');
		expect(upstreamClientMock.getProject).toHaveBeenCalledWith('project-beta');
	});

	it('shapes the projects list route from upstream project detail data', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-04-14T12:00:00.000Z'));

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
							id: 'task-1',
							projectId: 'project-alpha',
							title: 'Backlog overdue task',
							category: 'Backlog',
							localTodoId: 601,
							dueDate: '2026-04-10T09:00:00.000Z',
							status: 0,
						},
						{
							id: 'task-2',
							projectId: 'project-alpha',
							title: 'In progress due soon',
							category: 'Now',
							dueDate: '2026-04-16T09:00:00.000Z',
							status: 0,
						},
					],
					columns: [
						{ id: 'alpha-backlog', projectId: 'project-alpha', name: 'Backlog' },
						{ id: 'alpha-doing', projectId: 'project-alpha', name: 'Doing' },
					],
				};
			}

			return {
				project: { id: 'project-beta', name: 'Beta' },
				tasks: [
					{
						id: 'task-3',
						projectId: 'project-beta',
						title: 'Completed task',
						category: 'Done',
						completedTime: '2026-04-13T09:00:00.000Z',
						status: 2,
					},
				],
				columns: [
					{ id: 'beta-backlog', projectId: 'project-beta', name: 'Backlog' },
					{ id: 'beta-done', projectId: 'project-beta', name: 'Done' },
				],
			};
		});

		await request(app.getHttpServer())
			.get('/ops/todos/projects')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.projects).toEqual([
					expect.objectContaining({
						id: 'project-alpha',
						name: 'Alpha',
						sourceProjectId: 'project-alpha',
						taskCount: 2,
						openTaskCount: 2,
						overdueTaskCount: 1,
						dueSoonTaskCount: 1,
						updatedAt: '2026-04-14T12:00:00.000Z',
					}),
					expect.objectContaining({
						id: 'project-beta',
						name: 'Beta',
						sourceProjectId: 'project-beta',
						taskCount: 1,
						openTaskCount: 0,
						overdueTaskCount: 0,
						dueSoonTaskCount: 0,
						updatedAt: '2026-04-14T12:00:00.000Z',
					}),
				]);
			});
	});

	it('filters overview and project list to projects with more than one upstream column', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-04-14T12:00:00.000Z'));

		upstreamClientMock.getProjects.mockResolvedValue([
			{ id: 'project-zero', name: 'Zero' },
			{ id: 'project-one', name: 'One' },
			{ id: 'project-two', name: 'Two' },
		]);

		upstreamClientMock.getProject.mockImplementation(async (projectId: string) => {
			if (projectId === 'project-zero') {
				return {
					project: { id: 'project-zero', name: 'Zero' },
					tasks: [
						{
							id: 'task-0',
							projectId: 'project-zero',
							title: 'Zero task',
							status: 0,
						},
					],
					columns: [],
				};
			}

			if (projectId === 'project-one') {
				return {
					project: { id: 'project-one', name: 'One' },
					tasks: [
						{
							id: 'task-1',
							projectId: 'project-one',
							title: 'One task',
							columnId: 'one-backlog',
							status: 0,
						},
					],
					columns: [{ id: 'one-backlog', projectId: 'project-one', name: 'Backlog' }],
				};
			}

			return {
				project: { id: 'project-two', name: 'Two' },
				tasks: [
					{
						id: 'task-2',
						projectId: 'project-two',
						title: 'Two task',
						columnId: 'two-doing',
						status: 0,
					},
				],
				columns: [
					{ id: 'two-backlog', projectId: 'project-two', name: 'Backlog' },
					{ id: 'two-doing', projectId: 'project-two', name: 'Doing' },
				],
			};
		});

		await request(app.getHttpServer())
			.get('/ops/todos/overview')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.projects).toEqual([
					expect.objectContaining({
						id: 'project-two',
						name: 'Two',
					}),
				]);
				expect(body.normalizedBoard.totalTaskCount).toBe(1);
			});

		await request(app.getHttpServer())
			.get('/ops/todos/projects')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.projects).toEqual([
					expect.objectContaining({
						id: 'project-two',
						name: 'Two',
					}),
				]);
			});
	});

	it('excludes projects with non-standard lanes from the workspace normalized board only', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-04-14T12:00:00.000Z'));

		upstreamClientMock.getProjects.mockResolvedValue([
			{ id: 'project-home', name: 'Home' },
			{ id: 'project-todo', name: 'Todo' },
		]);

		upstreamClientMock.getProject.mockImplementation(async (projectId: string) => {
			if (projectId === 'project-home') {
				return {
					project: { id: 'project-home', name: 'Home' },
					tasks: [
						{
							id: 'task-home-1',
							projectId: 'project-home',
							title: 'Custom backlog lane task',
							columnId: 'col-indian',
							status: 0,
						},
						{
							id: 'task-home-2',
							projectId: 'project-home',
							title: 'Custom done lane task',
							columnId: 'col-priority',
							status: 0,
						},
					],
					columns: [
						{ id: 'col-indian', projectId: 'project-home', name: 'Indian' },
						{ id: 'col-priority', projectId: 'project-home', name: 'Not Priority' },
					],
				};
			}

			return {
				project: { id: 'project-todo', name: 'Todo' },
				tasks: [
					{
						id: 'task-todo-1',
						projectId: 'project-todo',
						title: 'Todo backlog task',
						columnId: 'col-backlog',
						status: 0,
					},
					{
						id: 'task-todo-2',
						projectId: 'project-todo',
						title: 'Todo in progress task',
						columnId: 'col-doing',
						status: 0,
					},
					{
						id: 'task-todo-3',
						projectId: 'project-todo',
						title: 'Todo done task',
						columnId: 'col-done',
						status: 0,
					},
				],
				columns: [
					{ id: 'col-backlog', projectId: 'project-todo', name: 'Backlog' },
					{ id: 'col-doing', projectId: 'project-todo', name: 'In Progress' },
					{ id: 'col-done', projectId: 'project-todo', name: 'Done' },
				],
			};
		});

		await request(app.getHttpServer())
			.get('/ops/todos/overview')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.projects).toEqual([expect.objectContaining({ id: 'project-home', name: 'Home' }), expect.objectContaining({ id: 'project-todo', name: 'Todo' })]);
				expect(body.normalizedBoard).toEqual({
					columns: [
						expect.objectContaining({
							id: 'backlog',
							label: 'Backlog',
							taskCount: 1,
							tasks: [expect.objectContaining({ todoId: 'task-todo-1' })],
						}),
						expect.objectContaining({
							id: 'in_progress',
							label: 'In Progress',
							taskCount: 1,
							tasks: [expect.objectContaining({ todoId: 'task-todo-2' })],
						}),
						expect.objectContaining({
							id: 'blocked',
							label: 'Blocked',
							taskCount: 0,
							tasks: [],
						}),
						expect.objectContaining({
							id: 'done',
							label: 'Done',
							taskCount: 1,
							tasks: [expect.objectContaining({ todoId: 'task-todo-3' })],
						}),
					],
					totalTaskCount: 3,
				});
			});
	});

	it('returns 503 when upstream project discovery fails', async () => {
		upstreamClientMock.getProjects.mockRejectedValue(new Error('upstream unavailable'));

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when upstream project payloads are malformed', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: null,
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when discovered project detail lookup returns upstream 404', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockRejectedValue({
			response: { status: 404 },
		});

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when upstream project list entries are malformed', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha' }]);

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when upstream project objects are malformed', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha' },
			tasks: [],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when upstream project identifiers are blank', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: '   ', name: 'Alpha' }]);

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when upstream task payloads are malformed', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 123,
					projectId: 'project-alpha',
					title: 'Ship todos',
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when upstream task statuses are malformed', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Ship todos',
					status: '2',
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when upstream tasks belong to a different project', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-beta',
					title: 'Ship todos',
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when upstream project detail ids do not match the discovered project', async () => {
		upstreamClientMock.getProjects.mockResolvedValue([{ id: 'project-alpha', name: 'Alpha' }]);
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-beta', name: 'Beta' },
			tasks: [],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/overview').set('apikey', 'test-key').expect(503);
	});

	it('shapes the project detail route from upstream project data', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-04-14T12:00:00.000Z'));

		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Backlog overdue task',
					category: 'Backlog',
					localTodoId: 601,
					dueDate: '2026-04-10T09:00:00.000Z',
					status: 0,
				},
				{
					id: 'task-2',
					projectId: 'project-alpha',
					title: 'In progress task',
					category: 'Now',
					dueDate: '2026-04-16T09:00:00.000Z',
					status: 0,
				},
				{
					id: 'task-3',
					projectId: 'project-alpha',
					title: 'Blocked task',
					category: 'Blocked',
					status: 0,
				},
				{
					id: 'task-4',
					projectId: 'project-alpha',
					title: 'Done task',
					category: 'Done',
					completedTime: '2026-04-13T09:00:00.000Z',
					status: 2,
				},
				{
					id: 'task-5',
					projectId: 'project-alpha',
					title: 'Unknown source category still maps to backlog',
					category: 'Archived',
					dueDate: '2026-04-17T09:00:00.000Z',
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer())
			.get('/ops/todos/projects/project-alpha')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.project).toEqual(
					expect.objectContaining({
						id: 'project-alpha',
						name: 'Alpha',
						sourceProjectId: 'project-alpha',
						taskCount: 5,
						openTaskCount: 4,
						overdueTaskCount: 1,
						dueSoonTaskCount: 2,
						updatedAt: '2026-04-14T12:00:00.000Z',
					}),
				);
				expect(body.projectBoard.columns).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							sourceCategory: 'Backlog',
							normalizedColumnId: 'backlog',
							normalizedColumnLabel: 'Backlog',
							taskCount: 1,
							taskIds: ['task-1'],
						}),
						expect.objectContaining({
							sourceCategory: 'Now',
							normalizedColumnId: 'in_progress',
							normalizedColumnLabel: 'In Progress',
							taskCount: 1,
							taskIds: ['task-2'],
						}),
						expect.objectContaining({
							sourceCategory: 'Blocked',
							normalizedColumnId: 'blocked',
							normalizedColumnLabel: 'Blocked',
							taskCount: 1,
							taskIds: ['task-3'],
						}),
						expect.objectContaining({
							sourceCategory: 'Archived',
							normalizedColumnId: 'backlog',
							normalizedColumnLabel: 'Backlog',
							taskCount: 1,
							taskIds: ['task-5'],
						}),
					]),
				);
				expect(body.projectBoard.totalTaskCount).toBe(4);
				expect(body.normalizedBoard).toEqual({
					columns: [
						expect.objectContaining({
							id: 'backlog',
							label: 'Backlog',
							taskCount: 2,
							tasks: expect.arrayContaining([expect.objectContaining({ todoId: 'task-1' }), expect.objectContaining({ todoId: 'task-5' })]),
						}),
						expect.objectContaining({
							id: 'in_progress',
							label: 'In Progress',
							taskCount: 1,
							tasks: [expect.objectContaining({ todoId: 'task-2' })],
						}),
						expect.objectContaining({
							id: 'blocked',
							label: 'Blocked',
							taskCount: 1,
							tasks: [expect.objectContaining({ todoId: 'task-3' })],
						}),
						expect.objectContaining({
							id: 'done',
							label: 'Done',
							taskCount: 0,
							tasks: [],
						}),
					],
					totalTaskCount: 4,
				});
				expect(body.tasks).toHaveLength(4);
				expect(body.tasks).toEqual(expect.not.arrayContaining([expect.objectContaining({ todoId: 'task-4' })]));
				expect(body.tasks).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							id: 'project-alpha:task-1',
							todoId: 'task-1',
							taskId: '601',
							title: 'Backlog overdue task',
							projectId: 'project-alpha',
							projectName: 'Alpha',
							columnId: 'backlog',
							completed: false,
							dueDate: '2026-04-10T09:00:00.000Z',
						}),
						expect.objectContaining({
							id: 'project-alpha:task-5',
							todoId: 'task-5',
							taskId: null,
							title: 'Unknown source category still maps to backlog',
							projectId: 'project-alpha',
							projectName: 'Alpha',
							columnId: 'backlog',
							sourceCategory: 'Archived',
							completed: false,
							dueDate: '2026-04-17T09:00:00.000Z',
						}),
					]),
				);
			});
	});

	it('returns 503 when the project detail payload is malformed', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: null,
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/projects/project-alpha').set('apikey', 'test-key').expect(503);
	});

	it('returns 404 when the upstream project detail is not found', async () => {
		upstreamClientMock.getProject.mockRejectedValue({
			response: { status: 404 },
		});

		await request(app.getHttpServer()).get('/ops/todos/projects/project-alpha').set('apikey', 'test-key').expect(404);
	});

	it('returns 503 when a project detail task status is malformed', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Ship todos',
					status: '2',
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/projects/project-alpha').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when a project detail task localTodoId is malformed', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Ship todos',
					localTodoId: 0,
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/projects/project-alpha').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when project detail localTodoIds collide', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Ship todos',
					localTodoId: 777,
					status: 0,
				},
				{
					id: 'task-2',
					projectId: 'project-alpha',
					title: 'Ship more todos',
					localTodoId: 777,
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/projects/project-alpha').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when a project detail localTodoId is negative', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Ship todos',
					localTodoId: -1,
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/projects/project-alpha').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when a project detail localTodoId is not an integer', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Ship todos',
					localTodoId: 12.5,
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/projects/project-alpha').set('apikey', 'test-key').expect(503);
	});

	it('returns 503 when a project detail task belongs to a different project', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-beta',
					title: 'Ship todos',
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer()).get('/ops/todos/projects/project-alpha').set('apikey', 'test-key').expect(503);
	});

	it('succeeds when project detail omits columns', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Ship todos',
					category: 'Backlog',
					status: 0,
				},
			],
		});

		await request(app.getHttpServer())
			.get('/ops/todos/projects/project-alpha')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.project).toEqual(
					expect.objectContaining({
						id: 'project-alpha',
						taskCount: 1,
						openTaskCount: 1,
					}),
				);
				expect(body.tasks).toHaveLength(1);
			});
	});

	it('returns only completed tasks from the completed tasks route', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Open task',
					columnId: 'col-backlog',
					status: 0,
				},
				{
					id: 'task-2',
					projectId: 'project-alpha',
					title: 'Completed task',
					columnId: 'col-done',
					completedTime: '2026-04-14T08:00:00.000Z',
					status: 2,
				},
			],
			columns: [
				{ id: 'col-backlog', projectId: 'project-alpha', name: 'Backlog' },
				{ id: 'col-done', projectId: 'project-alpha', name: 'Done' },
			],
		});

		await request(app.getHttpServer())
			.get('/ops/todos/projects/project-alpha/completed')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.tasks).toEqual([
					expect.objectContaining({
						todoId: 'task-2',
						title: 'Completed task',
						completed: true,
						columnId: 'done',
					}),
				]);
			});
	});

	it('excludes completed tasks from the default project detail payload', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Open task',
					columnId: 'col-backlog',
					status: 0,
				},
				{
					id: 'task-2',
					projectId: 'project-alpha',
					title: 'Completed task',
					columnId: 'col-done',
					completedTime: '2026-04-14T08:00:00.000Z',
					status: 2,
				},
			],
			columns: [
				{ id: 'col-backlog', projectId: 'project-alpha', name: 'Backlog' },
				{ id: 'col-done', projectId: 'project-alpha', name: 'Done' },
			],
		});

		await request(app.getHttpServer())
			.get('/ops/todos/projects/project-alpha')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.tasks).toEqual([
					expect.objectContaining({
						todoId: 'task-1',
						title: 'Open task',
						completed: false,
						columnId: 'backlog',
					}),
				]);
				expect(body.project).toEqual(
					expect.objectContaining({
						id: 'project-alpha',
						taskCount: 2,
						openTaskCount: 1,
					}),
				);
				expect(body.projectBoard.columns).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							sourceCategory: 'Backlog',
							taskCount: 1,
						}),
						expect.objectContaining({
							sourceCategory: 'Done',
							taskCount: 0,
						}),
					]),
				);
			});
	});

	it('falls back to columnId when project detail category is blank', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Blocked by lane',
					category: '   ',
					columnId: 'Blocked',
					status: 0,
				},
			],
			columns: [],
		});

		await request(app.getHttpServer())
			.get('/ops/todos/projects/project-alpha')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.projectBoard.columns).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							sourceCategory: 'Blocked',
							normalizedColumnId: 'blocked',
							taskCount: 1,
							taskIds: ['task-1'],
						}),
					]),
				);
				expect(body.tasks).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							todoId: 'task-1',
							sourceCategory: 'Blocked',
							columnId: 'blocked',
						}),
					]),
				);
			});
	});

	it('uses upstream column metadata to resolve lane names and keep empty lanes in project detail', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'First backlog task',
					columnId: 'col-backlog',
					status: 0,
				},
				{
					id: 'task-2',
					projectId: 'project-alpha',
					title: 'Second backlog task',
					columnId: 'col-backlog',
					status: 0,
				},
			],
			columns: [
				{ id: 'col-doing', projectId: 'project-alpha', name: 'Doing' },
				{ id: 'col-done', projectId: 'project-alpha', name: 'Done' },
				{ id: 'col-backlog', projectId: 'project-alpha', name: 'Backlog' },
			],
		});

		await request(app.getHttpServer())
			.get('/ops/todos/projects/project-alpha')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.projectBoard.columns).toEqual([
					expect.objectContaining({
						sourceCategoryId: 'project-alpha:col-doing',
						sourceCategory: 'Doing',
						normalizedColumnId: 'in_progress',
						taskCount: 0,
						taskIds: [],
					}),
					expect.objectContaining({
						sourceCategoryId: 'project-alpha:col-done',
						sourceCategory: 'Done',
						normalizedColumnId: 'done',
						taskCount: 0,
						taskIds: [],
					}),
					expect.objectContaining({
						sourceCategoryId: 'project-alpha:col-backlog',
						sourceCategory: 'Backlog',
						normalizedColumnId: 'backlog',
						taskCount: 2,
						taskIds: ['task-1', 'task-2'],
					}),
				]);
				expect(body.tasks).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							todoId: 'task-1',
							sourceCategoryId: 'project-alpha:col-backlog',
							sourceCategory: 'Backlog',
							columnId: 'backlog',
						}),
					]),
				);
			});
	});

	it('prefers upstream column ids over category text when both are present', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Created backlog task',
					category: 'Backlog',
					columnId: 'col-backlog',
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
			.get('/ops/todos/projects/project-alpha')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.projectBoard.columns).toEqual([
					expect.objectContaining({
						sourceCategoryId: 'project-alpha:col-backlog',
						sourceCategory: 'Backlog',
						normalizedColumnId: 'backlog',
						taskCount: 1,
						taskIds: ['task-1'],
					}),
					expect.objectContaining({
						sourceCategoryId: 'project-alpha:col-doing',
						sourceCategory: 'Doing',
						normalizedColumnId: 'in_progress',
						taskCount: 0,
						taskIds: [],
					}),
				]);
				expect(body.tasks).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							todoId: 'task-1',
							sourceCategoryId: 'project-alpha:col-backlog',
							sourceCategory: 'Backlog',
							columnId: 'backlog',
						}),
					]),
				);
			});
	});

	it('maps category-only tasks into the matching upstream column when the column name is unique', async () => {
		upstreamClientMock.getProject.mockResolvedValue({
			project: { id: 'project-alpha', name: 'Alpha' },
			tasks: [
				{
					id: 'task-1',
					projectId: 'project-alpha',
					title: 'Legacy backlog task',
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
			.get('/ops/todos/projects/project-alpha')
			.set('apikey', 'test-key')
			.expect(200)
			.expect(({ body }) => {
				expect(body.projectBoard.columns).toEqual([
					expect.objectContaining({
						sourceCategoryId: 'project-alpha:col-backlog',
						sourceCategory: 'Backlog',
						normalizedColumnId: 'backlog',
						taskCount: 1,
						taskIds: ['task-1'],
					}),
					expect.objectContaining({
						sourceCategoryId: 'project-alpha:col-doing',
						sourceCategory: 'Doing',
						normalizedColumnId: 'in_progress',
						taskCount: 0,
						taskIds: [],
					}),
				]);
				expect(body.tasks).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							todoId: 'task-1',
							sourceCategoryId: 'project-alpha:col-backlog',
							sourceCategory: 'Backlog',
							columnId: 'backlog',
						}),
					]),
				);
			});
	});
});
