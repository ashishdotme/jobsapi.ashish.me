import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { TodosUpstreamClient } from './todos-upstream.client';

jest.mock('axios');

describe('TodosUpstreamClient', () => {
	const mockedAxios = axios as jest.Mocked<typeof axios>;
	let client: TodosUpstreamClient;
	let configService: { get: jest.Mock };

	beforeEach(() => {
		configService = {
			get: jest.fn((key: string) => {
				if (key === 'ASHISHDOTME_TOKEN') {
					return 'api-token';
				}
				return undefined;
			}),
		};
		client = new TodosUpstreamClient(configService as unknown as ConfigService);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		mockedAxios.get.mockReset();
		mockedAxios.post.mockReset();
		mockedAxios.patch.mockReset();
	});

	it('fetches the project list from api.ashish.me', async () => {
		mockedAxios.get.mockResolvedValue({
			data: [{ id: 'project-1', name: 'jobsapi.ashish.me' }],
		} as any);

		await expect(client.getProjects()).resolves.toEqual([{ id: 'project-1', name: 'jobsapi.ashish.me' }]);

		expect(mockedAxios.get).toHaveBeenCalledWith('https://api.ashish.me/todos/projects', {
			headers: { apiKey: 'api-token' },
		});
	});

	it('uses the first configured API key when multiple keys are configured', async () => {
		configService.get.mockImplementation((key: string) => {
			if (key === 'ASHISHDOTME_TOKEN') {
				return 'first-key, second-key';
			}
			return undefined;
		});
		client = new TodosUpstreamClient(configService as unknown as ConfigService);
		mockedAxios.get.mockResolvedValue({
			data: [],
		} as any);

		await expect(client.getProjects()).resolves.toEqual([]);

		expect(mockedAxios.get).toHaveBeenCalledWith('https://api.ashish.me/todos/projects', {
			headers: { apiKey: 'first-key' },
		});
	});

	it('uses a configured todos API base URL override when provided', async () => {
		configService.get.mockImplementation((key: string) => {
			if (key === 'ASHISHDOTME_TOKEN') {
				return 'api-token';
			}
			if (key === 'TODOS_API_BASE_URL') {
				return 'http://127.0.0.1:3001/todos/';
			}
			return undefined;
		});
		client = new TodosUpstreamClient(configService as unknown as ConfigService);
		mockedAxios.get.mockResolvedValue({
			data: [],
		} as any);

		await expect(client.getProjects()).resolves.toEqual([]);

		expect(mockedAxios.get).toHaveBeenCalledWith('http://127.0.0.1:3001/todos/projects', {
			headers: { apiKey: 'api-token' },
		});
	});

	it('fetches one project detail from api.ashish.me', async () => {
		mockedAxios.get.mockResolvedValue({
			data: {
				project: { id: 'project-1', name: 'jobsapi.ashish.me' },
				tasks: [{ id: 'tick-1', projectId: 'project-1', title: 'Ship todos' }],
				columns: [{ id: 'col-1', projectId: 'project-1', name: 'Now' }],
			},
		} as any);

		await expect(client.getProject('project-1')).resolves.toEqual({
			project: { id: 'project-1', name: 'jobsapi.ashish.me' },
			tasks: [{ id: 'tick-1', projectId: 'project-1', title: 'Ship todos' }],
			columns: [{ id: 'col-1', projectId: 'project-1', name: 'Now' }],
		});

		expect(mockedAxios.get).toHaveBeenCalledWith('https://api.ashish.me/todos/projects/project-1', {
			headers: { apiKey: 'api-token' },
		});
	});

	it('creates a task through api.ashish.me', async () => {
		mockedAxios.post.mockResolvedValue({
			data: { id: 1, content: 'Ship todos workspace', todoId: 'tick-1' },
		} as any);

		await expect(
			client.createTask({
				content: 'Ship todos workspace',
				projectId: 'project-1',
				category: 'Backlog',
				dueDate: '2026-04-20T09:00:00.000Z',
				todoId: 'tick-1',
			}),
		).resolves.toEqual({
			id: 1,
			content: 'Ship todos workspace',
			todoId: 'tick-1',
		});

		expect(mockedAxios.post).toHaveBeenCalledWith(
			'https://api.ashish.me/todos',
			{
				projectId: 'project-1',
				content: 'Ship todos workspace',
				category: 'Backlog',
				dueDate: '2026-04-20T09:00:00.000Z',
				todoId: 'tick-1',
			},
			{ headers: { apiKey: 'api-token' } },
		);
	});

	it('updates a task through api.ashish.me', async () => {
		mockedAxios.patch.mockResolvedValue({
			data: { id: 1, content: 'Ship todos workspace' },
		} as any);

		await expect(
			client.updateTask('1', {
				content: 'Ship todos workspace',
				dueDate: null,
			}),
		).resolves.toEqual({ id: 1, content: 'Ship todos workspace' });

		expect(mockedAxios.patch).toHaveBeenCalledWith(
			'https://api.ashish.me/todos/1/dashboard',
			{
				content: 'Ship todos workspace',
				dueDate: null,
			},
			{ headers: { apiKey: 'api-token' } },
		);
	});

	it('moves a task through api.ashish.me', async () => {
		mockedAxios.post.mockResolvedValue({
			data: undefined,
		} as any);

		await expect(
			client.moveTask('1', {
				projectId: 'project-2',
				category: 'Blocked',
			}),
		).resolves.toBeUndefined();

		expect(mockedAxios.post).toHaveBeenCalledWith(
			'https://api.ashish.me/todos/1/move',
			{
				projectId: 'project-2',
				category: 'Blocked',
			},
			{ headers: { apiKey: 'api-token' } },
		);
	});

	it('completes a task through api.ashish.me', async () => {
		mockedAxios.post.mockResolvedValue({
			data: undefined,
		} as any);

		await expect(client.completeTask('1', 'tick-1')).resolves.toBeUndefined();

		expect(mockedAxios.post).toHaveBeenCalledWith('https://api.ashish.me/todos/1/completed/tick-1', null, { headers: { apiKey: 'api-token' } });
	});

	it('falls back to the local-only completion route when no upstream todo id exists', async () => {
		mockedAxios.post.mockResolvedValue({
			data: undefined,
		} as any);

		await expect(client.completeTask('1')).resolves.toBeUndefined();

		expect(mockedAxios.post).toHaveBeenCalledWith('https://api.ashish.me/todos/1/completed', null, { headers: { apiKey: 'api-token' } });
	});
});
