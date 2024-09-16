import { Injectable } from '@nestjs/common';
import { sendEvent } from 'src/common/utils';
import axios from 'axios';

@Injectable()
export class WikiService {
	async create(createWikiDto: any, apikey: string) {
		try {
			const payload = this.buildNewWkiPayload(createWikiDto);
      console.log('payload', payload);
			return await this.postNewWki(payload, apikey);
		} catch (e) {
			await sendEvent('create_memo_failed', createWikiDto.memo.content);
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
    console.log('response', response);
		return response.data;
	}
}
