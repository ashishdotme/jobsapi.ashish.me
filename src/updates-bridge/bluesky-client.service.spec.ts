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

		const createRecordPayload = mockedAxios.post.mock.calls[1][1] as any;
		expect(createRecordPayload.record.embed).toBeUndefined();
	});

	it('uploads images and attaches embed when mediaUrls provided', async () => {
		const fakeBlob = { $type: 'blob', ref: { $link: 'bafk...' }, mimeType: 'image/jpeg', size: 1024 };

		mockedAxios.post
			.mockResolvedValueOnce({
				data: { did: 'did:plc:test', accessJwt: 'jwt-1' },
			} as any)
			.mockResolvedValueOnce({
				data: { blob: fakeBlob },
			} as any)
			.mockResolvedValueOnce({
				data: { uri: 'at://did:plc:test/app.bsky.feed.post/456' },
			} as any);

		mockedAxios.get.mockResolvedValueOnce({
			data: Buffer.from('fake-image'),
			headers: { 'content-type': 'image/jpeg' },
		} as any);

		const result = await service.publish({
			text: 'post with image',
			mediaUrls: ['https://example.com/photo.jpg'],
		});

		expect(result).toEqual({
			uri: 'at://did:plc:test/app.bsky.feed.post/456',
		});

		expect(mockedAxios.get).toHaveBeenCalledWith('https://example.com/photo.jpg', { responseType: 'arraybuffer' });

		const uploadCall = mockedAxios.post.mock.calls[1];
		expect(uploadCall[0]).toBe('https://bsky.social/xrpc/com.atproto.repo.uploadBlob');

		const createRecordPayload = mockedAxios.post.mock.calls[2][1] as any;
		expect(createRecordPayload.record.embed).toEqual({
			$type: 'app.bsky.embed.images',
			images: [{ alt: '', image: fakeBlob }],
		});
	});
});
