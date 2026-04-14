import axios from 'axios';
import { TmdbProvider, OmdbProvider, ImdbProvider } from './providers';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TmdbProvider', () => {
	beforeEach(() => jest.clearAllMocks());

	it('returns null when API key is not set', async () => {
		const provider = new TmdbProvider(undefined);
		expect(await provider.fetch('The Matrix', 'movie')).toBeNull();
	});

	it('searches /search/movie for movie type and normalizes result', async () => {
		mockedAxios.get
			.mockResolvedValueOnce({ data: { results: [{ id: 603 }] } } as any)
			.mockResolvedValueOnce({
				data: {
					id: 603,
					title: 'The Matrix',
					overview: 'A hacker discovers reality is a simulation.',
					release_date: '1999-03-30',
					genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
					vote_average: 8.7,
					imdb_id: 'tt0133093',
					original_language: 'en',
					poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
				},
			} as any);

		const provider = new TmdbProvider('tmdb-token');
		const result = await provider.fetch('The Matrix', 'movie');

		expect(mockedAxios.get).toHaveBeenCalledWith(
			'https://api.themoviedb.org/3/search/movie',
			expect.objectContaining({ params: { query: 'The Matrix', include_adult: 'false' } }),
		);
		expect(result).toEqual({
			title: 'The Matrix',
			description: 'A hacker discovers reality is a simulation.',
			language: 'English',
			year: 1999,
			genre: 'Action, Science Fiction',
			rating: 8.7,
			imdbId: 'tt0133093',
			tmdbId: 603,
			posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
		});
	});

	it('searches /search/tv for show type and uses name + first_air_date', async () => {
		mockedAxios.get
			.mockResolvedValueOnce({ data: { results: [{ id: 95396 }] } } as any)
			.mockResolvedValueOnce({
				data: {
					id: 95396,
					name: 'Severance',
					overview: 'Office workers undergo a surgical procedure.',
					first_air_date: '2022-02-18',
					genres: [{ id: 18, name: 'Drama' }],
					vote_average: 8.7,
					external_ids: { imdb_id: 'tt11280740' },
					original_language: 'en',
					poster_path: '/severance.jpg',
				},
			} as any);

		const provider = new TmdbProvider('tmdb-token');
		const result = await provider.fetch('Severance', 'show');

		expect(mockedAxios.get).toHaveBeenCalledWith(
			'https://api.themoviedb.org/3/search/tv',
			expect.objectContaining({ params: { query: 'Severance' } }),
		);
		expect(result).toEqual({
			title: 'Severance',
			description: 'Office workers undergo a surgical procedure.',
			language: 'English',
			year: 2022,
			genre: 'Drama',
			rating: 8.7,
			imdbId: 'tt11280740',
			tmdbId: 95396,
			posterUrl: 'https://image.tmdb.org/t/p/w500/severance.jpg',
		});
	});

	it('maps non-English ISO language codes to full names', async () => {
		mockedAxios.get
			.mockResolvedValueOnce({ data: { results: [{ id: 1 }] } } as any)
			.mockResolvedValueOnce({
				data: {
					id: 1,
					title: 'Parasite',
					overview: 'Greed and class discrimination.',
					release_date: '2019-05-30',
					genres: [],
					vote_average: 8.6,
					original_language: 'ko',
					poster_path: null,
				},
			} as any);

		const result = await new TmdbProvider('token').fetch('Parasite', 'movie');

		expect(result?.language).toBe('Korean');
	});

	it('returns null when search yields no results', async () => {
		mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } } as any);

		const result = await new TmdbProvider('token').fetch('Nonexistent', 'movie');

		expect(result).toBeNull();
	});

	it('returns null and logs on network error', async () => {
		mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));

		const result = await new TmdbProvider('token').fetch('The Matrix', 'movie');

		expect(result).toBeNull();
	});
});

describe('OmdbProvider', () => {
	beforeEach(() => jest.clearAllMocks());

	it('returns null when API key is not set', async () => {
		const provider = new OmdbProvider(undefined);
		expect(await provider.fetch('The Matrix', 'movie')).toBeNull();
	});

	it('passes type=movie for movie lookups', async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				Response: 'True',
				Title: 'The Matrix',
				Plot: 'A hacker.',
				Year: '1999',
				Genre: 'Action',
				Ratings: [{ Value: '8.7/10' }],
				imdbID: 'tt0133093',
				Language: 'English',
			},
		} as any);

		await new OmdbProvider('key').fetch('The Matrix', 'movie');

		expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('&type=movie&'));
	});

	it('passes type=series for show lookups', async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				Response: 'True',
				Title: 'Severance',
				Plot: 'Office workers.',
				Year: '2022–',
				Genre: 'Drama',
				Ratings: [{ Value: '8.7/10' }],
				imdbID: 'tt11280740',
				Language: 'English',
			},
		} as any);

		await new OmdbProvider('key').fetch('Severance', 'show');

		expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('&type=series&'));
	});

	it('parses year with en-dash (2022–)', async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				Response: 'True',
				Title: 'Severance',
				Plot: 'Office workers.',
				Year: '2022–',
				Genre: 'Drama',
				Ratings: [{ Value: '8.7/10' }],
				imdbID: 'tt11280740',
			},
		} as any);

		const result = await new OmdbProvider('key').fetch('Severance', 'show');

		expect(result?.year).toBe(2022);
	});

	it('parses year with ASCII hyphen range (2022-2024)', async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				Response: 'True',
				Title: 'Some Show',
				Plot: 'A show.',
				Year: '2022-2024',
				Genre: 'Drama',
				Ratings: [],
				imdbID: 'tt1234567',
			},
		} as any);

		const result = await new OmdbProvider('key').fetch('Some Show', 'show');

		expect(result?.year).toBe(2022);
	});

	it('parses plain year string (1999)', async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				Response: 'True',
				Title: 'The Matrix',
				Plot: 'A hacker.',
				Year: '1999',
				Genre: 'Action',
				Ratings: [{ Value: '8.7/10' }],
				imdbID: 'tt0133093',
			},
		} as any);

		const result = await new OmdbProvider('key').fetch('The Matrix', 'movie');

		expect(result?.year).toBe(1999);
	});

	it('returns null when OMDB responds with Response=False', async () => {
		mockedAxios.get.mockResolvedValueOnce({ data: { Response: 'False' } } as any);

		const result = await new OmdbProvider('key').fetch('Nonexistent', 'movie');

		expect(result).toBeNull();
	});

	it('filters out N/A poster', async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				Response: 'True',
				Title: 'Test',
				Plot: 'Test.',
				Year: '2020',
				Genre: 'Drama',
				Ratings: [],
				imdbID: 'tt0000001',
				Poster: 'N/A',
			},
		} as any);

		const result = await new OmdbProvider('key').fetch('Test', 'movie');

		expect(result?.posterUrl).toBeNull();
	});

	it('returns null and logs on network error', async () => {
		mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));

		const result = await new OmdbProvider('key').fetch('The Matrix', 'movie');

		expect(result).toBeNull();
	});
});

describe('ImdbProvider', () => {
	beforeEach(() => jest.clearAllMocks());

	it('searches and fetches details from imdb.ashish.me', async () => {
		mockedAxios.get
			.mockResolvedValueOnce({
				data: { results: [{ id: 'tt0133093', year: 1999 }] },
			} as any)
			.mockResolvedValueOnce({
				data: {
					id: 'tt0133093',
					title: 'The Matrix',
					plot: 'A hacker discovers reality.',
					genre: ['Action', 'Sci-Fi'],
					rating: { star: 8.7 },
					spokenLanguages: [{ language: 'English' }],
				},
			} as any);

		const result = await new ImdbProvider().fetch('The Matrix', 'movie');

		expect(result).toEqual({
			title: 'The Matrix',
			description: 'A hacker discovers reality.',
			language: 'English',
			year: 1999,
			genre: 'Action, Sci-Fi',
			rating: 8.7,
			imdbId: 'tt0133093',
			tmdbId: null,
			posterUrl: null,
		});
	});

	it('returns null when search yields no results', async () => {
		mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } } as any);

		const result = await new ImdbProvider().fetch('Nonexistent', 'movie');

		expect(result).toBeNull();
	});

	it('returns null and logs on network error', async () => {
		mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));

		const result = await new ImdbProvider().fetch('The Matrix', 'movie');

		expect(result).toBeNull();
	});

	it('falls back to Unknown language when no spoken languages', async () => {
		mockedAxios.get
			.mockResolvedValueOnce({ data: { results: [{ id: 'tt1', year: 2020 }] } } as any)
			.mockResolvedValueOnce({
				data: { id: 'tt1', title: 'Test', plot: '', genre: [], rating: {} },
			} as any);

		const result = await new ImdbProvider().fetch('Test', 'movie');

		expect(result?.language).toBe('Unknown');
	});
});
