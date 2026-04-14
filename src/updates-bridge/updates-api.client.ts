import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface CreateOrUpdateUpdateInput {
	category: string;
	title: string;
	content: string;
	date: string;
	source: string;
	sourceId: string;
	sourcePostType: string;
	referencedSourceId: string | null;
	referencedSourceUrl: string | null;
	sourceUrl: string;
	mediaUrls: string[];
	bridgePublisher: string;
	blueskyUri: string | null;
}

@Injectable()
export class UpdatesApiClient {
	constructor(private readonly configService: ConfigService) {}

	async createOrUpdateUpdate(input: CreateOrUpdateUpdateInput): Promise<{ id: string; created: boolean }> {
		const response = await axios.post('https://api.ashish.me/updates', input, {
			headers: {
				apiKey: this.configService.get<string>('ASHISHDOTME_TOKEN'),
			},
		});

		return {
			id: String(response.data.id),
			created: Boolean(response.data.created ?? response.status === 201),
		};
	}
}
