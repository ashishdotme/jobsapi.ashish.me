import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { NormalizedThreadsPost } from './types';

const THREADS_API = 'https://graph.threads.net/v1.0';
const THREADS_AUTH_URL = 'https://threads.net/oauth/authorize';
const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const THREADS_LONG_LIVED_TOKEN_URL = 'https://graph.threads.net/access_token';

@Injectable()
export class ThreadsClientService {
	constructor(private readonly configService: ConfigService) {}

	buildAuthorizationUrl(input: { state: string; redirectUri: string }): string {
		const params = new URLSearchParams({
			client_id: this.configService.get<string>('THREADS_APP_ID') ?? '',
			redirect_uri: input.redirectUri,
			scope: 'threads_basic,threads_content_publish',
			response_type: 'code',
			state: input.state,
		});
		return `${THREADS_AUTH_URL}?${params.toString()}`;
	}

	async exchangeCodeForToken(input: { code: string; redirectUri: string }): Promise<{ accessToken: string; userId: string }> {
		const body = new URLSearchParams({
			client_id: this.configService.get<string>('THREADS_APP_ID') ?? '',
			client_secret: this.configService.get<string>('THREADS_APP_SECRET') ?? '',
			grant_type: 'authorization_code',
			redirect_uri: input.redirectUri,
			code: input.code,
		});
		const response = await axios.post(THREADS_TOKEN_URL, body.toString(), {
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		});
		return {
			accessToken: response.data.access_token,
			userId: String(response.data.user_id),
		};
	}

	async exchangeForLongLivedToken(input: { shortLivedToken: string }): Promise<{ accessToken: string; expiresIn: number }> {
		const response = await axios.get(THREADS_LONG_LIVED_TOKEN_URL, {
			params: {
				grant_type: 'th_exchange_token',
				client_secret: this.configService.get<string>('THREADS_APP_SECRET') ?? '',
				access_token: input.shortLivedToken,
			},
		});
		return {
			accessToken: response.data.access_token,
			expiresIn: response.data.expires_in,
		};
	}

	async refreshAccessToken(accessToken: string): Promise<{ accessToken: string; expiresIn: number }> {
		const response = await axios.get(`${THREADS_API}/refresh_access_token`, {
			params: {
				grant_type: 'th_refresh_token',
				access_token: accessToken,
			},
		});
		return {
			accessToken: response.data.access_token,
			expiresIn: response.data.expires_in,
		};
	}

	async fetchIdentity(accessToken: string): Promise<{ id: string; username: string }> {
		const response = await axios.get(`${THREADS_API}/me`, {
			params: {
				fields: 'id,username',
				access_token: accessToken,
			},
		});
		return {
			id: String(response.data.id),
			username: response.data.username,
		};
	}

	async fetchPostsSince(input: { accessToken: string; userId: string; since: string | null }): Promise<NormalizedThreadsPost[]> {
		const fields = 'id,text,media_type,media_url,timestamp,permalink,children{media_url},referenced_repost{id,permalink},referenced_quote{id,permalink}';
		const response = await axios.get(`${THREADS_API}/${input.userId}/threads`, {
			params: {
				fields,
				...(input.since ? { since: Math.floor(new Date(input.since).getTime() / 1000) } : {}),
				access_token: input.accessToken,
			},
		});
		const rows = Array.isArray(response.data?.data) ? response.data.data : [];
		return rows.map((row: any) => this.normalizePost(row));
	}

	normalizePost(post: any): NormalizedThreadsPost {
		const mediaUrls: string[] = [];
		if (post.media_type === 'IMAGE' && post.media_url) {
			mediaUrls.push(post.media_url);
		}
		if (post.media_type === 'CAROUSEL' && post.children?.data) {
			for (const child of post.children.data) {
				if (child.media_url) {
					mediaUrls.push(child.media_url);
				}
			}
		}

		const referencedQuote = post.referenced_quote ?? null;
		const referencedRepost = post.referenced_repost ?? null;
		const sourcePostType = referencedQuote ? 'quote' : referencedRepost ? 'repost' : 'post';

		return {
			sourcePlatform: 'threads',
			sourcePostId: String(post.id),
			sourcePostType,
			sourceUrl: post.permalink,
			sourcePublishedAt: post.timestamp,
			title: sourcePostType === 'repost' ? 'Threads repost' : 'Threads post',
			content: post.text ?? '',
			mediaUrls,
			referencedSourceId: referencedQuote?.id ?? referencedRepost?.id ?? null,
			referencedSourceUrl: referencedQuote?.permalink ?? referencedRepost?.permalink ?? null,
			sourcePayload: post,
		};
	}
}
