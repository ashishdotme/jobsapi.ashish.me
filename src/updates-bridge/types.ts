export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'failed_permanent';

export interface ThreadsBridgeOAuthState {
	id: string;
	state: string;
	returnTo: string | null;
	expiresAt: string;
	createdAt: string;
}

export interface ThreadsBridgeIntegration {
	id: string;
	threadsUserId: string;
	threadsUsername: string;
	accessToken: string;
	accessTokenExpiresAt: string;
	connectedAt: string;
	disconnectedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ThreadsBridgeCheckpoint {
	sourcePlatform: 'threads';
	lastCheckedAt: string;
	lastSeenPostId: string | null;
	lastCursor: string | null;
	updatedAt: string;
}

export interface NormalizedThreadsPost {
	sourcePlatform: 'threads';
	sourcePostId: string;
	sourcePostType: 'post' | 'repost' | 'quote';
	sourceUrl: string;
	sourcePublishedAt: string;
	title: string;
	content: string;
	mediaUrls: string[];
	referencedSourceId?: string | null;
	referencedSourceUrl?: string | null;
	sourcePayload: Record<string, unknown>;
}

export interface ThreadsBridgePost extends NormalizedThreadsPost {
	id: string;
	apiUpdateId: string | null;
	apiStatus: DeliveryStatus;
	blueskyUri: string | null;
	blueskyStatus: DeliveryStatus;
	attemptCount: number;
	nextAttemptAt: string | null;
	lastError: string | null;
	lastAttemptedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ThreadsBridgeMetrics {
	total: number;
	delivered: number;
	pending: number;
	failed: number;
	apiDelivered: number;
	blueskyDelivered: number;
	lastAttemptedAt: string | null;
}

export interface UpdatesBridgeOverview {
	threads: {
		connected: boolean;
		username: string | null;
		connectedAt: string | null;
		accessTokenExpiresAt: string | null;
		bootstrapSince: string | null;
	};
	bluesky: {
		configured: boolean;
		handle: string | null;
	};
	sync: {
		processing: boolean;
		lastCheckedAt: string | null;
		lastSeenPostId: string | null;
	};
	delivery: ThreadsBridgeMetrics;
}
