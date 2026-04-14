import { BulkImportService } from './bulk-import.service';
import { ImportJob } from './types';
import axios from 'axios';

jest.mock('axios');

const waitForJobToFinish = async (service: BulkImportService, jobId: string): Promise<void> => {
	for (let i = 0; i < 100; i += 1) {
		const job = await service.getJob(jobId);
		if (job && (job.status === 'completed' || job.status === 'partial' || job.status === 'failed')) {
			return;
		}
		await new Promise(resolve => setTimeout(resolve, 10));
	}
	throw new Error('Timed out waiting for job completion');
};

const DEFAULT_MISSING_METADATA_FIELDS = ['posterUrl', 'tmdbId', 'language', 'genre', 'description', 'year', 'imdbRating'] as const;

describe('BulkImportService', () => {
	const mockedAxios = axios as jest.Mocked<typeof axios>;
	const createConfigServiceMock = (options?: { upstreamApiKey?: string; tmdbApiKey?: string; omdbApiKey?: string }) =>
		({
			get: jest.fn((key: string) => {
				if (key === 'ASHISHDOTME_TOKEN') {
					return options?.upstreamApiKey;
				}
				if (key === 'TMDB_API_KEY') {
					return options?.tmdbApiKey;
				}
				if (key === 'OMDB') {
					return options?.omdbApiKey;
				}
				return undefined;
			}),
		}) as any;

	afterEach(() => {
		process.env.BULK_IMPORT_REMOTE_DEDUPE = 'false';
		mockedAxios.get.mockReset();
		mockedAxios.patch.mockReset();
	});

	const createRepositoryMock = () => {
		const store = new Map<string, ImportJob>();
		return {
			save: jest.fn(async (job: ImportJob) => {
				store.set(job.id, JSON.parse(JSON.stringify(job)));
			}),
			get: jest.fn(async (jobId: string) => store.get(jobId) ?? null),
			listJobs: jest.fn(async (limit = 25, offset = 0) => {
				const jobs = Array.from(store.values())
					.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
					.slice(offset, offset + limit)
					.map(job => ({
						id: job.id,
						type: job.type,
						source: job.source,
						status: job.status,
						fileName: job.fileName,
						totalRows: job.totalRows,
						processedRows: job.processedRows,
						successRows: job.successRows,
						failedRows: job.failedRows,
						skippedRows: job.skippedRows,
						createdAt: job.createdAt,
						updatedAt: job.updatedAt,
						startedAt: job.startedAt,
						completedAt: job.completedAt,
						recentErrors: job.rows
							.filter(row => row.status === 'failed')
							.slice(-20)
							.map(row => ({ rowNumber: row.rowNumber, errorCode: row.errorCode, errorMessage: row.errorMessage })),
					}));
				return { total: store.size, jobs };
			}),
			getRows: jest.fn(async (jobId: string, status?: string, limit = 50, offset = 0) => {
				const job = store.get(jobId);
				if (!job) {
					return null;
				}
				const filteredRows = status ? job.rows.filter(row => row.status === status) : job.rows;
				return {
					total: filteredRows.length,
					rows: filteredRows.slice(offset, offset + limit),
				};
			}),
		};
	};

	const createMatrixMovieRecord = (overrides: Record<string, unknown> = {}) => ({
		id: 'movie-1',
		title: 'The Matrix',
		imdbId: 'tt0133093',
		posterUrl: null,
		tmdbId: null,
		language: 'French',
		genre: 'Action',
		description: 'Old plot',
		year: 1998,
		imdbRating: 6.1,
		...overrides,
	});

	const mockMatrixMetadataLookups = (options?: {
		movieRecord?: Record<string, unknown>;
		tmdbFindResult?: Record<string, unknown>;
		tmdbMovieResult?: Record<string, unknown>;
		omdbResult?: Record<string, unknown>;
	}) => {
		mockedAxios.get.mockImplementation(async (url: string) => {
			if (url === 'https://api.ashish.me/movies') {
				return {
					data: [options?.movieRecord ?? createMatrixMovieRecord()],
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/find/tt0133093') {
				return {
					data: {
						movie_results: [options?.tmdbFindResult ?? { id: 603, poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg' }],
					},
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/movie/603') {
				return {
					data: options?.tmdbMovieResult ?? {
						id: 603,
						title: 'The Matrix',
						overview: 'A hacker learns the truth about reality.',
						original_language: 'en',
						genres: [
							{ id: 28, name: 'Action' },
							{ id: 878, name: 'Science Fiction' },
						],
						release_date: '1999-03-31',
						imdb_id: 'tt0133093',
						poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
					},
				} as any;
			}
			if (typeof url === 'string' && url.startsWith('http://www.omdbapi.com/')) {
				return {
					data: options?.omdbResult ?? {
						Response: 'True',
						Title: 'The Matrix',
						Plot: 'A hacker learns the truth about reality.',
						Year: '1999',
						Genre: 'Action, Science Fiction',
						Language: 'English',
						imdbID: 'tt0133093',
						imdbRating: '8.7',
						Poster: 'https://m.media-amazon.com/images/M/MV5BM.png',
					},
				} as any;
			}
			throw new Error(`Unexpected GET ${url}`);
		});
	};

	const createMatrixShowRecord = (overrides: Record<string, unknown> = {}) => ({
		id: 'show-1',
		title: 'Severance',
		imdbId: 'tt11280740',
		posterUrl: null,
		tmdbId: null,
		language: 'French',
		genre: 'Drama',
		description: 'Old plot',
		year: 2022,
		imdbRating: 6.1,
		releaseStartYear: 2022,
		...overrides,
	});

	const mockMatrixShowMetadataLookups = (options?: {
		showRecord?: Record<string, unknown>;
		tmdbFindResult?: Record<string, unknown>;
		tmdbShowResult?: Record<string, unknown>;
		tmdbSearchResult?: Record<string, unknown>;
		omdbResult?: Record<string, unknown>;
	}) => {
		mockedAxios.get.mockImplementation(async (url: string) => {
			if (url === 'https://api.ashish.me/shows') {
				return {
					data: [options?.showRecord ?? createMatrixShowRecord()],
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/find/tt11280740') {
				return {
					data: {
						tv_results: [options?.tmdbFindResult ?? { id: 95396, poster_path: '/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg' }],
					},
				} as any;
			}
			if (typeof url === 'string' && url.startsWith('https://api.themoviedb.org/3/search/tv')) {
				return {
					data: {
						results: [options?.tmdbSearchResult ?? { id: 95396, poster_path: '/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg' }],
					},
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/tv/95396') {
				return {
					data: options?.tmdbShowResult ?? {
						id: 95396,
						name: 'Severance',
						overview: 'Office workers undergo a surgical procedure.',
						original_language: 'en',
						genres: [
							{ id: 18, name: 'Drama' },
							{ id: 9648, name: 'Mystery' },
						],
						first_air_date: '2022-02-18',
						poster_path: '/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
						external_ids: { imdb_id: 'tt11280740' },
					},
				} as any;
			}
			if (typeof url === 'string' && url.startsWith('http://www.omdbapi.com/')) {
				return {
					data: options?.omdbResult ?? {
						Response: 'True',
						Title: 'Severance',
						Plot: 'Office workers undergo a surgical procedure.',
						Year: '2022',
						Genre: 'Drama, Mystery',
						Language: 'English',
						imdbID: 'tt11280740',
						imdbRating: '8.7',
						Poster: 'https://m.media-amazon.com/images/M/show.png',
					},
				} as any;
			}
			throw new Error(`Unexpected GET ${url}`);
		});
	};

	it('imports valid CSV in dryRun mode and skips duplicates in file', async () => {
		const moviesService = {
			create: jest.fn().mockResolvedValue({ id: 'movie-1' }),
		};
		const repository = createRepositoryMock();
		const service = new BulkImportService(moviesService as any, repository as any, createConfigServiceMock());

		const csv = ['Date,Name,Year,Letterboxd URI', '2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8', '2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8'].join('\n');

		const job = await service.createMoviesImport(Buffer.from(csv), 'movies.csv', 'test-key', {
			source: 'letterboxd',
			dryRun: true,
			skipDuplicates: true,
		});

		await waitForJobToFinish(service, job.id);

		const summary = await service.getJob(job.id);
		expect(summary?.kind).toBe('import_movies');
		expect(summary?.status).toBe('completed');
		expect(summary?.successRows).toBe(1);
		expect(summary?.skippedRows).toBe(1);
		expect(moviesService.create).not.toHaveBeenCalled();
	});

	it('marks invalid rows as failed', async () => {
		const moviesService = {
			create: jest.fn().mockResolvedValue({ id: 'movie-1' }),
		};
		const repository = createRepositoryMock();
		const service = new BulkImportService(moviesService as any, repository as any, createConfigServiceMock());

		const csv = ['Date,Name,Year,Letterboxd URI', '2026-02-08,,2012,https://boxd.it/2ZA8'].join('\n');

		const job = await service.createMoviesImport(Buffer.from(csv), 'movies.csv', 'test-key', {
			source: 'letterboxd',
			dryRun: false,
			skipDuplicates: true,
		});

		await waitForJobToFinish(service, job.id);

		const rowsResult = await service.getJobRows(job.id);
		expect(rowsResult?.rows[0].status).toBe('failed');
		expect(rowsResult?.rows[0].errorCode).toBe('INVALID_TITLE');
		expect(moviesService.create).not.toHaveBeenCalled();
	});

	it('throws on missing required headers', () => {
		const moviesService = {
			create: jest.fn().mockResolvedValue({ id: 'movie-1' }),
		};
		const repository = createRepositoryMock();
		const service = new BulkImportService(moviesService as any, repository as any, createConfigServiceMock());

		const csv = ['Date,Title,Year,Link', '2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8'].join('\n');

		return expect(
			service.createMoviesImport(Buffer.from(csv), 'movies.csv', 'test-key', {
				source: 'letterboxd',
				dryRun: false,
				skipDuplicates: true,
			}),
		).rejects.toThrow('Missing required headers');
	});

	it('skips rows that already exist in api.ashish.me when remote dedupe is enabled', async () => {
		process.env.BULK_IMPORT_REMOTE_DEDUPE = 'true';
		mockedAxios.get.mockResolvedValue({
			data: [{ title: 'Pride & Prejudice', viewingDate: '2026-02-08' }],
		});

		const moviesService = {
			create: jest.fn().mockResolvedValue({ id: 'movie-1' }),
		};
		const repository = createRepositoryMock();
		const service = new BulkImportService(moviesService as any, repository as any, createConfigServiceMock());

		const csv = ['Date,Name,Year,Letterboxd URI', '2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8'].join('\n');

		const job = await service.createMoviesImport(Buffer.from(csv), 'movies.csv', 'test-key', {
			source: 'letterboxd',
			dryRun: false,
			skipDuplicates: true,
		});

		await waitForJobToFinish(service, job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(rowsResult?.rows[0].status).toBe('skipped');
		expect(rowsResult?.rows[0].errorCode).toBe('DUPLICATE_REMOTE');
		expect(moviesService.create).not.toHaveBeenCalled();
	});

	it('generates random watch dates after release year and after 2009', async () => {
		const moviesService = {
			create: jest.fn().mockResolvedValue({ id: 'movie-1' }),
		};
		const repository = createRepositoryMock();
		const service = new BulkImportService(moviesService as any, repository as any, createConfigServiceMock());

		const csv = [
			'Date,Name,Year,Letterboxd URI',
			'2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8',
			'2026-02-08,The Perks of Being a Wallflower,2012,https://boxd.it/2ZA8',
		].join('\n');

		const job = await service.createMoviesImport(Buffer.from(csv), 'movies.csv', 'test-key', {
			source: 'letterboxd',
			dryRun: true,
			skipDuplicates: false,
		});

		await waitForJobToFinish(service, job.id);
		const rowsResult = await service.getJobRows(job.id);
		expect(rowsResult?.rows).toHaveLength(2);
		const jobsResult = await service.listJobs();
		expect(jobsResult.jobs).toEqual([expect.objectContaining({ id: job.id, kind: 'import_movies', type: 'movies' })]);

		const pride = rowsResult!.rows[0].normalizedPayload as { date: string };
		const perks = rowsResult!.rows[1].normalizedPayload as { date: string };

		const prideYear = new Date(pride.date).getUTCFullYear();
		const perksYear = new Date(perks.date).getUTCFullYear();

		expect(prideYear).toBeGreaterThanOrEqual(2010);
		expect(perksYear).toBeGreaterThanOrEqual(2013);
	});

	it('creates a movie metadata backfill job from selected ids', async () => {
		mockMatrixMetadataLookups({
			movieRecord: { id: 'movie-1', title: 'The Matrix', imdbId: 'tt0133093', posterUrl: null, tmdbId: null },
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const moviesService = {
			create: jest.fn(),
		};
		const repository = createRepositoryMock();
		const service = new BulkImportService(moviesService as any, repository as any, createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token' }));

		const job = await service.createMovieMetadataBackfill('test-key', {
			movieIds: ['movie-1'],
		});
		await waitForJobToFinish(service, job.id);
		const summary = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(job).toEqual(
			expect.objectContaining({
				kind: 'backfill_movie_metadata',
				type: 'movies',
				source: 'metadata',
				status: 'queued',
				totalRows: 1,
			}),
		);
		expect(summary).toEqual(expect.objectContaining({ status: 'completed', successRows: 1, failedRows: 0 }));
		expect(rowsResult?.rows).toEqual([
			expect.objectContaining({
				status: 'success',
				rawPayload: expect.objectContaining({ id: 'movie-1', title: 'The Matrix' }),
				normalizedPayload: expect.objectContaining({
					entityId: 'movie-1',
					entityType: 'movie',
					missingFields: expect.arrayContaining([...DEFAULT_MISSING_METADATA_FIELDS]),
					title: 'The Matrix',
				}),
			}),
		]);
		expect(mockedAxios.get).toHaveBeenCalledWith('https://api.ashish.me/movies', {
			headers: { apiKey: 'server-key' },
			timeout: 15000,
		});
		const [moviePatchUrl, moviePatchPayload, moviePatchConfig] = mockedAxios.patch.mock.calls[0];
		expect(moviePatchUrl).toBe('https://api.ashish.me/movies/movie-1');
		expect(moviePatchPayload).toEqual({
			description: 'A hacker learns the truth about reality.',
			genre: 'Action, Science Fiction',
			language: 'English',
			posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
			tmdbId: 603,
			year: 1999,
		});
		expect(moviePatchConfig).toEqual({ headers: { apiKey: 'server-key' }, timeout: 15000 });
	});

	it('patches only the canonical fields returned by providers for partial movie metadata', async () => {
		mockMatrixMetadataLookups({
			movieRecord: createMatrixMovieRecord(),
			tmdbMovieResult: {
				id: 603,
				title: 'The Matrix',
				poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
			},
			omdbResult: {
				Response: 'True',
				imdbID: 'tt0133093',
				imdbRating: '8.7',
			},
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token', omdbApiKey: 'omdb-token' }),
		);

		const job = await service.createMovieMetadataBackfill('test-key', {
			movieIds: ['movie-1'],
		});
		await waitForJobToFinish(service, job.id);
		const summary = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(summary).toEqual(expect.objectContaining({ status: 'completed', successRows: 1, failedRows: 0 }));
		expect(rowsResult?.rows[0]).toEqual(expect.objectContaining({ status: 'success', targetRecordId: 'movie-1' }));
		expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
		expect(mockedAxios.get.mock.calls.some(([url]) => url === 'https://api.themoviedb.org/3/movie/603')).toBe(true);
		const [partialPatchUrl, partialPatchPayload, partialPatchConfig] = mockedAxios.patch.mock.calls[0];
		expect(partialPatchUrl).toBe('https://api.ashish.me/movies/movie-1');
		expect(partialPatchPayload).toEqual({
			posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
			tmdbId: 603,
			imdbRating: 8.7,
		});
		expect(partialPatchConfig).toEqual({ headers: { apiKey: 'server-key' }, timeout: 15000 });
	});

	it('preserves posterUrl and tmdbId-only reconciliation through the generalized movie backfill path', async () => {
		mockMatrixMetadataLookups({
			movieRecord: {
				id: 'movie-1',
				title: 'The Matrix',
				imdbId: 'tt0133093',
				posterUrl: null,
				tmdbId: null,
				language: 'English',
				genre: 'Action, Science Fiction',
				description: 'A hacker learns the truth about reality.',
				year: 1999,
				imdbRating: 8.7,
			},
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token' }),
		);

		const job = await service.createMovieMetadataBackfill('test-key', {
			movieIds: ['movie-1'],
		});
		await waitForJobToFinish(service, job.id);

		expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
		const [, preservedPatchPayload] = mockedAxios.patch.mock.calls[0];
		expect(preservedPatchPayload).toEqual({
			posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
			tmdbId: 603,
		});
	});

	it('reconciles drifted movie metadata from canonical provider data', async () => {
		mockMatrixMetadataLookups({
			movieRecord: createMatrixMovieRecord(),
			tmdbMovieResult: {
				id: 603,
				title: 'The Matrix',
				overview: 'A hacker learns the truth about reality.',
				original_language: 'en',
				genres: [
					{ id: 28, name: 'Action' },
					{ id: 878, name: 'Science Fiction' },
				],
				release_date: '1999-03-31',
				imdb_id: 'tt0133093',
				poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
			},
			omdbResult: {
				Response: 'True',
				Title: 'The Matrix',
				Plot: 'A hacker learns the truth about reality.',
				Year: '1999',
				Genre: 'Action, Science Fiction',
				Language: 'English',
				imdbID: 'tt0133093',
				imdbRating: '8.7',
				Poster: 'https://m.media-amazon.com/images/M/MV5BM.png',
			},
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token', omdbApiKey: 'omdb-token' }),
		);

		const job = await service.createMovieMetadataBackfill('test-key', {
			movieIds: ['movie-1'],
		});
		await waitForJobToFinish(service, job.id);
		const summary = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(summary).toEqual(expect.objectContaining({ status: 'completed', successRows: 1, failedRows: 0 }));
		expect(rowsResult?.rows[0]).toEqual(
			expect.objectContaining({
				status: 'success',
				normalizedPayload: expect.objectContaining({
					entityId: 'movie-1',
					entityType: 'movie',
					title: 'The Matrix',
				}),
			}),
		);
		expect(mockedAxios.get.mock.calls.some(([url]) => url === 'https://api.themoviedb.org/3/movie/603')).toBe(true);
		expect(mockedAxios.get.mock.calls.some(([url]) => typeof url === 'string' && url.startsWith('http://www.omdbapi.com/?i=tt0133093'))).toBe(true);
		expect(mockedAxios.patch).toHaveBeenCalledWith(
			'https://api.ashish.me/movies/movie-1',
			expect.objectContaining({
				posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
				tmdbId: 603,
				language: 'English',
				genre: 'Action, Science Fiction',
				description: 'A hacker learns the truth about reality.',
				year: 1999,
				imdbRating: 8.7,
			}),
			{ headers: { apiKey: 'server-key' }, timeout: 15000 },
		);
	});

	it('skips unchanged movie rows without emitting a backfill error', async () => {
		mockMatrixMetadataLookups({
			movieRecord: {
				id: 'movie-1',
				title: 'The Matrix',
				imdbId: 'tt0133093',
				posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
				tmdbId: 603,
				language: 'English',
				genre: 'Action, Science Fiction',
				description: 'A hacker learns the truth about reality.',
				year: 1999,
				imdbRating: 8.7,
			},
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token' }),
		);

		const job = await service.createMovieMetadataBackfill('test-key', {
			movieIds: ['movie-1'],
		});
		await waitForJobToFinish(service, job.id);
		const summary = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(summary).toEqual(expect.objectContaining({ status: 'completed', successRows: 0, skippedRows: 1, failedRows: 0 }));
		expect(rowsResult?.rows[0]).toEqual(expect.objectContaining({ status: 'skipped', targetRecordId: 'movie-1' }));
		expect(mockedAxios.patch).not.toHaveBeenCalled();
	});

	it('reconciles drifted show metadata from canonical provider data', async () => {
		mockMatrixShowMetadataLookups({
			showRecord: createMatrixShowRecord(),
			tmdbShowResult: {
				id: 95396,
				name: 'Severance',
				overview: 'Office workers undergo a surgical procedure.',
				original_language: 'en',
				genres: [
					{ id: 18, name: 'Drama' },
					{ id: 9648, name: 'Mystery' },
				],
				first_air_date: '2022-02-18',
				poster_path: '/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
				external_ids: { imdb_id: 'tt11280740' },
			},
			omdbResult: {
				Response: 'True',
				Title: 'Severance',
				Plot: 'Office workers undergo a surgical procedure.',
				Year: '2022',
				Genre: 'Drama, Mystery',
				Language: 'English',
				imdbID: 'tt11280740',
				imdbRating: '8.7',
				Poster: 'https://m.media-amazon.com/images/M/show.png',
			},
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token', omdbApiKey: 'omdb-token' }),
		);

		const job = await service.createShowMetadataBackfill('test-key', {
			showIds: ['show-1'],
		});
		await waitForJobToFinish(service, job.id);
		const summary = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(summary).toEqual(expect.objectContaining({ status: 'completed', successRows: 1, failedRows: 0 }));
		expect(rowsResult?.rows[0]).toEqual(
			expect.objectContaining({
				status: 'success',
				normalizedPayload: expect.objectContaining({
					entityId: 'show-1',
					entityType: 'show',
					title: 'Severance',
				}),
			}),
		);
		expect(mockedAxios.get.mock.calls.some(([url]) => url === 'https://api.themoviedb.org/3/tv/95396')).toBe(true);
		expect(mockedAxios.get.mock.calls.some(([url]) => typeof url === 'string' && url.startsWith('http://www.omdbapi.com/?i=tt11280740'))).toBe(true);
		expect(mockedAxios.patch).toHaveBeenCalledWith(
			'https://api.ashish.me/shows/show-1',
			expect.objectContaining({
				posterUrl: 'https://image.tmdb.org/t/p/w500/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
				tmdbId: 95396,
				language: 'English',
				genre: 'Drama, Mystery',
				description: 'Office workers undergo a surgical procedure.',
				imdbRating: 8.7,
			}),
			{ headers: { apiKey: 'server-key' }, timeout: 15000 },
		);
	});

	it('patches only posterUrl and tmdbId for show reconciliation when those are the only missing fields', async () => {
		mockMatrixShowMetadataLookups({
			showRecord: {
				id: 'show-1',
				title: 'Severance',
				imdbId: 'tt11280740',
				posterUrl: null,
				tmdbId: null,
				language: 'English',
				genre: 'Drama, Mystery',
				description: 'Office workers undergo a surgical procedure.',
				year: 2022,
				imdbRating: 8.7,
				releaseStartYear: 2022,
			},
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token', omdbApiKey: 'omdb-token' }),
		);

		const job = await service.createShowMetadataBackfill('test-key', {
			showIds: ['show-1'],
		});
		await waitForJobToFinish(service, job.id);

		expect(mockedAxios.patch).toHaveBeenCalledTimes(1);
		const [, showPatchPayload] = mockedAxios.patch.mock.calls[0];
		expect(showPatchPayload).toEqual({
			posterUrl: 'https://image.tmdb.org/t/p/w500/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
			tmdbId: 95396,
		});
	});

	it('handles title fallback when show imdbId is absent', async () => {
		mockMatrixShowMetadataLookups({
			showRecord: {
				id: 'show-1',
				title: 'Severance',
				posterUrl: null,
				tmdbId: null,
				language: 'French',
				genre: 'Drama',
				description: 'Old plot',
				year: 2022,
				imdbRating: 6.1,
				releaseStartYear: 2022,
			},
			tmdbShowResult: {
				id: 95396,
				name: 'Severance',
				overview: 'Office workers undergo a surgical procedure.',
				original_language: 'en',
				genres: [
					{ id: 18, name: 'Drama' },
					{ id: 9648, name: 'Mystery' },
				],
				first_air_date: '2022-02-18',
				poster_path: '/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
			},
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token', omdbApiKey: 'omdb-token' }),
		);

		const job = await service.createShowMetadataBackfill('test-key', {
			showIds: ['show-1'],
		});
		await waitForJobToFinish(service, job.id);

		const searchCalls = mockedAxios.get.mock.calls.filter(([url]) => typeof url === 'string' && url.includes('/search/tv'));
		expect(searchCalls.length).toBeGreaterThan(0);
		expect(mockedAxios.get.mock.calls.some(([url]) => url === 'https://api.themoviedb.org/3/find/tt11280740')).toBe(false);
		expect(mockedAxios.get.mock.calls.some(([url]) => url === 'https://api.themoviedb.org/3/tv/95396')).toBe(true);
		expect(mockedAxios.get.mock.calls.some(([url]) => typeof url === 'string' && url.startsWith('http://www.omdbapi.com/?t=Severance'))).toBe(true);
		expect(mockedAxios.get.mock.calls.some(([url]) => typeof url === 'string' && url.startsWith('http://www.omdbapi.com/?i='))).toBe(false);
		expect(mockedAxios.patch).toHaveBeenCalledWith(
			'https://api.ashish.me/shows/show-1',
			expect.objectContaining({
				posterUrl: 'https://image.tmdb.org/t/p/w500/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
				tmdbId: 95396,
				language: 'English',
				genre: 'Drama, Mystery',
				description: 'Office workers undergo a surgical procedure.',
				imdbRating: 8.7,
				imdbId: 'tt11280740',
			}),
			{ headers: { apiKey: 'server-key' }, timeout: 15000 },
		);
	});

	it('skips unchanged show rows without emitting a backfill error', async () => {
		mockMatrixShowMetadataLookups({
			showRecord: {
				id: 'show-1',
				title: 'Severance',
				imdbId: 'tt11280740',
				posterUrl: 'https://image.tmdb.org/t/p/w500/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
				tmdbId: 95396,
				language: 'English',
				genre: 'Drama, Mystery',
				description: 'Office workers undergo a surgical procedure.',
				year: 2022,
				imdbRating: 8.7,
				releaseStartYear: 2022,
			},
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token' }),
		);

		const job = await service.createShowMetadataBackfill('test-key', {
			showIds: ['show-1'],
		});
		await waitForJobToFinish(service, job.id);
		const summary = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(summary).toEqual(expect.objectContaining({ status: 'completed', successRows: 0, skippedRows: 1, failedRows: 0 }));
		expect(rowsResult?.rows[0]).toEqual(expect.objectContaining({ status: 'skipped', targetRecordId: 'show-1' }));
		expect(mockedAxios.patch).not.toHaveBeenCalled();
	});

	it('creates a movie metadata backfill job from an all-filtered selection', async () => {
		mockedAxios.get.mockResolvedValue({
			data: [
				{ id: 'movie-1', title: 'The Matrix', posterUrl: null, tmdbId: null },
				{ id: 'movie-2', title: 'Heat', posterUrl: 'https://example.com/heat.jpg', tmdbId: 949 },
			],
		} as any);

		const repository = createRepositoryMock();
		const service = new BulkImportService({ create: jest.fn() } as any, repository as any, createConfigServiceMock());

		const job = await service.createMovieMetadataBackfill('test-key', {
			allFiltered: true,
			filters: {
				search: 'matrix',
				missingFields: ['posterUrl'],
			},
		});
		const rowsResult = await service.getJobRows(job.id);

		expect(job.totalRows).toBe(1);
		expect(rowsResult?.rows).toEqual([expect.objectContaining({ normalizedPayload: expect.objectContaining({ title: 'The Matrix' }) })]);
	});

	it('retryFailedRows resets failed movie metadata backfill rows to pending without running imports', async () => {
		mockedAxios.get.mockResolvedValue({
			data: [],
		} as any);

		const moviesService = {
			create: jest.fn(),
		};
		const repository = createRepositoryMock();
		const service = new BulkImportService(moviesService as any, repository as any, createConfigServiceMock({ tmdbApiKey: 'tmdb-token' }));

		const job = await service.createMovieMetadataBackfill('test-key', {
			movieIds: ['missing-movie'],
		});
		const retried = await service.retryFailedRows(job.id, 'test-key', {
			dryRun: false,
			skipDuplicates: true,
		});
		await waitForJobToFinish(service, job.id);
		const finalJob = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(job).toEqual(expect.objectContaining({ kind: 'backfill_movie_metadata', failedRows: 1, status: 'failed' }));
		expect(retried).toEqual(expect.objectContaining({ kind: 'backfill_movie_metadata', failedRows: 0, status: 'queued' }));
		expect(finalJob).toEqual(expect.objectContaining({ kind: 'backfill_movie_metadata', failedRows: 1, status: 'failed' }));
		expect(rowsResult?.rows).toEqual([expect.objectContaining({ status: 'failed', attemptCount: 1 })]);
		expect(moviesService.create).not.toHaveBeenCalled();
	});

	it('creates a show metadata backfill job from selected ids', async () => {
		mockedAxios.get.mockImplementation(async (url: string) => {
			if (url === 'https://api.ashish.me/shows') {
				return {
					data: [{ id: 'show-1', title: 'Severance', imdbId: 'tt11280740', posterUrl: null, tmdbId: null }],
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/find/tt11280740') {
				return {
					data: {
						tv_results: [{ id: 95396, poster_path: '/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg' }],
					},
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/tv/95396') {
				return {
					data: {
						id: 95396,
						name: 'Severance',
						overview: 'Office workers undergo a surgical procedure.',
						original_language: 'en',
						genres: [
							{ id: 18, name: 'Drama' },
							{ id: 9648, name: 'Mystery' },
						],
						first_air_date: '2022-02-18',
						poster_path: '/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
						external_ids: { imdb_id: 'tt11280740' },
					},
				} as any;
			}
			throw new Error(`Unexpected GET ${url}`);
		});
		mockedAxios.patch.mockResolvedValue({ data: {} } as any);

		const service = new BulkImportService(
			{ create: jest.fn() } as any,
			createRepositoryMock() as any,
			createConfigServiceMock({ upstreamApiKey: 'server-key', tmdbApiKey: 'tmdb-token' }),
		);

		const job = await service.createShowMetadataBackfill('test-key', {
			showIds: ['show-1'],
		});
		await waitForJobToFinish(service, job.id);
		const summary = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(job).toEqual(expect.objectContaining({ kind: 'backfill_show_metadata', type: 'shows', source: 'metadata', status: 'queued', totalRows: 1 }));
		expect(rowsResult?.rows).toEqual([
			expect.objectContaining({
				status: 'success',
				normalizedPayload: expect.objectContaining({
					entityId: 'show-1',
					entityType: 'show',
					title: 'Severance',
					missingFields: expect.arrayContaining([...DEFAULT_MISSING_METADATA_FIELDS]),
				}),
			}),
		]);
		expect(summary).toEqual(expect.objectContaining({ status: 'completed', successRows: 1, failedRows: 0 }));
		expect(mockedAxios.get).toHaveBeenCalledWith('https://api.ashish.me/shows', {
			headers: { apiKey: 'server-key' },
			timeout: 15000,
		});
		expect(mockedAxios.patch).toHaveBeenCalledWith(
			'https://api.ashish.me/shows/show-1',
			{
				description: 'Office workers undergo a surgical procedure.',
				genre: 'Drama, Mystery',
				language: 'English',
				posterUrl: 'https://image.tmdb.org/t/p/w500/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
				tmdbId: 95396,
				year: 2022,
			},
			{ headers: { apiKey: 'server-key' }, timeout: 15000 },
		);
	});

	it('retryFailedRows resets failed show metadata backfill rows to pending', async () => {
		mockedAxios.get.mockResolvedValue({
			data: [],
		} as any);

		const service = new BulkImportService({ create: jest.fn() } as any, createRepositoryMock() as any, createConfigServiceMock({ tmdbApiKey: 'tmdb-token' }));

		const job = await service.createShowMetadataBackfill('test-key', {
			showIds: ['missing-show'],
		});
		const retried = await service.retryFailedRows(job.id, 'test-key', {
			dryRun: false,
			skipDuplicates: true,
		});
		await waitForJobToFinish(service, job.id);
		const finalJob = await service.getJob(job.id);
		const rowsResult = await service.getJobRows(job.id);

		expect(job).toEqual(expect.objectContaining({ kind: 'backfill_show_metadata', failedRows: 1, status: 'failed' }));
		expect(retried).toEqual(expect.objectContaining({ kind: 'backfill_show_metadata', failedRows: 0, status: 'queued' }));
		expect(finalJob).toEqual(expect.objectContaining({ kind: 'backfill_show_metadata', failedRows: 1, status: 'failed' }));
		expect(rowsResult?.rows).toEqual([expect.objectContaining({ status: 'failed', attemptCount: 1 })]);
	});
});
