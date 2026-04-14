import { Injectable, Logger } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import * as _ from 'lodash';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { sendEvent } from '../common/utils';
import { formatLogMessage, getErrorMessage, getErrorStack } from '../common/logging';
import { MediaDetails, MetadataResolver, TmdbProvider, OmdbProvider, ImdbProvider } from '../common/media-metadata';

@Injectable()
export class MoviesService {
	private readonly logger = new Logger(MoviesService.name);
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
		end = _.isUndefined(end) ? new Date() : new Date(end);
		return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
	}

	async list(apikey: string): Promise<any[]> {
		const upstreamApiKey = this.resolveUpstreamApiKey(apikey);
		const response = await axios.get('https://api.ashish.me/movies', {
			headers: {
				apiKey: upstreamApiKey,
			},
		});
		return response.data;
	}

	async create(createMovieDto: CreateMovieDto, apikey: string): Promise<any> {
		if (_.isEmpty(createMovieDto.title)) {
			this.logger.warn(formatLogMessage('movie.create.rejected', { reason: 'blank_title', payload: createMovieDto }));
			return { error: 'Title cannot be blank' };
		}

		try {
			if (await this.movieExists(createMovieDto.title, apikey)) {
				this.logger.warn(formatLogMessage('movie.create.skipped', { reason: 'duplicate_title', title: createMovieDto.title }));
				return { error: 'Movie already exists' };
			}

			const viewingDate = this.calculateViewingDate(createMovieDto);
			const details = await this.resolver.resolve(createMovieDto.title, 'movie');

			if (!details) {
				await sendEvent('create_movie_failed', createMovieDto.title);
				this.logger.warn(formatLogMessage('movie.create.failed', { reason: 'metadata_not_found', title: createMovieDto.title, payload: createMovieDto }));
				return { error: `Failed to create movie - Movie not found` };
			}

			const moviePayload = this.buildMoviePayload(createMovieDto, details, viewingDate);
			return await this.postNewMovie(moviePayload, apikey);
		} catch (error) {
			await sendEvent('create_movie_failed', createMovieDto.title);
			this.logger.error(
				formatLogMessage('movie.create.failed', { title: createMovieDto.title, payload: createMovieDto, errorMessage: getErrorMessage(error) }),
				getErrorStack(error),
			);
			return { error: `Failed to create movie - ${getErrorMessage(error)}` };
		}
	}

	private calculateViewingDate(createMovieDto: CreateMovieDto): Date {
		let viewingDate = new Date(createMovieDto.date || createMovieDto.startDate || Date.now());
		if (!_.isEmpty(createMovieDto.startDate) && _.isEmpty(createMovieDto.date)) {
			viewingDate = this.randomDate(new Date(createMovieDto.startDate), createMovieDto.endDate);
		}
		return viewingDate;
	}

	private buildMoviePayload(dto: CreateMovieDto, details: MediaDetails, viewingDate: Date): any {
		return {
			title: details.title,
			description: details.description,
			language: details.language,
			year: details.year,
			genre: details.genre,
			viewingDate: viewingDate,
			imdbRating: details.rating,
			imdbId: details.imdbId,
			posterUrl: dto.posterUrl ?? details.posterUrl,
			tmdbId: dto.tmdbId ?? details.tmdbId,
			loved: dto.loved ?? true,
		};
	}

	private async postNewMovie(newMovie: any, apikey: string): Promise<any> {
		const config = {
			headers: {
				apiKey: apikey,
			},
		};
		const response = await axios.post('https://api.ashish.me/movies', newMovie, config);
		return response.data;
	}

	private async movieExists(title: string, apikey: string): Promise<boolean> {
		const normalizedTitle = title.trim().toLowerCase();
		const response = await axios.get('https://api.ashish.me/movies', {
			headers: {
				apiKey: apikey,
			},
		});

		return (response.data ?? []).some(movie => typeof movie?.title === 'string' && movie.title.trim().toLowerCase() === normalizedTitle);
	}
}
