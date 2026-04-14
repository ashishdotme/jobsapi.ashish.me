import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import axios from 'axios';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { API_KEY_INVALID_MESSAGE, API_KEY_MISSING_MESSAGE } from './../src/common/auth';

describe('AppController (e2e)', () => {
	let app: NestExpressApplication;
	const originalApiKeys = process.env.ASHISHDOTME_TOKEN;
	const originalAshishToken = process.env.ASHISHDOTME_TOKEN;
	const originalTmdbApiKey = process.env.TMDB_API_KEY;

	const waitForJobToFinish = async (jobId: string) => {
		for (let attempt = 0; attempt < 100; attempt += 1) {
			const response = await request(app.getHttpServer()).get(`/ops/jobs/${jobId}`).set('apiKey', 'valid-key');
			if (response.body.status !== 'queued' && response.body.status !== 'processing') {
				return response.body;
			}
			await new Promise(resolve => setTimeout(resolve, 20));
		}

		throw new Error(`Timed out waiting for job ${jobId}`);
	};

	const createCompletedMovieJob = async () => {
		const response = await request(app.getHttpServer())
			.post('/ops/imports/movies')
			.set('apiKey', 'valid-key')
			.field('source', 'letterboxd')
			.field('dryRun', 'true')
			.field('skipDuplicates', 'true')
			.attach('file', Buffer.from(['Date,Name,Year,Letterboxd URI', '2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8'].join('\n')), 'movies.csv');

		const jobId = response.body.id;
		const job = await waitForJobToFinish(jobId);
		return { jobId, job };
	};

	beforeEach(async () => {
		process.env.ASHISHDOTME_TOKEN = 'valid-key';
		process.env.ASHISHDOTME_TOKEN = 'server-key';
		process.env.TMDB_API_KEY = 'tmdb-token';

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication<NestExpressApplication>();
		app.useLogger(app.get(Logger));
		configureApp(app);
		await app.init();
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		jest.useRealTimers();
		await app.close();
		process.env.ASHISHDOTME_TOKEN = originalApiKeys;
		process.env.ASHISHDOTME_TOKEN = originalAshishToken;
		process.env.TMDB_API_KEY = originalTmdbApiKey;
	});

	it('/ (GET)', () => {
		return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
	});

	it('returns a wildcard CORS header for requests with an origin', () => {
		return request(app.getHttpServer()).get('/').set('Origin', 'https://example.com').expect(200).expect('Access-Control-Allow-Origin', '*');
	});

	it('returns a generated request id for inbound requests', async () => {
		const response = await request(app.getHttpServer()).get('/').expect(200);

		expect(response.headers['x-request-id']).toEqual(expect.any(String));
	});

	it('/1/validate-token (GET) is public', () => {
		return request(app.getHttpServer()).get('/1/validate-token').expect(200).expect({
			code: 200,
			message: 'Token valid',
			valid: true,
		});
	});

	it('GET /movies returns all movies from api.ashish.me for authorized requests', async () => {
		const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
			data: [{ id: 1, title: 'The Matrix' }],
		} as any);

		await request(app.getHttpServer())
			.get('/movies')
			.set('apiKey', 'valid-key')
			.expect(200)
			.expect([{ id: 1, title: 'The Matrix' }]);

		expect(getSpy).toHaveBeenCalledWith('https://api.ashish.me/movies', {
			headers: {
				apiKey: 'server-key',
			},
		});
	});

	it('GET /shows returns all shows from api.ashish.me for authorized requests', async () => {
		const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
			data: [{ id: 1, title: 'Severance Season 1' }],
		} as any);

		await request(app.getHttpServer())
			.get('/shows')
			.set('apiKey', 'valid-key')
			.expect(200)
			.expect([{ id: 1, title: 'Severance Season 1' }]);

		expect(getSpy).toHaveBeenCalledWith('https://api.ashish.me/shows', {
			headers: {
				apiKey: 'server-key',
			},
		});
	});

	it('ops jobs routes return generalized import job summaries, job details, rows, and retry support', async () => {
		const { jobId, job } = await createCompletedMovieJob();

		const listResponse = await request(app.getHttpServer()).get('/ops/jobs').set('apiKey', 'valid-key');
		expect(listResponse.body).toEqual({
			total: expect.any(Number),
			jobs: expect.arrayContaining([expect.objectContaining({ id: jobId, kind: 'import_movies', status: expect.any(String) })]),
		});

		const detailResponse = await request(app.getHttpServer()).get(`/ops/jobs/${jobId}`).set('apiKey', 'valid-key');
		expect(detailResponse.body).toEqual(
			expect.objectContaining({
				id: jobId,
				kind: 'import_movies',
				status: expect.any(String),
			}),
		);

		const legacyDetailResponse = await request(app.getHttpServer()).get(`/bulk-import/jobs/${jobId}`).set('apiKey', 'valid-key');
		expect(legacyDetailResponse.body).toEqual(expect.objectContaining({ id: jobId, kind: 'import_movies', status: expect.any(String) }));

		const rowsResponse = await request(app.getHttpServer()).get(`/ops/jobs/${jobId}/rows`).set('apiKey', 'valid-key');
		expect(rowsResponse.body).toEqual({
			total: 1,
			rows: [
				expect.objectContaining({
					rowNumber: 2,
					status: 'success',
					attemptCount: expect.any(Number),
				}),
			],
		});

		expect(job.id).toBe(jobId);
	});

	it('ops retry-failed route remains available for failed import jobs', async () => {
		const createResponse = await request(app.getHttpServer())
			.post('/ops/imports/movies')
			.set('apiKey', 'valid-key')
			.field('source', 'letterboxd')
			.field('dryRun', 'false')
			.field('skipDuplicates', 'true')
			.attach('file', Buffer.from(['Date,Name,Year,Letterboxd URI', '2026-02-08,,2005,https://boxd.it/24u8'].join('\n')), 'movies.csv');

		const jobId = createResponse.body.id;
		const failedJob = await waitForJobToFinish(jobId);
		expect(failedJob.status).toBe('failed');
		expect(failedJob.kind).toBe('import_movies');

		const retryResponse = await request(app.getHttpServer()).post(`/ops/jobs/${jobId}/retry-failed`).set('apiKey', 'valid-key');

		expect(retryResponse.status).toBe(201);
		expect(retryResponse.body).toEqual(expect.objectContaining({ id: jobId, kind: 'import_movies', status: expect.any(String) }));
	});

	it('POST /ops/backfills/movies/metadata creates a backfill movie job from selected ids', async () => {
		jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
			if (url === 'https://api.ashish.me/movies') {
				return {
					data: [{ id: 'movie-1', title: 'The Matrix', imdbId: 'tt0133093', posterUrl: null, tmdbId: null }],
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/find/tt0133093') {
				return {
					data: { movie_results: [{ id: 603, poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg' }] },
				} as any;
			}
			throw new Error(`Unexpected GET ${url}`);
		});
		const patchSpy = jest.spyOn(axios, 'patch').mockResolvedValue({ data: {} } as any);

		const createResponse = await request(app.getHttpServer())
			.post('/ops/backfills/movies/metadata')
			.set('apiKey', 'valid-key')
			.send({ movieIds: ['movie-1'] })
			.expect(201);

		expect(createResponse.body).toEqual(
			expect.objectContaining({
				kind: 'backfill_movie_metadata',
				type: 'movies',
				source: 'metadata',
				status: 'queued',
				totalRows: 1,
			}),
		);

		const completedJob = await waitForJobToFinish(createResponse.body.id);
		expect(completedJob).toEqual(expect.objectContaining({ status: 'completed', successRows: 1, failedRows: 0 }));

		const rowsResponse = await request(app.getHttpServer()).get(`/ops/jobs/${createResponse.body.id}/rows`).set('apiKey', 'valid-key').expect(200);
		expect(rowsResponse.body.rows).toEqual([
			expect.objectContaining({
				status: 'success',
				normalizedPayload: {
					entityId: 'movie-1',
					entityType: 'movie',
					missingFields: ['posterUrl', 'tmdbId'],
					title: 'The Matrix',
				},
			}),
		]);
		expect(patchSpy).toHaveBeenCalledWith(
			'https://api.ashish.me/movies/movie-1',
			{
				posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
				tmdbId: 603,
			},
			{ headers: { apiKey: 'server-key' }, timeout: 15000 },
		);
	});

	it('POST /ops/backfills/movies/metadata supports allFiltered payloads', async () => {
		jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
			if (url === 'https://api.ashish.me/movies') {
				return {
					data: [
						{ id: 'movie-1', title: 'The Matrix', imdbId: 'tt0133093', posterUrl: null, tmdbId: null },
						{ id: 'movie-2', title: 'Heat', posterUrl: 'https://example.com/heat.jpg', tmdbId: 949 },
					],
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/find/tt0133093') {
				return {
					data: { movie_results: [{ id: 603, poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg' }] },
				} as any;
			}
			throw new Error(`Unexpected GET ${url}`);
		});
		jest.spyOn(axios, 'patch').mockResolvedValue({ data: {} } as any);

		const createResponse = await request(app.getHttpServer())
			.post('/ops/backfills/movies/metadata')
			.set('apiKey', 'valid-key')
			.send({
				allFiltered: true,
				filters: { search: 'matrix', missingFields: ['posterUrl'] },
			})
			.expect(201);

		expect(createResponse.body).toEqual(expect.objectContaining({ kind: 'backfill_movie_metadata', totalRows: 1 }));
	});

	it('POST /ops/jobs/:jobId/retry-failed resets failed movie metadata rows to pending', async () => {
		jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
			if (url === 'https://api.ashish.me/movies') {
				return { data: [] } as any;
			}
			if (url.startsWith('https://api.themoviedb.org/3/search/movie')) {
				return { data: { results: [] } } as any;
			}
			throw new Error(`Unexpected GET ${url}`);
		});

		const createResponse = await request(app.getHttpServer())
			.post('/ops/backfills/movies/metadata')
			.set('apiKey', 'valid-key')
			.send({ movieIds: ['missing-movie'] })
			.expect(201);

		expect(createResponse.body).toEqual(expect.objectContaining({ kind: 'backfill_movie_metadata', failedRows: 1, status: 'failed' }));

		const retryResponse = await request(app.getHttpServer()).post(`/ops/jobs/${createResponse.body.id}/retry-failed`).set('apiKey', 'valid-key').expect(201);
		expect(retryResponse.body).toEqual(expect.objectContaining({ kind: 'backfill_movie_metadata', failedRows: 0, status: 'queued' }));
		const finalJob = await waitForJobToFinish(createResponse.body.id);
		expect(finalJob).toEqual(expect.objectContaining({ kind: 'backfill_movie_metadata', failedRows: 1, status: 'failed' }));

		const rowsResponse = await request(app.getHttpServer()).get(`/ops/jobs/${createResponse.body.id}/rows`).set('apiKey', 'valid-key').expect(200);
		expect(rowsResponse.body.rows).toEqual([expect.objectContaining({ status: 'failed', attemptCount: 1 })]);
	});

	it('POST /ops/backfills/shows/metadata creates a backfill show job from selected ids', async () => {
		jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
			if (url === 'https://api.ashish.me/shows') {
				return {
					data: [{ id: 'show-1', title: 'Severance', imdbId: 'tt11280740', posterUrl: null, tmdbId: null }],
				} as any;
			}
			if (url === 'https://api.themoviedb.org/3/find/tt11280740') {
				return {
					data: { tv_results: [{ id: 95396, poster_path: '/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg' }] },
				} as any;
			}
			throw new Error(`Unexpected GET ${url}`);
		});
		const patchSpy = jest.spyOn(axios, 'patch').mockResolvedValue({ data: {} } as any);

		const createResponse = await request(app.getHttpServer())
			.post('/ops/backfills/shows/metadata')
			.set('apiKey', 'valid-key')
			.send({ showIds: ['show-1'] })
			.expect(201);

		expect(createResponse.body).toEqual(expect.objectContaining({ kind: 'backfill_show_metadata', type: 'shows', source: 'metadata', status: 'queued', totalRows: 1 }));
		const completedJob = await waitForJobToFinish(createResponse.body.id);
		expect(completedJob).toEqual(expect.objectContaining({ status: 'completed', successRows: 1, failedRows: 0 }));

		const rowsResponse = await request(app.getHttpServer()).get(`/ops/jobs/${createResponse.body.id}/rows`).set('apiKey', 'valid-key').expect(200);
		expect(rowsResponse.body.rows).toEqual([
			expect.objectContaining({
				status: 'success',
				normalizedPayload: {
					entityId: 'show-1',
					entityType: 'show',
					missingFields: ['posterUrl', 'tmdbId'],
					title: 'Severance',
				},
			}),
		]);
		expect(patchSpy).toHaveBeenCalledWith(
			'https://api.ashish.me/shows/show-1',
			{
				posterUrl: 'https://image.tmdb.org/t/p/w500/7m5qqw5R0lZ4fYVabJNG5m4mP0a.jpg',
				tmdbId: 95396,
			},
			{ headers: { apiKey: 'server-key' }, timeout: 15000 },
		);
	});

	it('POST /ops/jobs/:jobId/retry-failed resets failed show metadata rows to pending', async () => {
		jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
			if (url === 'https://api.ashish.me/shows') {
				return { data: [] } as any;
			}
			if (url.startsWith('https://api.themoviedb.org/3/search/tv')) {
				return { data: { results: [] } } as any;
			}
			throw new Error(`Unexpected GET ${url}`);
		});

		const createResponse = await request(app.getHttpServer())
			.post('/ops/backfills/shows/metadata')
			.set('apiKey', 'valid-key')
			.send({ showIds: ['missing-show'] })
			.expect(201);

		expect(createResponse.body).toEqual(expect.objectContaining({ kind: 'backfill_show_metadata', failedRows: 1, status: 'failed' }));

		const retryResponse = await request(app.getHttpServer()).post(`/ops/jobs/${createResponse.body.id}/retry-failed`).set('apiKey', 'valid-key').expect(201);
		expect(retryResponse.body).toEqual(expect.objectContaining({ kind: 'backfill_show_metadata', failedRows: 0, status: 'queued' }));
		const finalJob = await waitForJobToFinish(createResponse.body.id);
		expect(finalJob).toEqual(expect.objectContaining({ kind: 'backfill_show_metadata', failedRows: 1, status: 'failed' }));

		const rowsResponse = await request(app.getHttpServer()).get(`/ops/jobs/${createResponse.body.id}/rows`).set('apiKey', 'valid-key').expect(200);
		expect(rowsResponse.body.rows).toEqual([expect.objectContaining({ status: 'failed', attemptCount: 1 })]);
	});

	it('/1/user/:user/listens (GET) is public and returns ListenBrainz-shaped listens', async () => {
		const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
				{
					id: 1,
					title: 'Near Dark',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T19:33:20.000Z',
				},
			],
		} as any);

		await request(app.getHttpServer())
			.get('/1/user/testuser/listens')
			.expect(200)
			.expect({
				payload: {
					count: 2,
					latest_listen_ts: 1712003600,
					listens: [
						{
							listened_at: 1712003600,
							track_metadata: {
								artist_name: 'Burial',
								track_name: 'Archangel',
								release_name: 'Untrue',
								additional_info: {},
							},
							user_name: 'testuser',
						},
						{
							listened_at: 1712000000,
							track_metadata: {
								artist_name: 'Burial',
								track_name: 'Near Dark',
								release_name: 'Untrue',
								additional_info: {},
							},
							user_name: 'testuser',
						},
					],
					oldest_listen_ts: 1712000000,
					user_id: 'testuser',
				},
			});

		expect(getSpy).toHaveBeenCalledWith('https://api.ashish.me/listens', expect.any(Object));
	});

	it('/1/user/:user/listens (GET) returns only the newest listen when count=1', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
				{
					id: 1,
					title: 'Near Dark',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T19:33:20.000Z',
				},
			],
		} as any);

		const response = await request(app.getHttpServer()).get('/1/user/testuser/listens').query({ count: 1 }).expect(200);

		expect(response.body).toEqual({
			payload: {
				count: 1,
				latest_listen_ts: 1712003600,
				listens: [
					{
						listened_at: 1712003600,
						track_metadata: {
							artist_name: 'Burial',
							track_name: 'Archangel',
							release_name: 'Untrue',
							additional_info: {},
						},
						user_name: 'testuser',
					},
				],
				oldest_listen_ts: 1712003600,
				user_id: 'testuser',
			},
		});
	});

	it('/1/user/:user/listens (GET) excludes listens at the max_ts boundary', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
				{
					id: 1,
					title: 'Near Dark',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T19:33:20.000Z',
				},
			],
		} as any);

		const response = await request(app.getHttpServer()).get('/1/user/testuser/listens').query({ max_ts: 1712003600 }).expect(200);

		expect(response.body).toEqual({
			payload: {
				count: 1,
				latest_listen_ts: 1712000000,
				listens: [
					{
						listened_at: 1712000000,
						track_metadata: {
							artist_name: 'Burial',
							track_name: 'Near Dark',
							release_name: 'Untrue',
							additional_info: {},
						},
						user_name: 'testuser',
					},
				],
				oldest_listen_ts: 1712000000,
				user_id: 'testuser',
			},
		});
	});

	it('/1/user/:user/listens (GET) excludes listens at the min_ts boundary', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
				{
					id: 1,
					title: 'Near Dark',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T19:33:20.000Z',
				},
			],
		} as any);

		const response = await request(app.getHttpServer()).get('/1/user/testuser/listens').query({ min_ts: 1712000000 }).expect(200);

		expect(response.body).toEqual({
			payload: {
				count: 1,
				latest_listen_ts: 1712003600,
				listens: [
					{
						listened_at: 1712003600,
						track_metadata: {
							artist_name: 'Burial',
							track_name: 'Archangel',
							release_name: 'Untrue',
							additional_info: {},
						},
						user_name: 'testuser',
					},
				],
				oldest_listen_ts: 1712003600,
				user_id: 'testuser',
			},
		});
	});

	it('/1/user/:user/listens (GET) returns an empty payload when the filter removes all listens', async () => {
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: [
				{
					id: 2,
					title: 'Archangel',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T20:33:20.000Z',
				},
				{
					id: 1,
					title: 'Near Dark',
					artist: 'Burial',
					album: 'Untrue',
					listenDate: '2024-04-01T19:33:20.000Z',
				},
			],
		} as any);

		const response = await request(app.getHttpServer()).get('/1/user/testuser/listens').query({ min_ts: 1712003600, max_ts: 1712003600 }).expect(200);

		expect(response.body).toEqual({
			payload: {
				count: 0,
				latest_listen_ts: 0,
				listens: [],
				oldest_listen_ts: 0,
				user_id: 'testuser',
			},
		});
	});

	it('/1/submit-listens (POST) accepts requests without client auth and uses the server token upstream', async () => {
		const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
			data: { ok: true },
		} as any);

		await request(app.getHttpServer())
			.post('/1/submit-listens')
			.send({
				listen_type: 'single',
				payload: [
					{
						listened_at: 1712000000,
						track_metadata: {
							artist_name: 'Burial',
							track_name: 'Archangel',
							release_name: 'Untrue',
							additional_info: { duration: 240 },
						},
					},
				],
			})
			.expect(201)
			.expect({ ok: true });

		expect(postSpy).toHaveBeenCalledWith(
			'https://api.ashish.me/listens',
			{
				title: 'Archangel',
				album: 'Untrue',
				artist: 'Burial',
				listenDate: '2024-04-01T19:33:20.000Z',
			},
			{
				headers: {
					apiKey: 'server-key',
				},
			},
		);
	});

	it('/1/submit-listens (POST) uses the current time when listened_at is missing', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-04-01T12:34:56.000Z'));
		const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
			data: { ok: true },
		} as any);

		await request(app.getHttpServer())
			.post('/1/submit-listens')
			.send({
				listen_type: 'playing_now',
				payload: [
					{
						track_metadata: {
							artist_name: 'Ami Mishra, Kunaal Vermaa',
							track_name: 'Hasi - Male Version',
							release_name: 'Hamari Adhuri Kahani (Original Motion Picture Soundtrack)',
							additional_info: { duration: 273 },
						},
					},
				],
			})
			.expect(201)
			.expect({ ok: true });

		expect(postSpy).toHaveBeenCalledWith(
			'https://api.ashish.me/listens',
			expect.objectContaining({
				title: 'Hasi - Male Version',
				listenDate: '2026-04-01T12:34:56.000Z',
			}),
			{
				headers: {
					apiKey: 'server-key',
				},
			},
		);
	});

	it('preserves an inbound x-request-id header', async () => {
		const response = await request(app.getHttpServer()).get('/').set('x-request-id', 'req-123').expect(200);

		expect(response.headers['x-request-id']).toBe('req-123');
	});

	it('logs sanitized request and response bodies for matched handled routes', async () => {
		const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

		await request(app.getHttpServer())
			.post('/locations')
			.set('apiKey', 'valid-key')
			.send({ locations: [], apiKey: 'secret' })
			.expect(201)
			.expect({ error: 'Locations cannot be blank' });

		expect(logSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'http.request.handled',
				method: 'POST',
				path: '/locations',
				requestId: expect.any(String),
				requestBody: { locations: [], apiKey: '[Redacted]' },
				responseBody: { error: 'Locations cannot be blank' },
				statusCode: 201,
				durationMs: expect.any(Number),
			}),
			'request handled',
			'RequestBodyLoggingInterceptor',
		);
	});

	it('returns 400 and logs an error when the api key is missing', async () => {
		const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

		const response = await request(app.getHttpServer()).post('/movies').send({ title: 'Identity' }).expect(400);

		expect(response.body).toEqual(
			expect.objectContaining({
				statusCode: 400,
				message: API_KEY_MISSING_MESSAGE,
				timestamp: expect.any(String),
			}),
		);

		expect(errorSpy.mock.calls).toContainEqual([
			expect.objectContaining({
				event: 'http.request.error',
				method: 'POST',
				path: '/movies',
				requestBody: { title: 'Identity' },
				responseBody: {
					error: 'Bad Request',
					message: API_KEY_MISSING_MESSAGE,
					statusCode: 400,
				},
				statusCode: 400,
			}),
			'request failed',
			'RequestBodyLoggingInterceptor',
		]);
	});

	it('returns 400 when the api key is missing for GET /movies', async () => {
		const response = await request(app.getHttpServer()).get('/movies').expect(400);

		expect(response.body).toEqual(
			expect.objectContaining({
				statusCode: 400,
				message: API_KEY_MISSING_MESSAGE,
			}),
		);
	});

	it('returns 401 and logs an error when the api key is invalid', async () => {
		const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

		const response = await request(app.getHttpServer()).post('/movies').set('apiKey', 'wrong-key').send({ title: 'Identity' }).expect(401);

		expect(response.body).toEqual(
			expect.objectContaining({
				statusCode: 401,
				message: API_KEY_INVALID_MESSAGE,
				timestamp: expect.any(String),
			}),
		);

		expect(errorSpy.mock.calls).toContainEqual([
			expect.objectContaining({
				event: 'http.request.error',
				method: 'POST',
				path: '/movies',
				requestBody: { title: 'Identity' },
				responseBody: {
					error: 'Unauthorized',
					message: API_KEY_INVALID_MESSAGE,
					statusCode: 401,
				},
				statusCode: 401,
			}),
			'request failed',
			'RequestBodyLoggingInterceptor',
		]);
	});

	it('returns 401 when the api key is invalid for GET /shows', async () => {
		const response = await request(app.getHttpServer()).get('/shows').set('apiKey', 'wrong-key').expect(401);

		expect(response.body).toEqual(
			expect.objectContaining({
				statusCode: 401,
				message: API_KEY_INVALID_MESSAGE,
			}),
		);
	});

	it('does not emit body logs for unmatched routes', async () => {
		const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
		const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

		await request(app.getHttpServer()).get('/robots.txt').expect(404);

		const loggedHttpEvents = [...logSpy.mock.calls, ...errorSpy.mock.calls].filter(
			([payload]) => typeof payload === 'object' && payload !== null && 'event' in payload && 'path' in payload && (payload as Record<string, unknown>).path === '/robots.txt',
		);

		expect(loggedHttpEvents).toHaveLength(0);
	});
});
