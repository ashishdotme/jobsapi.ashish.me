import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlueskyClientService } from './bluesky-client.service';
import { ThreadsClientService } from './threads-client.service';
import { UpdatesApiClient } from './updates-api.client';
import { UpdatesBridgeRepository } from './updates-bridge.repository';
import type { ThreadsBridgePost, UpdatesBridgeOverview } from './types';

@Injectable()
export class UpdatesBridgeService {
	private readonly logger = new Logger(UpdatesBridgeService.name);
	private processing = false;

	constructor(
		private readonly repository: UpdatesBridgeRepository,
		private readonly threadsClient: ThreadsClientService,
		private readonly blueskyClient: BlueskyClientService,
		private readonly updatesApiClient: UpdatesApiClient,
		private readonly configService: ConfigService,
	) {}

	async runScheduledSync(): Promise<void> {
		if (this.processing) {
			this.logger.warn('threads bridge sync already running; skipping');
			return;
		}

		this.processing = true;
		try {
			const integration = await this.repository.getActiveIntegration();
			if (!integration) {
				return;
			}

			const maybeRefreshedIntegration = await this.refreshIntegrationIfNeeded(integration);
			const checkpoint = await this.repository.getCheckpoint('threads');
			const since = checkpoint?.lastCheckedAt ?? this.getBootstrapSince();

			const fetchedPosts = await this.threadsClient.fetchPostsSince({
				accessToken: maybeRefreshedIntegration.accessToken,
				userId: maybeRefreshedIntegration.threadsUserId,
				since,
			});
			const normalizedPosts = fetchedPosts.filter((post) => !this.isReply(post.sourcePayload));

			for (const post of normalizedPosts) {
				await this.repository.upsertPost(post);
			}

			await this.repository.saveCheckpoint({
				sourcePlatform: 'threads',
				lastCheckedAt:
					normalizedPosts[normalizedPosts.length - 1]?.sourcePublishedAt ??
					new Date().toISOString(),
				lastSeenPostId:
					normalizedPosts[normalizedPosts.length - 1]?.sourcePostId ?? null,
				lastCursor: null,
			});

			const deliverablePosts = await this.repository.listDeliverablePosts(new Date());
			for (const post of deliverablePosts) {
				await this.deliverPost(post);
			}
		} finally {
			this.processing = false;
		}
	}

	async triggerManualSync(): Promise<{ accepted: boolean; status: 'started' | 'already_running' }> {
		if (this.processing) {
			return { accepted: false, status: 'already_running' };
		}

		await this.runScheduledSync();
		return { accepted: true, status: 'started' };
	}

	async getOverview(): Promise<UpdatesBridgeOverview> {
		const [integration, checkpoint, delivery] = await Promise.all([
			this.repository.getActiveIntegration(),
			this.repository.getCheckpoint('threads'),
			this.repository.getPostMetrics(),
		]);
		const blueskyHandle = this.configService.get<string>('BLUESKY_HANDLE') ?? null;
		const blueskyPassword = this.configService.get<string>('BLUESKY_APP_PASSWORD') ?? null;

		return {
			threads: {
				connected: Boolean(integration),
				username: integration?.threadsUsername ?? null,
				connectedAt: integration?.connectedAt ?? null,
				accessTokenExpiresAt: integration?.accessTokenExpiresAt ?? null,
				bootstrapSince: this.getBootstrapSince(),
			},
			bluesky: {
				configured: Boolean(blueskyHandle && blueskyPassword),
				handle: blueskyHandle,
			},
			sync: {
				processing: this.processing,
				lastCheckedAt: checkpoint?.lastCheckedAt ?? null,
				lastSeenPostId: checkpoint?.lastSeenPostId ?? null,
			},
			delivery,
		};
	}

	async getRecentPosts(limit = 20): Promise<ThreadsBridgePost[]> {
		return this.repository.listRecentPosts(limit);
	}

	private async refreshIntegrationIfNeeded<T extends { accessToken: string; accessTokenExpiresAt: string; threadsUserId: string; threadsUsername: string }>(
		integration: T,
	): Promise<T> {
		const msUntilExpiry =
			new Date(integration.accessTokenExpiresAt).getTime() - Date.now();
		const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
		if (msUntilExpiry > sevenDaysMs) {
			return integration;
		}

		const refreshed = await this.threadsClient.refreshAccessToken(integration.accessToken);
		const updated = {
			...integration,
			accessToken: refreshed.accessToken,
			accessTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
		};
		await this.repository.saveIntegration({
			threadsUserId: updated.threadsUserId,
			threadsUsername: updated.threadsUsername,
			accessToken: updated.accessToken,
			accessTokenExpiresAt: updated.accessTokenExpiresAt,
		});
		return updated;
	}

	private async deliverPost(post: ThreadsBridgePost): Promise<void> {
		try {
			if (post.apiStatus !== 'delivered') {
				const update = await this.updatesApiClient.createOrUpdateUpdate(
					this.buildUpdatePayload(post, null),
				);
				await this.repository.markApiDelivered(post.id, update.id);
			}

			if (post.blueskyStatus !== 'delivered') {
				const blueskyResult = await this.blueskyClient.publish({
					text: this.formatForBluesky(post),
					mediaUrls: post.sourcePostType === 'post' ? post.mediaUrls.slice(0, 4) : [],
				});
				await this.repository.markBlueskyDelivered(post.id, blueskyResult.uri);
				await this.updatesApiClient.createOrUpdateUpdate(
					this.buildUpdatePayload(post, blueskyResult.uri),
				);
			}
		} catch (error) {
			const nextAttemptNumber = post.attemptCount + 1;
			const permanent = nextAttemptNumber >= 10;
			await this.repository.markDeliveryFailure(post.id, this.getErrorMessage(error), {
				permanent,
				nextAttemptAt: permanent ? null : this.calculateNextAttemptAt(nextAttemptNumber),
			});
		}
	}

	private buildUpdatePayload(post: ThreadsBridgePost, blueskyUri: string | null) {
		return {
			category: 'threads',
			title: post.title,
			content: post.content,
			date: post.sourcePublishedAt,
			source: 'threads',
			sourceId: post.sourcePostId,
			sourcePostType: post.sourcePostType,
			referencedSourceId: post.referencedSourceId ?? null,
			referencedSourceUrl: post.referencedSourceUrl ?? null,
			sourceUrl: post.sourceUrl,
			mediaUrls: post.mediaUrls,
			bridgePublisher: 'jobsapi.ashish.me',
			blueskyUri,
		};
	}

	private formatForBluesky(post: ThreadsBridgePost): string {
		if (post.sourcePostType === 'repost') {
			return `Repost ${post.referencedSourceUrl ?? post.sourceUrl}`;
		}

		let text = post.content;
		if (post.sourcePostType === 'quote' && post.referencedSourceUrl) {
			text = `${text}\n${post.referencedSourceUrl}`.trim();
		}
		if (text.length > 300) {
			return `${text.slice(0, 260)}...\n${post.sourceUrl}`;
		}
		return text;
	}

	private getBootstrapSince(): string {
		return (
			this.configService.get<string>('THREADS_BOOTSTRAP_SINCE') ??
			new Date().toISOString()
		);
	}

	private calculateNextAttemptAt(attemptNumber: number): string {
		const delayMinutes = Math.min(5 * 2 ** (attemptNumber - 1), 24 * 60);
		return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		return 'Unknown error';
	}

	private isReply(payload: Record<string, unknown>): boolean {
		return Boolean(payload.reply_to_id || payload.reply_to);
	}
}
