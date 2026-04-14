import { Injectable, Logger } from '@nestjs/common';
import { sendEvent } from 'src/common/utils';
import axios from 'axios';
import { formatLogMessage, getErrorMessage, getErrorStack } from '../common/logging';

@Injectable()
export class WikiService {
	private readonly logger = new Logger(WikiService.name);

	async create(createWikiDto: any, apikey: string) {
		try {
			const payload = this.buildNewWkiPayload(createWikiDto);
			return await this.postNewWki(payload, apikey);
		} catch (error) {
			await sendEvent('create_memo_failed', createWikiDto.memo.content);
			this.logger.error(formatLogMessage('wiki.create.failed', { payload: createWikiDto, errorMessage: getErrorMessage(error) }), getErrorStack(error));
			return { error: `Failed to create memo - ${getErrorMessage(error)}` };
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
