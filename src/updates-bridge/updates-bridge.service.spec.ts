import { UpdatesBridgeService } from './updates-bridge.service';
import type { ThreadsBridgePost } from './types';

describe('UpdatesBridgeService', () => {
	let service: UpdatesBridgeService;
	let repository: {
		getActiveIntegration: jest.Mock;
		saveIntegration: jest.Mock;
		getCheckpoint: jest.Mock;
		saveCheckpoint: jest.Mock;
		upsertPost: jest.Mock;
		listDeliverablePosts: jest.Mock;
		listRecentPosts: jest.Mock;
		getPostMetrics: jest.Mock;
		markApiDelivered: jest.Mock;
		markBlueskyDelivered: jest.Mock;
		markDeliveryFailure: jest.Mock;
		retryFailedDeliveries: jest.Mock;
	};
	let threadsClient: {
		refreshAccessToken: jest.Mock;
		fetchPostsSince: jest.Mock;
	};
	let blueskyClient: { publish: jest.Mock };
	let updatesApiClient: { createOrUpdateUpdate: jest.Mock };
	let configService: { get: jest.Mock };

	beforeEach(() => {
		repository = {
			getActiveIntegration: jest.fn(),
			saveIntegration: jest.fn(),
			getCheckpoint: jest.fn(),
			saveCheckpoint: jest.fn(),
			upsertPost: jest.fn(),
			listDeliverablePosts: jest.fn(),
			listRecentPosts: jest.fn(),
			getPostMetrics: jest.fn(),
			markApiDelivered: jest.fn(),
			markBlueskyDelivered: jest.fn(),
			markDeliveryFailure: jest.fn(),
			retryFailedDeliveries: jest.fn(),
		};
		threadsClient = {
			refreshAccessToken: jest.fn(),
			fetchPostsSince: jest.fn(),
		};
		blueskyClient = { publish: jest.fn() };
		updatesApiClient = { createOrUpdateUpdate: jest.fn() };
		configService = {
			get: jest.fn((key: string) => {
				if (key === 'THREADS_BOOTSTRAP_SINCE') {
					return '2026-04-13T00:00:00.000Z';
				}
				return undefined;
			}),
		};

		service = new UpdatesBridgeService(
			repository as any,
			threadsClient as any,
			blueskyClient as any,
			updatesApiClient as any,
			configService as any,
		);
	});

	const createPendingPost = (
		overrides: Partial<ThreadsBridgePost> = {},
	): ThreadsBridgePost => ({
		id: 'row-1',
		sourcePlatform: 'threads',
		sourcePostId: 'post-1',
		sourcePostType: 'post',
		sourceUrl: 'https://threads.net/post/1',
		sourcePublishedAt: '2026-04-13T10:00:00.000Z',
		title: 'Threads post',
		content: 'Hello world',
		mediaUrls: [],
		referencedSourceId: null,
		referencedSourceUrl: null,
		sourcePayload: { id: 'post-1' },
		apiUpdateId: null,
		apiStatus: 'pending',
		blueskyUri: null,
		blueskyStatus: 'pending',
		attemptCount: 0,
		nextAttemptAt: null,
		lastError: null,
		lastAttemptedAt: null,
		createdAt: '2026-04-13T10:00:00.000Z',
		updatedAt: '2026-04-13T10:00:00.000Z',
		...overrides,
	});

	it('skips the cycle when no active integration exists', async () => {
		repository.getActiveIntegration.mockResolvedValue(null);

		await service.runScheduledSync();

		expect(threadsClient.fetchPostsSince).not.toHaveBeenCalled();
	});

	it('uses THREADS_BOOTSTRAP_SINCE when no checkpoint exists', async () => {
		repository.getActiveIntegration.mockResolvedValue({
			threadsUserId: '123',
			threadsUsername: 'ashish',
			accessToken: 'token-1',
			accessTokenExpiresAt: '2026-06-01T00:00:00.000Z',
		});
		repository.getCheckpoint.mockResolvedValue(null);
		threadsClient.fetchPostsSince.mockResolvedValue([]);
		repository.listDeliverablePosts.mockResolvedValue([]);

		await service.runScheduledSync();

		expect(threadsClient.fetchPostsSince).toHaveBeenCalledWith({
			accessToken: 'token-1',
			userId: '123',
			since: '2026-04-13T00:00:00.000Z',
		});
	});

	it('writes the canonical update before publishing to bluesky and patches blueskyUri after publish', async () => {
		repository.getActiveIntegration.mockResolvedValue({
			threadsUserId: '123',
			threadsUsername: 'ashish',
			accessToken: 'token-1',
			accessTokenExpiresAt: '2026-06-01T00:00:00.000Z',
		});
		repository.getCheckpoint.mockResolvedValue({
			sourcePlatform: 'threads',
			lastCheckedAt: '2026-04-13T09:00:00.000Z',
			lastSeenPostId: 'old-post',
			lastCursor: null,
		});
		threadsClient.fetchPostsSince.mockResolvedValue([]);
		repository.listDeliverablePosts.mockResolvedValue([createPendingPost()]);
		updatesApiClient.createOrUpdateUpdate
			.mockResolvedValueOnce({ id: '42', created: true })
			.mockResolvedValueOnce({ id: '42', created: false });
		blueskyClient.publish.mockResolvedValue({
			uri: 'at://did:plc:test/app.bsky.feed.post/123',
		});

		await service.runScheduledSync();

		expect(updatesApiClient.createOrUpdateUpdate).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ blueskyUri: null }),
		);
		expect(blueskyClient.publish).toHaveBeenCalled();
		expect(updatesApiClient.createOrUpdateUpdate).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				blueskyUri: 'at://did:plc:test/app.bsky.feed.post/123',
			}),
		);
		expect(repository.markApiDelivered).toHaveBeenCalledWith('row-1', '42');
		expect(repository.markBlueskyDelivered).toHaveBeenCalledWith(
			'row-1',
			'at://did:plc:test/app.bsky.feed.post/123',
		);
	});

	it('marks permanent failure after the tenth failed attempt', async () => {
		repository.getActiveIntegration.mockResolvedValue({
			threadsUserId: '123',
			threadsUsername: 'ashish',
			accessToken: 'token-1',
			accessTokenExpiresAt: '2026-06-01T00:00:00.000Z',
		});
		repository.getCheckpoint.mockResolvedValue(null);
		threadsClient.fetchPostsSince.mockResolvedValue([]);
		repository.listDeliverablePosts.mockResolvedValue([
			createPendingPost({ attemptCount: 9 }),
		]);
		updatesApiClient.createOrUpdateUpdate.mockRejectedValue(
			new Error('temporary failure'),
		);

		await service.runScheduledSync();

		expect(repository.markDeliveryFailure).toHaveBeenCalledWith(
			'row-1',
			'temporary failure',
			expect.objectContaining({
				permanent: true,
				nextAttemptAt: null,
			}),
		);
	});

	it('skips overlapping runs', async () => {
		(service as any).processing = true;

		await service.runScheduledSync();

		expect(threadsClient.fetchPostsSince).not.toHaveBeenCalled();
	});

	it('builds dashboard overview data for the updates page', async () => {
		repository.getActiveIntegration.mockResolvedValue({
			id: 'integration-1',
			threadsUserId: '123',
			threadsUsername: 'ashish',
			accessToken: 'token-1',
			accessTokenExpiresAt: '2026-06-01T00:00:00.000Z',
			connectedAt: '2026-04-13T09:00:00.000Z',
			disconnectedAt: null,
			createdAt: '2026-04-13T09:00:00.000Z',
			updatedAt: '2026-04-13T09:00:00.000Z',
		});
		repository.getCheckpoint.mockResolvedValue({
			sourcePlatform: 'threads',
			lastCheckedAt: '2026-04-13T10:00:00.000Z',
			lastSeenPostId: 'post-9',
			lastCursor: null,
			updatedAt: '2026-04-13T10:00:00.000Z',
		});
		repository.getPostMetrics.mockResolvedValue({
			total: 12,
			delivered: 8,
			pending: 2,
			failed: 2,
			apiDelivered: 10,
			blueskyDelivered: 8,
			lastAttemptedAt: '2026-04-13T10:15:00.000Z',
		});
		configService.get = jest.fn((key: string) => {
			if (key === 'THREADS_BOOTSTRAP_SINCE') {
				return '2026-04-01T00:00:00.000Z';
			}
			if (key === 'BLUESKY_HANDLE') {
				return '@ashish.me';
			}
			if (key === 'BLUESKY_APP_PASSWORD') {
				return 'secret';
			}
			return undefined;
		});

		const overview = await service.getOverview();

		expect(overview).toEqual({
			threads: {
				connected: true,
				username: 'ashish',
				connectedAt: '2026-04-13T09:00:00.000Z',
				accessTokenExpiresAt: '2026-06-01T00:00:00.000Z',
				bootstrapSince: '2026-04-01T00:00:00.000Z',
			},
			bluesky: {
				configured: true,
				handle: '@ashish.me',
			},
			sync: {
				processing: false,
				lastCheckedAt: '2026-04-13T10:00:00.000Z',
				lastSeenPostId: 'post-9',
			},
			delivery: {
				total: 12,
				delivered: 8,
				pending: 2,
				failed: 2,
				apiDelivered: 10,
				blueskyDelivered: 8,
				lastAttemptedAt: '2026-04-13T10:15:00.000Z',
			},
		});
	});

	it('loads recent posts for the updates page', async () => {
		const rows = [createPendingPost(), createPendingPost({ id: 'row-2', sourcePostId: 'post-2' })];
		repository.listRecentPosts.mockResolvedValue(rows);

		const recent = await service.getRecentPosts(2);

		expect(repository.listRecentPosts).toHaveBeenCalledWith(2);
		expect(recent).toEqual(rows);
	});

	it('returns already_running when a manual sync is requested during processing', async () => {
		(service as any).processing = true;

		const result = await service.triggerManualSync();

		expect(result).toEqual({ accepted: false, status: 'already_running' });
	});

	it('runs the sync immediately when manual sync is requested', async () => {
		repository.getActiveIntegration.mockResolvedValue(null);

		const result = await service.triggerManualSync();

		expect(result).toEqual({ accepted: true, status: 'started' });
		expect(repository.getActiveIntegration).toHaveBeenCalled();
	});

	it('retries only temporary failed deliveries', async () => {
		repository.retryFailedDeliveries.mockResolvedValue(3);

		const result = await service.retryFailedDeliveries();

		expect(repository.retryFailedDeliveries).toHaveBeenCalled();
		expect(result).toEqual({ retried: 3 });
	});
});
