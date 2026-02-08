import { Injectable, Logger } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import * as _ from 'lodash';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { sendEvent, fetchDetailsFromOmdb, fetchDetailsFromImdb } from '../common/utils';

@Injectable()
export class MoviesService {
	private readonly logger = new Logger(MoviesService.name);
	private OMDB_APIKEY: string = this.configService.get<string>('OMDB');

	constructor(private configService: ConfigService) {}

	randomDate(start, end) {
		end = _.isUndefined(end) ? new Date() : new Date(end);
		return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
	}

	async create(createMovieDto: CreateMovieDto, apikey: string): Promise<any> {
		if (_.isEmpty(createMovieDto.title)) {
			this.logger.warn('Movie creation rejected: title is blank');
			return { error: 'Title cannot be blank' };
		}

		const viewingDate = this.calculateViewingDate(createMovieDto);
		try {
			let movieDetails = await fetchDetailsFromOmdb(createMovieDto.title, this.OMDB_APIKEY);
			let moviePayload: any = null;

			if (movieDetails) {
				moviePayload = this.buildNewMoviePayloadFromOmdb(createMovieDto, movieDetails, viewingDate);
			}

			if (!moviePayload) {
				movieDetails = await fetchDetailsFromImdb(createMovieDto.title);
				if (movieDetails) {
					moviePayload = this.buildNewMoviePayloadFromImdb(createMovieDto, movieDetails, viewingDate);
				}
			}

			if (!moviePayload) {
				await sendEvent('create_movie_failed', createMovieDto.title);
				this.logger.warn(`Movie creation failed: no metadata found for "${createMovieDto.title}"`);
				return { error: `Failed to create movie - Movie not found` };
			}

			return await this.postNewMovie(moviePayload, apikey);
		} catch (e) {
			await sendEvent('create_movie_failed', createMovieDto.title);
			this.logger.error(`Movie creation failed for "${createMovieDto.title}": ${e.message}`, e.stack);
			return { error: `Failed to create movie - ${e.message}` };
		}
	}

	private calculateViewingDate(createMovieDto: CreateMovieDto): Date {
		let viewingDate = new Date(createMovieDto.date || createMovieDto.startDate || Date.now());
		if (!_.isEmpty(createMovieDto.startDate) && _.isEmpty(createMovieDto.date)) {
			viewingDate = this.randomDate(new Date(createMovieDto.startDate), createMovieDto.endDate);
		}
		return viewingDate;
	}

	private buildNewMoviePayloadFromOmdb(createMovieDto: CreateMovieDto, movieDetails: any, viewingDate: Date): any {
		const ratingValue = _.get(movieDetails, 'Ratings[0].Value', '0/10');
		const imdbRating = Number(ratingValue.split('/')[0]);
		const parsedYear = Number(movieDetails.Year);
		return {
			title: movieDetails.Title,
			description: movieDetails.Plot,
			language: 'English',
			year: Number.isFinite(parsedYear) ? parsedYear : 0,
			genre: movieDetails.Genre,
			viewingDate: viewingDate,
			imdbRating: Number.isFinite(imdbRating) ? imdbRating : 0,
			imdbId: movieDetails.imdbID,
			loved: createMovieDto.loved ?? true,
		};
	}

	private buildNewMoviePayloadFromImdb(createMovieDto: CreateMovieDto, movieDetails: any, viewingDate: Date): any {
		const rating = Number(_.get(movieDetails, 'rating.star', 0));
		const genres = _.get(movieDetails, 'genre', []);
		return {
			title: movieDetails.title,
			description: movieDetails.plot,
			language: _.get(movieDetails, 'spokenLanguages[0].language', 'Unknown'),
			year: Number(movieDetails.year),
			genre: Array.isArray(genres) ? genres.join(', ') : '',
			viewingDate: viewingDate,
			imdbRating: Number.isFinite(rating) ? rating : 0,
			imdbId: movieDetails.id,
			loved: createMovieDto.loved ?? true,
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
}
