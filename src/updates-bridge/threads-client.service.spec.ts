import axios from 'axios';
import { ThreadsClientService } from './threads-client.service';

jest.mock('axios');

describe('ThreadsClientService', () => {
	const mockedAxios = axios as jest.Mocked<typeof axios>;
	let service: ThreadsClientService;
	let configService: { get: jest.Mock };

	beforeEach(() => {
		configService = {
			get: jest.fn((key: string) => {
				if (key === 'THREADS_APP_ID') {
					return 'app-id';
				}
				if (key === 'THREADS_APP_SECRET') {
					return 'app-secret';
				}
				return undefined;
			}),
		};
		service = new ThreadsClientService(configService as any);
	});

	afterEach(() => {
		mockedAxios.get.mockReset();
		mockedAxios.post.mockReset();
	});

	it('builds the threads authorization url', () => {
		const url = service.buildAuthorizationUrl({
			state: 'state-1',
			redirectUri: 'https://jobsapi.ashish.me/auth/threads/callback',
		});

		expect(url).toContain('client_id=app-id');
		expect(url).toContain('state=state-1');
		expect(url).toContain('redirect_uri=https%3A%2F%2Fjobsapi.ashish.me%2Fauth%2Fthreads%2Fcallback');
	});

	it('exchanges the code and normalizes identity fetches', async () => {
		mockedAxios.post.mockResolvedValue({
			data: { access_token: 'short-lived', user_id: '123' },
		} as any);
		mockedAxios.get.mockResolvedValueOnce({
			data: { access_token: 'long-lived', expires_in: 1000 },
		} as any).mockResolvedValueOnce({
			data: { id: '123', username: 'ashish' },
		} as any);

		const shortLived = await service.exchangeCodeForToken({
			code: 'code-1',
			redirectUri: 'https://jobsapi.ashish.me/auth/threads/callback',
		});
		const longLived = await service.exchangeForLongLivedToken({
			shortLivedToken: shortLived.accessToken,
		});
		const identity = await service.fetchIdentity(longLived.accessToken);

		expect(shortLived).toEqual({
			accessToken: 'short-lived',
			userId: '123',
		});
		expect(longLived).toEqual({
			accessToken: 'long-lived',
			expiresIn: 1000,
		});
		expect(identity).toEqual({
			id: '123',
			username: 'ashish',
		});
	});

	it('normalizes repost and quote posts', () => {
		const repost = service.normalizePost({
			id: '1',
			text: '',
			permalink: 'https://threads.net/post/1',
			timestamp: '2026-04-13T10:00:00.000Z',
			referenced_repost: { id: 'r1', permalink: 'https://threads.net/post/r1' },
		});
		const quote = service.normalizePost({
			id: '2',
			text: 'quoted',
			permalink: 'https://threads.net/post/2',
			timestamp: '2026-04-13T11:00:00.000Z',
			referenced_quote: { id: 'q1', permalink: 'https://threads.net/post/q1' },
		});

		expect(repost).toEqual(
			expect.objectContaining({
				sourcePostType: 'repost',
				referencedSourceId: 'r1',
			}),
		);
		expect(quote).toEqual(
			expect.objectContaining({
				sourcePostType: 'quote',
				referencedSourceUrl: 'https://threads.net/post/q1',
			}),
		);
	});
});
