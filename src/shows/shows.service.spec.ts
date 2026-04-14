import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as resolverModule from '../common/media-metadata/resolver';
import { ShowsService } from './shows.service';

describe('ShowsService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('lists all shows from api.ashish.me', async () => {
		const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
			data: [{ id: 1, title: 'Severance Season 1' }],
		} as any);
		const service = new ShowsService({
			get: jest.fn((key: string) => (key === 'ASHISHDOTME_TOKEN' ? 'server-key' : undefined)),
		} as unknown as ConfigService);

		await expect(service.list('api-key')).resolves.toEqual([{ id: 1, title: 'Severance Season 1' }]);

		expect(getSpy).toHaveBeenCalledWith('https://api.ashish.me/shows', {
			headers: {
				apiKey: 'server-key',
			},
		});
	});

	it('creates show from resolved metadata and posts to api.ashish.me', async () => {
		jest.spyOn(resolverModule.MetadataResolver.prototype, 'resolve').mockResolvedValue({
			title: 'Severance',
			description: 'Office workers undergo a surgical procedure.',
			language: 'en',
			year: 2022,
			genre: 'Drama, Mystery',
			rating: 8.7,
			imdbId: 'tt11280740',
			tmdbId: 95396,
			posterUrl: 'https://image.tmdb.org/t/p/w500/severance.jpg',
		});
		const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 44 } } as any);
		const service = new ShowsService({
			get: jest.fn(),
		} as unknown as ConfigService);

		await service.create(
			{
				title: 'Severance',
				seasonNumber: 1,
			} as any,
			'api-key',
		);

		expect(postSpy).toHaveBeenCalledWith(
			'https://api.ashish.me/shows',
			expect.objectContaining({
				title: 'Severance Season 1',
				showName: 'Severance',
				seasonNumber: 1,
				imdbRating: 8.7,
				imdbId: 'tt11280740',
				tmdbId: 95396,
				posterUrl: 'https://image.tmdb.org/t/p/w500/severance.jpg',
			}),
			expect.any(Object),
		);
	});

	it('prefers posterUrl and tmdbId from DTO over provider values', async () => {
		jest.spyOn(resolverModule.MetadataResolver.prototype, 'resolve').mockResolvedValue({
			title: 'Severance',
			description: 'Office workers undergo a surgical procedure.',
			language: 'en',
			year: 2022,
			genre: 'Drama, Mystery',
			rating: 8.7,
			imdbId: 'tt11280740',
			tmdbId: 95396,
			posterUrl: 'https://image.tmdb.org/t/p/w500/severance.jpg',
		});
		const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 44 } } as any);
		const service = new ShowsService({
			get: jest.fn(),
		} as unknown as ConfigService);

		await service.create(
			{
				title: 'Severance',
				seasonNumber: 1,
				posterUrl: 'https://custom.example.com/sev.jpg',
				tmdbId: 11111,
			} as any,
			'api-key',
		);

		expect(postSpy).toHaveBeenCalledWith(
			'https://api.ashish.me/shows',
			expect.objectContaining({
				posterUrl: 'https://custom.example.com/sev.jpg',
				tmdbId: 11111,
			}),
			expect.any(Object),
		);
	});

	it('returns error when resolver finds no metadata', async () => {
		jest.spyOn(resolverModule.MetadataResolver.prototype, 'resolve').mockResolvedValue(null);
		jest.spyOn(axios, 'post').mockResolvedValue({} as any);
		const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		const service = new ShowsService({
			get: jest.fn(),
		} as unknown as ConfigService);

		const result = await service.create({ title: 'Unknown Show', seasonNumber: 1 } as any, 'api-key');

		expect(result).toEqual({ error: 'Failed to create show - Show not found' });
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('metadata_not_found'));
	});
});
