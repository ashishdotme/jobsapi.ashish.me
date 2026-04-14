import { UpdatesBridgeRepository } from './updates-bridge.repository';
import type { NormalizedThreadsPost } from './types';

describe('UpdatesBridgeRepository', () => {
	let repository: UpdatesBridgeRepository;

	beforeEach(() => {
		repository = new UpdatesBridgeRepository({
			isEnabled: () => false,
			getPool: () => null,
		} as any);
	});

	const createPost = (overrides: Partial<NormalizedThreadsPost> = {}): NormalizedThreadsPost => ({
		sourcePlatform: 'threads',
		sourcePostId: 'post-1',
		sourcePostType: 'post',
		sourceUrl: 'https://www.threads.net/@ashish/post/1',
		sourcePublishedAt: '2026-04-13T10:00:00.000Z',
		title: 'Threads post',
		content: 'Hello world',
		mediaUrls: [],
		sourcePayload: { id: 'post-1' },
		...overrides,
	});

	it('upserts source posts by sourcePlatform and sourcePostId', async () => {
		const first = await repository.upsertPost(createPost());
		const second = await repository.upsertPost(
			createPost({ content: 'Updated text' }),
		);

		expect(first.id).toBe(second.id);
		expect(second.content).toBe('Updated text');
		expect(second.apiStatus).toBe('pending');
		expect(second.blueskyStatus).toBe('pending');
	});

	it('persists and retrieves oauth state with returnTo', async () => {
		const saved = await repository.saveOAuthState('/dashboard/settings');
		const loaded = await repository.getOAuthState(saved.state);

		expect(loaded).toEqual(
			expect.objectContaining({
				state: saved.state,
				returnTo: '/dashboard/settings',
			}),
		);
	});

	it('stores and returns the active integration', async () => {
		await repository.saveIntegration({
			threadsUserId: '123',
			threadsUsername: 'ashish',
			accessToken: 'token-1',
			accessTokenExpiresAt: '2026-06-01T00:00:00.000Z',
		});

		const integration = await repository.getActiveIntegration();
		expect(integration).toEqual(
			expect.objectContaining({
				threadsUserId: '123',
				threadsUsername: 'ashish',
				accessToken: 'token-1',
			}),
		);
	});

	it('tracks checkpoints and pending delivery rows', async () => {
		const post = await repository.upsertPost(createPost());
		await repository.saveCheckpoint({
			sourcePlatform: 'threads',
			lastCheckedAt: '2026-04-13T10:05:00.000Z',
			lastSeenPostId: 'post-1',
			lastCursor: null,
		});

		const checkpoint = await repository.getCheckpoint('threads');
		const pending = await repository.listDeliverablePosts(
			new Date('2026-04-13T10:06:00.000Z'),
		);

		expect(checkpoint).toEqual(
			expect.objectContaining({
				lastCheckedAt: '2026-04-13T10:05:00.000Z',
				lastSeenPostId: 'post-1',
			}),
		);
		expect(pending.map((row) => row.id)).toContain(post.id);
	});

	it('updates delivery metadata for api and bluesky destinations', async () => {
		const post = await repository.upsertPost(createPost());
		await repository.markApiDelivered(post.id, '42');
		await repository.markBlueskyDelivered(
			post.id,
			'at://did:plc:test/app.bsky.feed.post/123',
		);

		const [saved] = await repository.listDeliverablePosts(new Date());
		expect(saved).toBeUndefined();

		const loaded = await repository.getPostBySourceId('threads', 'post-1');
		expect(loaded).toEqual(
			expect.objectContaining({
				apiUpdateId: '42',
				apiStatus: 'delivered',
				blueskyStatus: 'delivered',
				blueskyUri: 'at://did:plc:test/app.bsky.feed.post/123',
			}),
		);
	});

	it('records retry metadata and suppresses delivery until nextAttemptAt', async () => {
		const post = await repository.upsertPost(createPost());
		await repository.markDeliveryFailure(post.id, 'temporary failure', {
			nextAttemptAt: '2026-04-13T12:00:00.000Z',
			permanent: false,
		});

		const earlyRows = await repository.listDeliverablePosts(
			new Date('2026-04-13T11:00:00.000Z'),
		);
		const laterRows = await repository.listDeliverablePosts(
			new Date('2026-04-13T12:01:00.000Z'),
		);

		expect(earlyRows).toHaveLength(0);
		expect(laterRows).toHaveLength(1);
		expect(laterRows[0]).toEqual(
			expect.objectContaining({
				attemptCount: 1,
				lastError: 'temporary failure',
			}),
		);
	});

	it('lists recent posts in descending published order', async () => {
		await repository.upsertPost(createPost({ sourcePostId: 'post-1', sourcePublishedAt: '2026-04-13T10:00:00.000Z' }));
		await repository.upsertPost(createPost({ sourcePostId: 'post-2', sourcePublishedAt: '2026-04-13T11:00:00.000Z' }));

		const rows = await repository.listRecentPosts(2);

		expect(rows.map((row) => row.sourcePostId)).toEqual(['post-2', 'post-1']);
	});

	it('builds delivery metrics for the updates workspace', async () => {
		const delivered = await repository.upsertPost(createPost({ sourcePostId: 'delivered' }));
		await repository.markApiDelivered(delivered.id, 'update-1');
		await repository.markBlueskyDelivered(delivered.id, 'at://did:plc:test/app.bsky.feed.post/1');

		const failed = await repository.upsertPost(createPost({ sourcePostId: 'failed' }));
		await repository.markDeliveryFailure(failed.id, 'temporary failure', {
			nextAttemptAt: '2026-04-13T12:00:00.000Z',
			permanent: false,
		});

		await repository.upsertPost(createPost({ sourcePostId: 'pending' }));

		const metrics = await repository.getPostMetrics();

		expect(metrics).toEqual(
			expect.objectContaining({
				total: 3,
				delivered: 1,
				pending: 2,
				failed: 1,
				apiDelivered: 1,
				blueskyDelivered: 1,
			}),
		);
		expect(metrics.lastAttemptedAt).toEqual(expect.any(String));
	});
});
