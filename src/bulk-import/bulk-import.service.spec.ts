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

describe('BulkImportService', () => {
	const mockedAxios = axios as jest.Mocked<typeof axios>;

	afterEach(() => {
		process.env.BULK_IMPORT_REMOTE_DEDUPE = 'false';
		mockedAxios.get.mockReset();
	});

	const createRepositoryMock = () => {
		const store = new Map<string, ImportJob>();
		return {
			save: jest.fn(async (job: ImportJob) => {
				store.set(job.id, JSON.parse(JSON.stringify(job)));
			}),
			get: jest.fn(async (jobId: string) => store.get(jobId) ?? null),
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

	it('imports valid CSV in dryRun mode and skips duplicates in file', async () => {
		const moviesService = {
			create: jest.fn().mockResolvedValue({ id: 'movie-1' }),
		};
		const repository = createRepositoryMock();
		const service = new BulkImportService(moviesService as any, repository as any);

		const csv = ['Date,Name,Year,Letterboxd URI', '2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8', '2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8'].join('\n');

		const job = await service.createMoviesImport(Buffer.from(csv), 'movies.csv', 'test-key', {
			source: 'letterboxd',
			dryRun: true,
			skipDuplicates: true,
		});

		await waitForJobToFinish(service, job.id);

		const summary = await service.getJob(job.id);
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
		const service = new BulkImportService(moviesService as any, repository as any);

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
		const service = new BulkImportService(moviesService as any, repository as any);

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
		const service = new BulkImportService(moviesService as any, repository as any);

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
		const service = new BulkImportService(moviesService as any, repository as any);

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

		const pride = rowsResult!.rows[0].normalizedPayload!;
		const perks = rowsResult!.rows[1].normalizedPayload!;

		const prideYear = new Date(pride.date).getUTCFullYear();
		const perksYear = new Date(perks.date).getUTCFullYear();

		expect(prideYear).toBeGreaterThanOrEqual(2010);
		expect(perksYear).toBeGreaterThanOrEqual(2013);
	});
});
