import { Logger } from '@nestjs/common';
import axios from 'axios';
import { formatLogMessage } from '../logging';
import { MediaDetails, MediaMetadataProvider, MediaType } from './types';

const logger = new Logger('MediaMetadata');

const ISO_LANGUAGE_MAP: Record<string, string> = {
	en: 'English',
	es: 'Spanish',
	fr: 'French',
	de: 'German',
	it: 'Italian',
	pt: 'Portuguese',
	ja: 'Japanese',
	ko: 'Korean',
	zh: 'Chinese',
	hi: 'Hindi',
	ar: 'Arabic',
	ru: 'Russian',
	nl: 'Dutch',
	sv: 'Swedish',
	da: 'Danish',
	no: 'Norwegian',
	fi: 'Finnish',
	pl: 'Polish',
	tr: 'Turkish',
	th: 'Thai',
	he: 'Hebrew',
	cs: 'Czech',
	el: 'Greek',
	hu: 'Hungarian',
	ro: 'Romanian',
	id: 'Indonesian',
	ms: 'Malay',
	vi: 'Vietnamese',
	ta: 'Tamil',
	te: 'Telugu',
	uk: 'Ukrainian',
	bn: 'Bengali',
	ml: 'Malayalam',
	mr: 'Marathi',
	tl: 'Tagalog',
	fa: 'Persian',
	ur: 'Urdu',
};

function resolveLanguageName(isoCode: string | undefined | null): string {
	if (!isoCode) {
		return 'English';
	}
	return ISO_LANGUAGE_MAP[isoCode.toLowerCase()] ?? isoCode;
}

function parseLeadingYear(raw: string | number | undefined | null): number {
	if (typeof raw === 'number') {
		return Number.isFinite(raw) ? raw : 0;
	}
	if (typeof raw !== 'string') {
		return 0;
	}
	const match = raw.match(/^(\d{4})/);
	return match ? Number(match[1]) : 0;
}

export class TmdbProvider implements MediaMetadataProvider {
	readonly name = 'tmdb';

	constructor(private readonly apiKey: string | undefined) {}

	async fetch(title: string, type: MediaType): Promise<MediaDetails | null> {
		const token = this.apiKey?.trim();
		if (!token) {
			return null;
		}

		try {
			const candidate = type === 'movie' ? await this.searchMovie(token, title) : await this.searchShow(token, title);
			if (!candidate) {
				return null;
			}

			const details = type === 'movie' ? await this.fetchMovieDetails(token, candidate.id) : await this.fetchShowDetails(token, candidate.id);
			if (!details) {
				return null;
			}

			return this.normalize(details, type);
		} catch {
			logger.warn(formatLogMessage('tmdb.lookup.failed', { title, type }));
			return null;
		}
	}

	private async searchMovie(token: string, title: string): Promise<{ id: number } | null> {
		const response = await this.tmdbGet(token, '/search/movie', { query: title, include_adult: 'false' });
		const results = Array.isArray(response?.results) ? response.results : [];
		return results[0] ?? null;
	}

	private async searchShow(token: string, title: string): Promise<{ id: number } | null> {
		const response = await this.tmdbGet(token, '/search/tv', { query: title });
		const results = Array.isArray(response?.results) ? response.results : [];
		return results[0] ?? null;
	}

	private async fetchMovieDetails(token: string, movieId: number): Promise<any> {
		return this.tmdbGet(token, `/movie/${movieId}`, { append_to_response: 'external_ids' });
	}

	private async fetchShowDetails(token: string, showId: number): Promise<any> {
		return this.tmdbGet(token, `/tv/${showId}`, { append_to_response: 'external_ids' });
	}

	private normalize(details: any, type: MediaType): MediaDetails {
		const genres = Array.isArray(details.genres) ? details.genres.map((g: any) => g.name).join(', ') : '';
		const dateField = type === 'movie' ? details.release_date : details.first_air_date;
		const year = dateField ? Number(dateField.split('-')[0]) : 0;
		const imdbId = details.imdb_id ?? details.external_ids?.imdb_id ?? null;
		const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null;
		const titleField = type === 'movie' ? details.title : details.name;

		return {
			title: titleField,
			description: details.overview ?? '',
			language: resolveLanguageName(details.original_language),
			year: Number.isFinite(year) ? year : 0,
			genre: genres,
			rating: Number.isFinite(details.vote_average) ? details.vote_average : 0,
			imdbId,
			tmdbId: details.id ?? null,
			posterUrl,
		};
	}

	private async tmdbGet(token: string, path: string, params: Record<string, string | undefined>): Promise<any> {
		const response = await axios.get(`https://api.themoviedb.org/3${path}`, {
			params,
			headers: { Authorization: `Bearer ${token}` },
			timeout: 15000,
		});
		return response.data;
	}
}

export class OmdbProvider implements MediaMetadataProvider {
	readonly name = 'omdb';

	constructor(private readonly apiKey: string | undefined) {}

	async fetch(title: string, type: MediaType): Promise<MediaDetails | null> {
		const apiKey = this.apiKey?.trim();
		if (!apiKey) {
			return null;
		}

		try {
			const omdbType = type === 'show' ? 'series' : 'movie';
			const response = await axios.get(
				`http://www.omdbapi.com/?t=${encodeURIComponent(title)}&type=${omdbType}&apikey=${apiKey}`,
			);
			if (!response.data || response.data.Response === 'False') {
				return null;
			}
			return this.normalize(response.data);
		} catch {
			logger.warn(formatLogMessage('omdb.lookup.failed', { title }));
			return null;
		}
	}

	private normalize(data: any): MediaDetails {
		const ratingValue = data.Ratings?.[0]?.Value ?? '0/10';
		const rating = Number(ratingValue.split('/')[0]);

		return {
			title: data.Title,
			description: data.Plot ?? '',
			language: data.Language ?? 'English',
			year: parseLeadingYear(data.Year),
			genre: data.Genre ?? '',
			rating: Number.isFinite(rating) ? rating : 0,
			imdbId: data.imdbID ?? null,
			tmdbId: null,
			posterUrl: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
		};
	}
}

export class ImdbProvider implements MediaMetadataProvider {
	readonly name = 'imdb';

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async fetch(title: string, _type): Promise<MediaDetails | null> {
		try {
			const response = await axios.get(`https://imdb.ashish.me/search?query=${encodeURIComponent(title)}`);
			if (!response.data || !response.data.results?.length) {
				return null;
			}

			const imdbId = response.data.results[0].id;
			const year = response.data.results[0].year;
			const detailsResponse = await axios.get(`https://imdb.ashish.me/title/${imdbId.trim()}`);
			const details = detailsResponse.data;
			details.year = year;

			return this.normalize(details);
		} catch {
			logger.warn(formatLogMessage('imdb.lookup.failed', { title }));
			return null;
		}
	}

	private normalize(data: any): MediaDetails {
		const rating = Number(data.rating?.star ?? 0);
		const genres = Array.isArray(data.genre) ? data.genre.join(', ') : '';

		return {
			title: data.title,
			description: data.plot ?? '',
			language: data.spokenLanguages?.[0]?.language ?? 'Unknown',
			year: parseLeadingYear(data.year),
			genre: genres,
			rating: Number.isFinite(rating) ? rating : 0,
			imdbId: data.id ?? null,
			tmdbId: null,
			posterUrl: null,
		};
	}
}
