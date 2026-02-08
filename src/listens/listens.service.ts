import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CreateListenDto } from './dto/create-listen.dto';
import { sendEvent } from 'src/common/utils';

@Injectable()
export class ListensService {
	private readonly logger = new Logger(ListensService.name);

	async create(createListenDto: CreateListenDto, apikey: string) {
		try {
			const payload = this.buildNewListenPayload(createListenDto);
			return await this.postNewListen(payload, apikey);
		} catch (e) {
			const failedTrack = createListenDto?.payload?.[0]?.track_metadata?.track_name ?? 'unknown_track';
			await sendEvent('create_listen_failed', failedTrack);
			this.logger.error(`Listen creation failed for "${failedTrack}": ${e.message}`, e.stack);
			return { error: `Failed to create listen - ${e.message}` };
		}
	}

	private buildNewListenPayload(createListenDto: CreateListenDto): any {
		const payload = createListenDto?.payload?.[0];
		if (!payload?.track_metadata?.track_name) {
			throw new Error('Missing listen payload');
		}

		return {
			title: payload.track_metadata.track_name,
			album: payload.track_metadata.release_name,
			artist: payload.track_metadata.artist_name,
			listenDate: new Date(payload.listened_at * 1000).toISOString(),
		};
	}

	private async postNewListen(newListen: any, apikey: string): Promise<any> {
		const config = {
			headers: {
				apiKey: apikey,
			},
		};
		const response = await axios.post('https://api.ashish.me/listens', newListen, config);
		return response.data;
	}
}
