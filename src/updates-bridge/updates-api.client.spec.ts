import axios from 'axios';
import { UpdatesApiClient } from './updates-api.client';

jest.mock('axios');

describe('UpdatesApiClient', () => {
	const mockedAxios = axios as jest.Mocked<typeof axios>;
	let client: UpdatesApiClient;
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
		client = new UpdatesApiClient(configService as any);
	});

	afterEach(() => {
		mockedAxios.post.mockReset();
	});

	it('posts source-aware updates to api.ashish.me', async () => {
		mockedAxios.post.mockResolvedValue({
			status: 201,
			data: { id: 42, created: true },
		} as any);

		const result = await client.createOrUpdateUpdate({
			category: 'threads',
			title: 'Threads post',
			content: 'hello',
			date: '2026-04-13T10:00:00.000Z',
			source: 'threads',
			sourceId: '1799',
			sourcePostType: 'post',
			referencedSourceId: null,
			referencedSourceUrl: null,
			sourceUrl: 'https://threads.net/post/1',
			mediaUrls: [],
			bridgePublisher: 'jobsapi.ashish.me',
			blueskyUri: null,
		});

		expect(result).toEqual({
			id: '42',
			created: true,
		});
		expect(mockedAxios.post).toHaveBeenCalledWith(
			'https://api.ashish.me/updates',
			expect.objectContaining({
				source: 'threads',
				sourceId: '1799',
			}),
			expect.objectContaining({
				headers: { apiKey: 'api-token' },
			}),
		);
	});
});
