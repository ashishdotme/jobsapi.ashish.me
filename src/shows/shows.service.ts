import { Injectable, Logger } from '@nestjs/common';
import { CreateShowDto } from './dto/create-show.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { sendEvent } from '../common/utils';
import { formatLogMessage, getErrorMessage, getErrorStack } from '../common/logging';
import { MediaDetails, MetadataResolver, TmdbProvider, OmdbProvider, ImdbProvider } from '../common/media-metadata';

@Injectable()
export class ShowsService {
	private readonly logger = new Logger(ShowsService.name);
	private readonly upstreamApiKey: string | undefined = this.configService.get<string>('ASHISHDOTME_TOKEN');
	private readonly resolver: MetadataResolver;

	constructor(private configService: ConfigService) {
		this.resolver = new MetadataResolver([
			new TmdbProvider(this.configService.get<string>('TMDB_API_KEY')),
			new OmdbProvider(this.configService.get<string>('OMDB')),
			new ImdbProvider(),
		]);
	}

	private resolveUpstreamApiKey(apiKey: string): string {
		return this.upstreamApiKey?.trim() || apiKey;
	}

	randomDate(start, end) {
		end = end ? new Date(end) : new Date();
		return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
	}

	async list(apiKey: string): Promise<any[]> {
		const upstreamApiKey = this.resolveUpstreamApiKey(apiKey);
		const response = await axios.get('https://api.ashish.me/shows', {
			headers: {
				apiKey: upstreamApiKey,
			},
		});
		return response.data;
	}

	private buildShowPayload(dto: CreateShowDto, details: MediaDetails, viewingDate: Date): any {
		return {
			title: `${details.title} Season ${dto.seasonNumber}`,
			seasonNumber: dto.seasonNumber,
			showName: details.title,
			description: details.description,
			language: details.language,
			year: details.year,
			genre: details.genre,
			startedDate: viewingDate,
			status: 'Started',
			imdbRating: details.rating,
			imdbId: details.imdbId,
			posterUrl: dto.posterUrl ?? details.posterUrl,
			tmdbId: dto.tmdbId ?? details.tmdbId,
			loved: dto.loved ?? true,
		};
	}

	async create(createShowDto: CreateShowDto, apiKey: string) {
		if (!createShowDto.title) {
			this.logger.warn(formatLogMessage('show.create.rejected', { reason: 'blank_title', payload: createShowDto }));
			return { error: 'Title cannot be blank' };
		}

		try {
			let viewingDate = createShowDto.date ? new Date(createShowDto.date) : new Date();
			if (!createShowDto.date && createShowDto.startDate) {
				viewingDate = this.randomDate(new Date(createShowDto.startDate), createShowDto.endDate);
			}

			const details = await this.resolver.resolve(createShowDto.title, 'show');

			if (!details) {
				await sendEvent('create_show_failed', createShowDto.title);
				this.logger.warn(formatLogMessage('show.create.failed', { reason: 'metadata_not_found', title: createShowDto.title, payload: createShowDto }));
				return { error: 'Failed to create show - Show not found' };
			}

			const showPayload = this.buildShowPayload(createShowDto, details, viewingDate);
			const config = { headers: { apiKey } };
			const showCreated = await axios.post('https://api.ashish.me/shows', showPayload, config);
			return showCreated.data;
		} catch (error) {
			await sendEvent('create_show_failed', createShowDto.title);
			this.logger.error(formatLogMessage('show.create.failed', { title: createShowDto.title, payload: createShowDto, errorMessage: getErrorMessage(error) }), getErrorStack(error));
			return { error: getErrorMessage(error) };
		}
	}
}
