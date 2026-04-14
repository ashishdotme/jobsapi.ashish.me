import { MetadataResolver } from './resolver';
import { MediaDetails, MediaMetadataProvider } from './types';

const makeDetails = (overrides: Partial<MediaDetails> = {}): MediaDetails => ({
	title: 'The Matrix',
	description: 'A computer hacker learns about the true nature of reality.',
	language: 'English',
	year: 1999,
	genre: 'Action, Sci-Fi',
	rating: 8.7,
	imdbId: 'tt0133093',
	tmdbId: 603,
	posterUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
	...overrides,
});

const makeProvider = (name: string, result: MediaDetails | null): MediaMetadataProvider => ({
	name,
	fetch: jest.fn().mockResolvedValue(result),
});

describe('MetadataResolver', () => {
	it('returns result from the first provider that succeeds', async () => {
		const tmdb = makeProvider('tmdb', makeDetails({ tmdbId: 603 }));
		const omdb = makeProvider('omdb', makeDetails({ tmdbId: null }));
		const resolver = new MetadataResolver([tmdb, omdb]);

		const result = await resolver.resolve('The Matrix', 'movie');

		expect(result).toEqual(expect.objectContaining({ tmdbId: 603 }));
		expect(tmdb.fetch).toHaveBeenCalledWith('The Matrix', 'movie');
		expect(omdb.fetch).not.toHaveBeenCalled();
	});

	it('falls through to the next provider when first returns null', async () => {
		const tmdb = makeProvider('tmdb', null);
		const omdb = makeProvider('omdb', makeDetails({ tmdbId: null }));
		const resolver = new MetadataResolver([tmdb, omdb]);

		const result = await resolver.resolve('The Matrix', 'movie');

		expect(result).toEqual(expect.objectContaining({ tmdbId: null }));
		expect(tmdb.fetch).toHaveBeenCalled();
		expect(omdb.fetch).toHaveBeenCalled();
	});

	it('returns null when all providers return null', async () => {
		const tmdb = makeProvider('tmdb', null);
		const omdb = makeProvider('omdb', null);
		const resolver = new MetadataResolver([tmdb, omdb]);

		const result = await resolver.resolve('Unknown Movie', 'movie');

		expect(result).toBeNull();
	});

	it('passes media type to providers', async () => {
		const provider = makeProvider('tmdb', makeDetails());
		const resolver = new MetadataResolver([provider]);

		await resolver.resolve('Severance', 'show');

		expect(provider.fetch).toHaveBeenCalledWith('Severance', 'show');
	});

	it('catches a throwing provider and continues to the next', async () => {
		const broken: MediaMetadataProvider = {
			name: 'broken',
			fetch: jest.fn().mockRejectedValue(new Error('connection timeout')),
		};
		const fallback = makeProvider('fallback', makeDetails({ tmdbId: null }));
		const resolver = new MetadataResolver([broken, fallback]);

		const result = await resolver.resolve('The Matrix', 'movie');

		expect(result).toEqual(expect.objectContaining({ tmdbId: null }));
		expect(broken.fetch).toHaveBeenCalled();
		expect(fallback.fetch).toHaveBeenCalled();
	});

	it('returns null when all providers throw', async () => {
		const broken1: MediaMetadataProvider = {
			name: 'broken1',
			fetch: jest.fn().mockRejectedValue(new Error('timeout')),
		};
		const broken2: MediaMetadataProvider = {
			name: 'broken2',
			fetch: jest.fn().mockRejectedValue(new Error('auth failed')),
		};
		const resolver = new MetadataResolver([broken1, broken2]);

		const result = await resolver.resolve('The Matrix', 'movie');

		expect(result).toBeNull();
	});
});
