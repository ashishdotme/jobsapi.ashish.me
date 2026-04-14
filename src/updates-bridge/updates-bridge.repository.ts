import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UpdatesBridgeDbService } from './updates-bridge.db.service';
import type {
	NormalizedThreadsPost,
	ThreadsBridgeCheckpoint,
	ThreadsBridgeIntegration,
	ThreadsBridgeMetrics,
	ThreadsBridgeOAuthState,
	ThreadsBridgePost,
} from './types';

type SaveIntegrationInput = Pick<
	ThreadsBridgeIntegration,
	'threadsUserId' | 'threadsUsername' | 'accessToken' | 'accessTokenExpiresAt'
>;

type SaveCheckpointInput = Pick<
	ThreadsBridgeCheckpoint,
	'sourcePlatform' | 'lastCheckedAt' | 'lastSeenPostId' | 'lastCursor'
>;

@Injectable()
export class UpdatesBridgeRepository {
	private readonly oauthStates = new Map<string, ThreadsBridgeOAuthState>();
	private readonly posts = new Map<string, ThreadsBridgePost>();
	private readonly integrations = new Map<string, ThreadsBridgeIntegration>();
	private readonly checkpoints = new Map<string, ThreadsBridgeCheckpoint>();

	constructor(private readonly updatesBridgeDbService: UpdatesBridgeDbService) {}

	async saveOAuthState(returnTo: string | null): Promise<ThreadsBridgeOAuthState> {
		const state: ThreadsBridgeOAuthState = {
			id: randomUUID(),
			state: randomUUID(),
			returnTo,
			expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			createdAt: new Date().toISOString(),
		};

		if (!this.updatesBridgeDbService.isEnabled()) {
			this.oauthStates.set(state.state, state);
			return state;
		}

		const pool = this.updatesBridgeDbService.getPool();
		await pool?.query(
			`INSERT INTO threads_bridge_oauth_states (id, state, return_to, expires_at, created_at)
			 VALUES ($1, $2, $3, $4, $5)`,
			[state.id, state.state, state.returnTo, state.expiresAt, state.createdAt],
		);
		return state;
	}

	async getOAuthState(state: string): Promise<ThreadsBridgeOAuthState | null> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			return this.oauthStates.get(state) ?? null;
		}

		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query(
			'SELECT id, state, return_to, expires_at, created_at FROM threads_bridge_oauth_states WHERE state = $1',
			[state],
		);
		const row = result?.rows[0];
		if (!row) {
			return null;
		}
		return {
			id: row.id,
			state: row.state,
			returnTo: row.return_to,
			expiresAt: new Date(row.expires_at).toISOString(),
			createdAt: new Date(row.created_at).toISOString(),
		};
	}

	async deleteOAuthState(state: string): Promise<void> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			this.oauthStates.delete(state);
			return;
		}
		const pool = this.updatesBridgeDbService.getPool();
		await pool?.query('DELETE FROM threads_bridge_oauth_states WHERE state = $1', [state]);
	}

	async saveIntegration(input: SaveIntegrationInput): Promise<ThreadsBridgeIntegration> {
		const now = new Date().toISOString();
		const current = await this.getActiveIntegration();
		const integration: ThreadsBridgeIntegration = {
			id: current?.id ?? randomUUID(),
			threadsUserId: input.threadsUserId,
			threadsUsername: input.threadsUsername,
			accessToken: input.accessToken,
			accessTokenExpiresAt: input.accessTokenExpiresAt,
			connectedAt: current?.connectedAt ?? now,
			disconnectedAt: null,
			createdAt: current?.createdAt ?? now,
			updatedAt: now,
		};

		if (!this.updatesBridgeDbService.isEnabled()) {
			this.integrations.set(integration.id, integration);
			return integration;
		}

		const pool = this.updatesBridgeDbService.getPool();
		await pool?.query(
			`INSERT INTO threads_bridge_integrations (
				id, threads_user_id, threads_username, access_token, access_token_expires_at, connected_at, disconnected_at, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
			ON CONFLICT (id) DO UPDATE SET
				threads_user_id = EXCLUDED.threads_user_id,
				threads_username = EXCLUDED.threads_username,
				access_token = EXCLUDED.access_token,
				access_token_expires_at = EXCLUDED.access_token_expires_at,
				disconnected_at = EXCLUDED.disconnected_at,
				updated_at = EXCLUDED.updated_at`,
			[
				integration.id,
				integration.threadsUserId,
				integration.threadsUsername,
				integration.accessToken,
				integration.accessTokenExpiresAt,
				integration.connectedAt,
				integration.disconnectedAt,
				integration.createdAt,
				integration.updatedAt,
			],
		);
		return integration;
	}

	async getActiveIntegration(): Promise<ThreadsBridgeIntegration | null> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			return Array.from(this.integrations.values()).find((integration) => integration.disconnectedAt === null) ?? null;
		}
		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query(
			`SELECT * FROM threads_bridge_integrations
			 WHERE disconnected_at IS NULL
			 ORDER BY updated_at DESC
			 LIMIT 1`,
		);
		const row = result?.rows[0];
		if (!row) {
			return null;
		}
		return {
			id: row.id,
			threadsUserId: row.threads_user_id,
			threadsUsername: row.threads_username,
			accessToken: row.access_token,
			accessTokenExpiresAt: new Date(row.access_token_expires_at).toISOString(),
			connectedAt: new Date(row.connected_at).toISOString(),
			disconnectedAt: row.disconnected_at ? new Date(row.disconnected_at).toISOString() : null,
			createdAt: new Date(row.created_at).toISOString(),
			updatedAt: new Date(row.updated_at).toISOString(),
		};
	}

	async saveCheckpoint(input: SaveCheckpointInput): Promise<ThreadsBridgeCheckpoint> {
		const checkpoint: ThreadsBridgeCheckpoint = {
			...input,
			updatedAt: new Date().toISOString(),
		};

		if (!this.updatesBridgeDbService.isEnabled()) {
			this.checkpoints.set(input.sourcePlatform, checkpoint);
			return checkpoint;
		}

		const pool = this.updatesBridgeDbService.getPool();
		await pool?.query(
			`INSERT INTO threads_bridge_checkpoints (source_platform, last_checked_at, last_seen_post_id, last_cursor, updated_at)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (source_platform) DO UPDATE SET
				last_checked_at = EXCLUDED.last_checked_at,
				last_seen_post_id = EXCLUDED.last_seen_post_id,
				last_cursor = EXCLUDED.last_cursor,
				updated_at = EXCLUDED.updated_at`,
			[
				checkpoint.sourcePlatform,
				checkpoint.lastCheckedAt,
				checkpoint.lastSeenPostId,
				checkpoint.lastCursor,
				checkpoint.updatedAt,
			],
		);

		return checkpoint;
	}

	async getCheckpoint(sourcePlatform: 'threads'): Promise<ThreadsBridgeCheckpoint | null> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			return this.checkpoints.get(sourcePlatform) ?? null;
		}
		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query(
			'SELECT * FROM threads_bridge_checkpoints WHERE source_platform = $1',
			[sourcePlatform],
		);
		const row = result?.rows[0];
		if (!row) {
			return null;
		}
		return {
			sourcePlatform: row.source_platform,
			lastCheckedAt: new Date(row.last_checked_at).toISOString(),
			lastSeenPostId: row.last_seen_post_id,
			lastCursor: row.last_cursor,
			updatedAt: new Date(row.updated_at).toISOString(),
		};
	}

	async upsertPost(post: NormalizedThreadsPost): Promise<ThreadsBridgePost> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			const existing = await this.getPostBySourceId(post.sourcePlatform, post.sourcePostId);
			const now = new Date().toISOString();
			const saved: ThreadsBridgePost = existing
				? {
						...existing,
						...post,
						updatedAt: now,
					}
				: {
						id: randomUUID(),
						...post,
						apiUpdateId: null,
						apiStatus: 'pending',
						blueskyUri: null,
						blueskyStatus: 'pending',
						attemptCount: 0,
						nextAttemptAt: null,
						lastError: null,
						lastAttemptedAt: null,
						createdAt: now,
						updatedAt: now,
					};
			this.posts.set(this.postKey(post.sourcePlatform, post.sourcePostId), saved);
			return saved;
		}

		const pool = this.updatesBridgeDbService.getPool();
		const existing = await this.getPostBySourceId(post.sourcePlatform, post.sourcePostId);
		const now = new Date().toISOString();
		const saved: ThreadsBridgePost = existing
			? { ...existing, ...post, updatedAt: now }
			: {
					id: randomUUID(),
					...post,
					apiUpdateId: null,
					apiStatus: 'pending',
					blueskyUri: null,
					blueskyStatus: 'pending',
					attemptCount: 0,
					nextAttemptAt: null,
					lastError: null,
					lastAttemptedAt: null,
					createdAt: now,
					updatedAt: now,
				};

		await pool?.query(
			`INSERT INTO threads_bridge_posts (
				id, source_platform, source_post_id, source_post_type, source_url, source_published_at, title, content, media_urls,
				referenced_source_id, referenced_source_url, source_payload, api_update_id, api_status, bluesky_uri, bluesky_status,
				attempt_count, next_attempt_at, last_error, last_attempted_at, created_at, updated_at
			) VALUES (
				$1,$2,$3,$4,$5,$6,$7,$8,$9,
				$10,$11,$12,$13,$14,$15,$16,
				$17,$18,$19,$20,$21,$22
			)
			ON CONFLICT (source_platform, source_post_id) DO UPDATE SET
				source_post_type = EXCLUDED.source_post_type,
				source_url = EXCLUDED.source_url,
				source_published_at = EXCLUDED.source_published_at,
				title = EXCLUDED.title,
				content = EXCLUDED.content,
				media_urls = EXCLUDED.media_urls,
				referenced_source_id = EXCLUDED.referenced_source_id,
				referenced_source_url = EXCLUDED.referenced_source_url,
				source_payload = EXCLUDED.source_payload,
				updated_at = EXCLUDED.updated_at`,
			[
				saved.id,
				saved.sourcePlatform,
				saved.sourcePostId,
				saved.sourcePostType,
				saved.sourceUrl,
				saved.sourcePublishedAt,
				saved.title,
				saved.content,
				saved.mediaUrls,
				saved.referencedSourceId ?? null,
				saved.referencedSourceUrl ?? null,
				JSON.stringify(saved.sourcePayload),
				saved.apiUpdateId,
				saved.apiStatus,
				saved.blueskyUri,
				saved.blueskyStatus,
				saved.attemptCount,
				saved.nextAttemptAt,
				saved.lastError,
				saved.lastAttemptedAt,
				saved.createdAt,
				saved.updatedAt,
			],
		);
		return saved;
	}

	async getPostBySourceId(sourcePlatform: 'threads', sourcePostId: string): Promise<ThreadsBridgePost | null> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			return this.posts.get(this.postKey(sourcePlatform, sourcePostId)) ?? null;
		}
		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query(
			'SELECT * FROM threads_bridge_posts WHERE source_platform = $1 AND source_post_id = $2',
			[sourcePlatform, sourcePostId],
		);
		const row = result?.rows[0];
		return row ? this.mapPostRow(row) : null;
	}

	async listDeliverablePosts(now: Date): Promise<ThreadsBridgePost[]> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			return Array.from(this.posts.values()).filter((post) => this.isDeliverable(post, now));
		}
		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query(
			`SELECT * FROM threads_bridge_posts
			 WHERE (api_status <> 'failed_permanent' OR bluesky_status <> 'failed_permanent')
			   AND (next_attempt_at IS NULL OR next_attempt_at <= $1)
			   AND (api_status <> 'delivered' OR bluesky_status <> 'delivered')
			 ORDER BY source_published_at ASC`,
			[now.toISOString()],
		);
		return (result?.rows ?? []).map((row) => this.mapPostRow(row));
	}

	async listRecentPosts(limit: number): Promise<ThreadsBridgePost[]> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			return Array.from(this.posts.values())
				.sort((left, right) => right.sourcePublishedAt.localeCompare(left.sourcePublishedAt))
				.slice(0, limit);
		}

		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query(
			`SELECT * FROM threads_bridge_posts
			 ORDER BY source_published_at DESC
			 LIMIT $1`,
			[limit],
		);
		return (result?.rows ?? []).map((row) => this.mapPostRow(row));
	}

	async retryFailedDeliveries(): Promise<number> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			let retried = 0;
			for (const [key, post] of this.posts.entries()) {
				const updated = this.buildRetriedPost(post);
				if (!updated) {
					continue;
				}
				this.posts.set(key, updated);
				retried += 1;
			}
			return retried;
		}

		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query(
			`UPDATE threads_bridge_posts
			 SET api_status = CASE WHEN api_status = 'failed' THEN 'pending' ELSE api_status END,
			     bluesky_status = CASE WHEN bluesky_status = 'failed' THEN 'pending' ELSE bluesky_status END,
			     next_attempt_at = NULL,
			     last_error = NULL,
			     updated_at = NOW()
			 WHERE api_status = 'failed' OR bluesky_status = 'failed'`,
		);
		return result?.rowCount ?? 0;
	}

	async getPostMetrics(): Promise<ThreadsBridgeMetrics> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			const posts = Array.from(this.posts.values());
			const lastAttemptedAt = posts
				.map((post) => post.lastAttemptedAt)
				.filter((value): value is string => Boolean(value))
				.sort((left, right) => right.localeCompare(left))[0] ?? null;

			return {
				total: posts.length,
				delivered: posts.filter((post) => post.apiStatus === 'delivered' && post.blueskyStatus === 'delivered').length,
				pending: posts.filter((post) => this.isPending(post)).length,
				failed: posts.filter((post) => this.isFailed(post)).length,
				apiDelivered: posts.filter((post) => post.apiStatus === 'delivered').length,
				blueskyDelivered: posts.filter((post) => post.blueskyStatus === 'delivered').length,
				lastAttemptedAt,
			};
		}

		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query(
			`SELECT
				COUNT(*)::int AS total,
				COUNT(*) FILTER (WHERE api_status = 'delivered' AND bluesky_status = 'delivered')::int AS delivered,
				COUNT(*) FILTER (
					WHERE (api_status IN ('pending', 'failed') OR bluesky_status IN ('pending', 'failed'))
					  AND NOT (api_status IN ('failed', 'failed_permanent') AND bluesky_status IN ('failed', 'failed_permanent'))
				)::int AS pending,
				COUNT(*) FILTER (WHERE api_status IN ('failed', 'failed_permanent') OR bluesky_status IN ('failed', 'failed_permanent'))::int AS failed,
				COUNT(*) FILTER (WHERE api_status = 'delivered')::int AS api_delivered,
				COUNT(*) FILTER (WHERE bluesky_status = 'delivered')::int AS bluesky_delivered,
				MAX(last_attempted_at) AS last_attempted_at
			 FROM threads_bridge_posts`,
		);
		const row = result?.rows[0];
		return {
			total: row?.total ?? 0,
			delivered: row?.delivered ?? 0,
			pending: row?.pending ?? 0,
			failed: row?.failed ?? 0,
			apiDelivered: row?.api_delivered ?? 0,
			blueskyDelivered: row?.bluesky_delivered ?? 0,
			lastAttemptedAt: row?.last_attempted_at ? new Date(row.last_attempted_at).toISOString() : null,
		};
	}

	async markApiDelivered(id: string, apiUpdateId: string): Promise<void> {
		await this.updatePost(id, (post) => ({
			...post,
			apiUpdateId,
			apiStatus: 'delivered',
			lastError: null,
			nextAttemptAt: null,
			updatedAt: new Date().toISOString(),
		}));
	}

	async markBlueskyDelivered(id: string, blueskyUri: string): Promise<void> {
		await this.updatePost(id, (post) => ({
			...post,
			blueskyUri,
			blueskyStatus: 'delivered',
			lastError: null,
			nextAttemptAt: null,
			updatedAt: new Date().toISOString(),
		}));
	}

	async markDeliveryFailure(id: string, error: string, options: { nextAttemptAt: string | null; permanent: boolean }): Promise<void> {
		await this.updatePost(id, (post) => ({
			...post,
			apiStatus: post.apiStatus === 'delivered' ? post.apiStatus : options.permanent ? 'failed_permanent' : 'failed',
			blueskyStatus: post.blueskyStatus === 'delivered' ? post.blueskyStatus : options.permanent ? 'failed_permanent' : 'failed',
			attemptCount: post.attemptCount + 1,
			lastError: error,
			lastAttemptedAt: new Date().toISOString(),
			nextAttemptAt: options.nextAttemptAt,
			updatedAt: new Date().toISOString(),
		}));
	}

	private async updatePost(id: string, updater: (post: ThreadsBridgePost) => ThreadsBridgePost): Promise<void> {
		if (!this.updatesBridgeDbService.isEnabled()) {
			const existing = Array.from(this.posts.values()).find((post) => post.id === id);
			if (!existing) {
				return;
			}
			const updated = updater(existing);
			this.posts.set(this.postKey(updated.sourcePlatform, updated.sourcePostId), updated);
			return;
		}

		const pool = this.updatesBridgeDbService.getPool();
		const result = await pool?.query('SELECT * FROM threads_bridge_posts WHERE id = $1', [id]);
		const row = result?.rows[0];
		if (!row) {
			return;
		}
		const updated = updater(this.mapPostRow(row));
		await pool?.query(
			`UPDATE threads_bridge_posts
			 SET api_update_id = $2,
			     api_status = $3,
			     bluesky_uri = $4,
			     bluesky_status = $5,
			     attempt_count = $6,
			     next_attempt_at = $7,
			     last_error = $8,
			     last_attempted_at = $9,
			     updated_at = $10
			 WHERE id = $1`,
			[
				updated.id,
				updated.apiUpdateId,
				updated.apiStatus,
				updated.blueskyUri,
				updated.blueskyStatus,
				updated.attemptCount,
				updated.nextAttemptAt,
				updated.lastError,
				updated.lastAttemptedAt,
				updated.updatedAt,
			],
		);
	}

	private isDeliverable(post: ThreadsBridgePost, now: Date): boolean {
		if (post.apiStatus === 'failed_permanent' && post.blueskyStatus === 'failed_permanent') {
			return false;
		}
		if (post.apiStatus === 'delivered' && post.blueskyStatus === 'delivered') {
			return false;
		}
		if (post.nextAttemptAt && new Date(post.nextAttemptAt) > now) {
			return false;
		}
		return true;
	}

	private isPending(post: ThreadsBridgePost): boolean {
		if (post.apiStatus === 'delivered' && post.blueskyStatus === 'delivered') {
			return false;
		}
		if (post.apiStatus === 'failed_permanent' && post.blueskyStatus === 'failed_permanent') {
			return false;
		}
		return post.apiStatus === 'pending' || post.blueskyStatus === 'pending' || post.apiStatus === 'failed' || post.blueskyStatus === 'failed';
	}

	private isFailed(post: ThreadsBridgePost): boolean {
		return (
			post.apiStatus === 'failed' ||
			post.apiStatus === 'failed_permanent' ||
			post.blueskyStatus === 'failed' ||
			post.blueskyStatus === 'failed_permanent'
		);
	}

	private buildRetriedPost(post: ThreadsBridgePost): ThreadsBridgePost | null {
		const retryApi = post.apiStatus === 'failed';
		const retryBluesky = post.blueskyStatus === 'failed';
		if (!retryApi && !retryBluesky) {
			return null;
		}

		return {
			...post,
			apiStatus: retryApi ? 'pending' : post.apiStatus,
			blueskyStatus: retryBluesky ? 'pending' : post.blueskyStatus,
			nextAttemptAt: null,
			lastError: null,
			updatedAt: new Date().toISOString(),
		};
	}

	private postKey(sourcePlatform: 'threads', sourcePostId: string): string {
		return `${sourcePlatform}:${sourcePostId}`;
	}

	private mapPostRow(row: any): ThreadsBridgePost {
		return {
			id: row.id,
			sourcePlatform: row.source_platform,
			sourcePostId: row.source_post_id,
			sourcePostType: row.source_post_type,
			sourceUrl: row.source_url,
			sourcePublishedAt: new Date(row.source_published_at).toISOString(),
			title: row.title,
			content: row.content,
			mediaUrls: row.media_urls ?? [],
			referencedSourceId: row.referenced_source_id,
			referencedSourceUrl: row.referenced_source_url,
			sourcePayload: row.source_payload ?? {},
			apiUpdateId: row.api_update_id,
			apiStatus: row.api_status,
			blueskyUri: row.bluesky_uri,
			blueskyStatus: row.bluesky_status,
			attemptCount: row.attempt_count,
			nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at).toISOString() : null,
			lastError: row.last_error,
			lastAttemptedAt: row.last_attempted_at ? new Date(row.last_attempted_at).toISOString() : null,
			createdAt: new Date(row.created_at).toISOString(),
			updatedAt: new Date(row.updated_at).toISOString(),
		};
	}
}
