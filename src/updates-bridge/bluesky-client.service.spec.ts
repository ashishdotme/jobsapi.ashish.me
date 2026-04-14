import axios from 'axios';
import { BlueskyClientService } from './bluesky-client.service';

jest.mock('axios');

describe('BlueskyClientService', () => {
	const mockedAxios = axios as jest.Mocked<typeof axios>;
	let service: BlueskyClientService;
	let configService: { get: jest.Mock };

	beforeEach(() => {
		configService = {
			get: jest.fn((key: string) => {
				if (key === 'BLUESKY_HANDLE') {
					return 'ashish.bsky.social';
				}
				if (key === 'BLUESKY_APP_PASSWORD') {
					return 'app-password';
				}
				return undefined;
			}),
		};
		service = new BlueskyClientService(configService as any);
	});

	afterEach(() => {
		mockedAxios.post.mockReset();
		mockedAxios.get.mockReset();
	});

	it('creates a session and publishes a text post', async () => {
		mockedAxios.post
			.mockResolvedValueOnce({
				data: { did: 'did:plc:test', accessJwt: 'jwt-1' },
			} as any)
			.mockResolvedValueOnce({
				data: { uri: 'at://did:plc:test/app.bsky.feed.post/123' },
			} as any);

		const result = await service.publish({
			text: 'hello world',
			mediaUrls: [],
		});

		expect(result).toEqual({
			uri: 'at://did:plc:test/app.bsky.feed.post/123',
		});
	});
});
