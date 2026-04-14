import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreateListenDto } from './dto/create-listen.dto';
import { GetUserListensDto } from './dto/get-user-listens.dto';
import { formatLogMessage, getErrorMessage, getErrorStack } from '../common/logging';
import { sendEvent } from '../common/utils';

const LISTENS_URL = 'https://api.ashish.me/listens';

interface UpstreamListen {
	title?: string | null;
	artist?: string | null;
	album?: string | null;
	listenDate?: string | null;
}

export interface ListenBrainzListen {
	listened_at: number;
	track_metadata: {
		artist_name: string;
		track_name: string;
		release_name: string;
		additional_info: Record<string, never>;
	};
	user_name: string;
}

export interface ListenBrainzUserListensResponse {
	payload: {
		count: number;
		latest_listen_ts: number;
		listens: ListenBrainzListen[];
		oldest_listen_ts: number;
		user_id: string;
	};
}

@Injectable()
export class ListensService {
	private readonly logger = new Logger(ListensService.name);
	private readonly apiKey = this.configService.get<string>('ASHISHDOTME_TOKEN');

	constructor(private readonly configService: ConfigService) {}

	async create(createListenDto: CreateListenDto) {
		try {
			if (!this.apiKey) {
				throw new Error('ASHISHDOTME_TOKEN is not configured');
			}

			const payload = this.buildNewListenPayload(createListenDto);
			return await this.postNewListen(payload);
		} catch (error) {
			const failedTrack = createListenDto?.payload?.[0]?.track_metadata?.track_name ?? 'unknown_track';
			await sendEvent('create_listen_failed', failedTrack);
			this.logger.error(formatLogMessage('listen.create.failed', { track: failedTrack, payload: createListenDto, errorMessage: getErrorMessage(error) }), getErrorStack(error));
			return { error: `Failed to create listen - ${getErrorMessage(error)}` };
		}
	}

	async getUserListens(user: string, query: GetUserListensDto): Promise<ListenBrainzUserListensResponse> {
		const upstreamListens = await this.fetchUserListens(query);
		const listens = upstreamListens
			.map(listen => this.mapListenForUser(listen, user))
			.filter((listen): listen is ListenBrainzListen => listen !== null)
			.filter(listen => query.min_ts === undefined || listen.listened_at > query.min_ts)
			.filter(listen => query.max_ts === undefined || listen.listened_at < query.max_ts)
			.sort((a, b) => b.listened_at - a.listened_at);

		const filteredListens = query.count === undefined ? listens : listens.slice(0, query.count);

		return {
			payload: {
				count: filteredListens.length,
				latest_listen_ts: filteredListens[0]?.listened_at ?? 0,
				listens: filteredListens,
				oldest_listen_ts: filteredListens[filteredListens.length - 1]?.listened_at ?? 0,
				user_id: user,
			},
		};
	}

	private buildNewListenPayload(createListenDto: CreateListenDto): any {
		const payload = createListenDto?.payload?.[0];
		if (!payload?.track_metadata?.track_name) {
			throw new Error('Missing listen payload');
		}

		const listenDate =
			typeof payload.listened_at === 'number' && Number.isFinite(payload.listened_at) ? new Date(payload.listened_at * 1000).toISOString() : new Date().toISOString();

		return {
			title: payload.track_metadata.track_name,
			album: payload.track_metadata.release_name,
			artist: payload.track_metadata.artist_name,
			listenDate,
		};
	}

	private async postNewListen(newListen: any): Promise<any> {
		const config = {
			headers: {
				apiKey: this.apiKey,
			},
		};
		const response = await axios.post(LISTENS_URL, newListen, config);
		return response.data;
	}

	private async fetchUserListens(query: GetUserListensDto): Promise<UpstreamListen[]> {
		const config =
			query.count !== undefined && query.min_ts === undefined && query.max_ts === undefined
				? {
						params: {
							limit: query.count,
						},
					}
				: {};

		const response = await axios.get(LISTENS_URL, config);
		return Array.isArray(response.data) ? response.data : [];
	}

	private mapListenForUser(listen: UpstreamListen, user: string): ListenBrainzListen | null {
		const listened_at = this.parseListenTimestamp(listen.listenDate);
		if (listened_at === null) {
			return null;
		}

		return {
			listened_at,
			track_metadata: {
				artist_name: listen.artist ?? '',
				track_name: listen.title ?? '',
				release_name: listen.album ?? '',
				additional_info: {},
			},
			user_name: user,
		};
	}

	private parseListenTimestamp(listenDate?: string | null): number | null {
		if (!listenDate) {
			return null;
		}

		const parsedTime = Date.parse(listenDate);
		if (Number.isNaN(parsedTime)) {
			return null;
		}

		return Math.floor(parsedTime / 1000);
	}
}
