import { Injectable, Logger } from '@nestjs/common';
import { sendEvent } from 'src/common/utils';
import axios from 'axios';

@Injectable()
export class WikiService {
	private readonly logger = new Logger(WikiService.name);

	async create(createWikiDto: any, apikey: string) {
		try {
			const payload = this.buildNewWkiPayload(createWikiDto);
			return await this.postNewWki(payload, apikey);
		} catch (e) {
			await sendEvent('create_memo_failed', createWikiDto.memo.content);
			this.logger.error(`Memo creation failed: ${e.message}`, e.stack);
			return { error: `Failed to create memo - ${e.message}` };
		}
	}

	private buildNewWkiPayload(createWikiDto: any): any {
		return {
			content: createWikiDto.memo.content,
			category: 'Tech',
			date: new Date(),
		};
	}

	private async postNewWki(newWki: any, apikey: string): Promise<any> {
		const config = {
			headers: {
				apiKey: apikey,
			},
		};
		const response = await axios.post('https://api.ashish.me/wiki', newWki, config);
		return response.data;
	}
}
