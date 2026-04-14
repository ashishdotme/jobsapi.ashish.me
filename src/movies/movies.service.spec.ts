import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosHeaders } from 'axios';
import { applyApiRequestIdForwarding } from '../common/api-request-id-forwarding';
import { runWithRequestContext } from '../common/request-context';
import * as resolverModule from '../common/media-metadata/resolver';
import { MoviesService } from './movies.service';

describe('MoviesService logging', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('logs a structured rejection event when title is blank', async () => {
		const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		const service = new MoviesService({
			get: jest.fn(),
		} as unknown as ConfigService);

		await expect(service.create({ title: '' } as any, 'api-key')).resolves.toEqual({
			error: 'Title cannot be blank',
		});

		expect(warnSpy).toHaveBeenCalledWith('movie.create.rejected reason="blank_title" payload={"title":""}');
	});

	it('returns early when the movie title already exists remotely', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: [{ title: 'The Matrix' }],
		} as any);
		const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: {} } as any);
		const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		const service = new MoviesService({
			get: jest.fn(),
		} as unknown as ConfigService);

		await expect(service.create({ title: '  the matrix  ' } as any, 'api-key')).resolves.toEqual({
			error: 'Movie already exists',
		});

		expect(postSpy).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalledWith('movie.create.skipped reason="duplicate_title" title="  the matrix  "');
	});

	it('lists all movies from api.ashish.me', async () => {
		const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
			data: [{ id: 1, title: 'The Matrix' }],
		} as any);
		const service = new MoviesService({
			get: jest.fn((key: string) => (key === 'ASHISHDOTME_TOKEN' ? 'server-key' : undefined)),
		} as unknown as ConfigService);

		await expect(service.list('api-key')).resolves.toEqual([{ id: 1, title: 'The Matrix' }]);

		expect(getSpy).toHaveBeenCalledWith('https://api.ashish.me/movies', {
			headers: {
				apiKey: 'server-key',
			},
		});
	});

	it('forwards x-request-id to api.ashish.me when request context exists', async () => {
		applyApiRequestIdForwarding();
		const service = new MoviesService({
			get: jest.fn(),
		} as unknown as ConfigService);
		const originalAdapter = axios.defaults.adapter;
		const captured: { headers?: any } = {};

		axios.defaults.adapter = async config => {
			captured.headers = config.headers;
			return {
				data: [{ title: 'The Matrix' }],
				status: 200,
				statusText: 'OK',
				headers: {},
				config,
				request: {},
			};
		};

		await runWithRequestContext({ requestId: 'req-123' }, () => service.create({ title: 'The Matrix' } as any, 'api-key'));

		expect(AxiosHeaders.from(captured.headers).get('x-request-id')).toBe('req-123');
		axios.defaults.adapter = originalAdapter;
	});

	it('does not forward x-request-id without request context', async () => {
		applyApiRequestIdForwarding();
		const service = new MoviesService({
			get: jest.fn(),
		} as unknown as ConfigService);
		const originalAdapter = axios.defaults.adapter;
		const captured: { headers?: any } = {};

		axios.defaults.adapter = async config => {
			captured.headers = config.headers;
			return {
				data: [{ title: 'The Matrix' }],
				status: 200,
				statusText: 'OK',
				headers: {},
				config,
				request: {},
			};
		};

		await service.create({ title: 'The Matrix' } as any, 'api-key');

		expect(AxiosHeaders.from(captured.headers).get('x-request-id')).toBeUndefined();
		axios.defaults.adapter = originalAdapter;
	});

	it('creates movie from resolved metadata and posts to api.ashish.me', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({ data: [] } as any);
		jest.spyOn(resolverModule.MetadataResolver.prototype, 'resolve').mockResolvedValue({
			title: 'Identity',
			description: 'Ten strangers get stranded.',
			language: 'en',
			year: 2003,
			genre: 'Mystery, Thriller',
			rating: 7.3,
			imdbId: 'tt0309698',
			tmdbId: 2832,
			posterUrl: 'https://image.tmdb.org/t/p/w500/identity.jpg',
		});
		const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 1 } } as any);
		const service = new MoviesService({
			get: jest.fn(),
		} as unknown as ConfigService);

		await service.create({ title: 'Identity' } as any, 'api-key');

		expect(postSpy).toHaveBeenCalledWith(
			'https://api.ashish.me/movies',
			expect.objectContaining({
				title: 'Identity',
				description: 'Ten strangers get stranded.',
				imdbRating: 7.3,
				imdbId: 'tt0309698',
				tmdbId: 2832,
				posterUrl: 'https://image.tmdb.org/t/p/w500/identity.jpg',
			}),
			expect.any(Object),
		);
	});

	it('prefers posterUrl and tmdbId from DTO over provider values', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({ data: [] } as any);
		jest.spyOn(resolverModule.MetadataResolver.prototype, 'resolve').mockResolvedValue({
			title: 'Identity',
			description: 'Ten strangers get stranded.',
			language: 'en',
			year: 2003,
			genre: 'Mystery, Thriller',
			rating: 7.3,
			imdbId: 'tt0309698',
			tmdbId: 2832,
			posterUrl: 'https://image.tmdb.org/t/p/w500/identity.jpg',
		});
		const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 1 } } as any);
		const service = new MoviesService({
			get: jest.fn(),
		} as unknown as ConfigService);

		await service.create(
			{
				title: 'Identity',
				posterUrl: 'https://custom.example.com/poster.jpg',
				tmdbId: 9999,
			} as any,
			'api-key',
		);

		expect(postSpy).toHaveBeenCalledWith(
			'https://api.ashish.me/movies',
			expect.objectContaining({
				posterUrl: 'https://custom.example.com/poster.jpg',
				tmdbId: 9999,
			}),
			expect.any(Object),
		);
	});

	it('returns error when resolver finds no metadata', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({ data: [] } as any);
		jest.spyOn(resolverModule.MetadataResolver.prototype, 'resolve').mockResolvedValue(null);
		jest.spyOn(axios, 'post').mockResolvedValue({} as any);
		const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		const service = new MoviesService({
			get: jest.fn(),
		} as unknown as ConfigService);

		const result = await service.create({ title: 'Nonexistent Movie' } as any, 'api-key');

		expect(result).toEqual({ error: 'Failed to create movie - Movie not found' });
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('metadata_not_found'));
	});
});
