import { Injectable, Logger } from '@nestjs/common';
import { CreateShowDto } from './dto/create-show.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { sendEvent, fetchDetailsFromOmdb } from '../common/utils';

@Injectable()
export class ShowsService {
	private readonly logger = new Logger(ShowsService.name);
	private OMDB_APIKEY: string = this.configService.get<string>('OMDB');

	constructor(private configService: ConfigService) {}

	randomDate(start, end) {
		end = end ? new Date(end) : new Date();
		return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
	}

	private buildShowPayload(createShowDto: CreateShowDto, showDetails: any, viewingDate: Date): any {
		const ratingValue = showDetails.Ratings?.[0]?.Value ?? '0/10';
		const rawYear = typeof showDetails.Year === 'string' && showDetails.Year.includes('–') ? showDetails.Year.split('–')[0] : showDetails.Year;
		const parsedYear = Number(rawYear);
		const parsedRating = Number(ratingValue.split('/')[0]);
		return {
			title: `${showDetails.Title} Season ${createShowDto.seasonNumber}`,
			seasonNumber: createShowDto.seasonNumber,
			showName: showDetails.Title,
			description: showDetails.Plot,
			language: 'English',
			year: Number.isFinite(parsedYear) ? parsedYear : 0,
			genre: showDetails.Genre,
			startedDate: viewingDate,
			status: 'Started',
			imdbRating: Number.isFinite(parsedRating) ? parsedRating : 0,
			imdbId: showDetails.imdbID,
			loved: createShowDto.loved ?? true,
		};
	}

	async create(createShowDto: CreateShowDto, apiKey: string) {
		if (!createShowDto.title) {
			this.logger.warn('Show creation rejected: title is blank');
			return { error: 'Title cannot be blank' };
		}
		let viewingDate = createShowDto.date ? new Date(createShowDto.date) : new Date();
		let showDetails: any;

		try {
			showDetails = await fetchDetailsFromOmdb(createShowDto.title, this.OMDB_APIKEY);
		} catch (error) {
			await sendEvent('create_show_failed', createShowDto.title);
			this.logger.error(`Show metadata lookup failed for "${createShowDto.title}": ${error.message}`);
			return { error: error.message };
		}

		if (!showDetails) {
			await sendEvent('create_show_failed', createShowDto.title);
			this.logger.warn(`Show creation failed: no metadata found for "${createShowDto.title}"`);
			return { error: 'Failed to create show - Show not found' };
		}

		if (!createShowDto.date && createShowDto.startDate) {
			viewingDate = this.randomDate(new Date(createShowDto.startDate), createShowDto.endDate);
		}

		const showPayload = this.buildShowPayload(createShowDto, showDetails, viewingDate);

		try {
			const config = {
				headers: {
					apiKey: apiKey,
				},
			};
			const showCreated = await axios.post('https://api.ashish.me/shows', showPayload, config);
			return showCreated.data;
		} catch (error) {
			await sendEvent('create_show_failed', createShowDto.title);
			this.logger.error(`Show creation failed for "${createShowDto.title}": ${error.message}`);
			return { error: error.message };
		}
	}
}
