import { Logger } from '@nestjs/common';
import { formatLogMessage, getErrorMessage } from '../logging';
import { MediaDetails, MediaMetadataProvider, MediaType } from './types';

const logger = new Logger('MetadataResolver');

export class MetadataResolver {
	constructor(private readonly providers: MediaMetadataProvider[]) {}

	async resolve(title: string, type: MediaType): Promise<MediaDetails | null> {
		for (const provider of this.providers) {
			try {
				const result = await provider.fetch(title, type);
				if (result) {
					logger.log(formatLogMessage('metadata.resolved', { provider: provider.name, title, type }));
					return result;
				}
			} catch (error) {
				logger.warn(formatLogMessage('metadata.provider.error', { provider: provider.name, title, type, errorMessage: getErrorMessage(error) }));
			}
		}
		return null;
	}
}
