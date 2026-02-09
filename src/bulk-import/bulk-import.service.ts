import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { randomInt, randomUUID } from 'crypto';
import { MoviesService } from '../movies/movies.service';
import { BulkImportRepository } from './bulk-import.repository';
import { CreateMovieImportOptions, ImportJob, ImportJobSummary, ImportRow, ImportRowStatus, MovieCsvRow } from './types';

const REQUIRED_MOVIE_HEADERS = ['Date', 'Name', 'Year', 'Letterboxd URI'];
const MIN_RANDOM_WATCH_YEAR = 2010;

@Injectable()
export class BulkImportService {
	private readonly logger = new Logger(BulkImportService.name);
	private readonly processingJobs = new Set<string>();

	constructor(
		private readonly moviesService: MoviesService,
		private readonly bulkImportRepository: BulkImportRepository,
	) {}

	async createMoviesImport(fileBuffer: Buffer, fileName: string, apiKey: string, options: CreateMovieImportOptions): Promise<ImportJobSummary> {
		const rows = this.parseMoviesCsv(fileBuffer);
		const now = new Date().toISOString();
		const jobId = randomUUID();

		const jobRows: ImportRow[] = rows.map((row, index) => ({
			id: randomUUID(),
			rowNumber: index + 2,
			rawPayload: row,
			status: 'pending',
			attemptCount: 0,
			updatedAt: now,
		}));

		const job: ImportJob = {
			id: jobId,
			type: 'movies',
			source: options.source,
			status: 'queued',
			fileName,
			totalRows: jobRows.length,
			processedRows: 0,
			successRows: 0,
			failedRows: 0,
			skippedRows: 0,
			createdAt: now,
			updatedAt: now,
			rows: jobRows,
		};

		await this.bulkImportRepository.save(job);
		this.logger.log(`Created import job ${jobId} with ${jobRows.length} rows`);
		setImmediate(() => {
			void this.processJob(jobId, apiKey, options, false);
		});

		return this.toSummary(job);
	}

	async getJob(jobId: string): Promise<ImportJobSummary | null> {
		const job = await this.bulkImportRepository.get(jobId);
		if (!job) {
			return null;
		}

		return this.toSummary(job);
	}

	async getJobRows(jobId: string, status?: ImportRowStatus, limit = 50, offset = 0): Promise<{ total: number; rows: ImportRow[] } | null> {
		return this.bulkImportRepository.getRows(jobId, status, limit, offset);
	}

	async listJobs(limit = 25, offset = 0): Promise<{ total: number; jobs: ImportJobSummary[] }> {
		return this.bulkImportRepository.listJobs(limit, offset);
	}

	async retryFailedRows(jobId: string, apiKey: string, options: Pick<CreateMovieImportOptions, 'dryRun' | 'skipDuplicates'>): Promise<ImportJobSummary | null> {
		const job = await this.bulkImportRepository.get(jobId);
		if (!job) {
			return null;
		}

		if (job.type !== 'movies') {
			return this.toSummary(job);
		}

		for (const row of job.rows) {
			if (row.status === 'failed') {
				row.status = 'pending';
				row.errorCode = undefined;
				row.errorMessage = undefined;
				row.updatedAt = new Date().toISOString();
			}
		}
		job.status = 'queued';
		job.completedAt = undefined;
		this.recalculateCounters(job);
		await this.bulkImportRepository.save(job);

		setImmediate(() => {
			void this.processJob(jobId, apiKey, { source: 'letterboxd', ...options }, true);
		});

		return this.toSummary(job);
	}

	private parseMoviesCsv(fileBuffer: Buffer): MovieCsvRow[] {
		const parsed = parse(fileBuffer, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
			bom: true,
		}) as MovieCsvRow[];

		if (!parsed.length) {
			throw new Error('CSV has no rows');
		}

		const firstRowHeaders = Object.keys(parsed[0]);
		const missingHeaders = REQUIRED_MOVIE_HEADERS.filter(header => !firstRowHeaders.includes(header));
		if (missingHeaders.length) {
			throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
		}

		return parsed;
	}

	private generateRandomWatchDateAfterReleaseYear(yearHint?: number): string {
		const normalizedYear = Number.isFinite(yearHint) ? Math.floor(yearHint as number) : undefined;
		const startYear = Math.max(MIN_RANDOM_WATCH_YEAR, normalizedYear ? normalizedYear + 1 : MIN_RANDOM_WATCH_YEAR);

		// Use UTC boundaries so YYYY-MM-DD is stable regardless of server timezone.
		const start = new Date(Date.UTC(startYear, 0, 1));
		const now = new Date();
		const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
		const end = start.getTime() > todayUtc.getTime() ? start : todayUtc;

		const dayMs = 24 * 60 * 60 * 1000;
		const daysRange = Math.floor((end.getTime() - start.getTime()) / dayMs);
		const offsetDays = daysRange > 0 ? randomInt(daysRange + 1) : 0;
		const chosen = new Date(start.getTime() + offsetDays * dayMs);

		return chosen.toISOString().split('T')[0];
	}

	private normalizeMovieRow(
		row: MovieCsvRow,
	): { valid: true; payload: { title: string; date: string; yearHint?: number; sourceUri?: string } } | { valid: false; errorCode: string; errorMessage: string } {
		const title = row.Name?.trim();

		if (!title) {
			return { valid: false, errorCode: 'INVALID_TITLE', errorMessage: 'Name is blank' };
		}

		const year = Number(row.Year);
		const yearHint = Number.isFinite(year) ? year : undefined;
		const randomDate = this.generateRandomWatchDateAfterReleaseYear(yearHint);
		return {
			valid: true,
			payload: {
				title,
				date: randomDate,
				yearHint,
				sourceUri: row['Letterboxd URI']?.trim(),
			},
		};
	}

	private async loadExistingMovieDedupeSet(apiKey: string): Promise<Set<string>> {
		const dedupeSet = new Set<string>();
		const shouldCheckRemote = process.env.BULK_IMPORT_REMOTE_DEDUPE === 'true';
		if (!shouldCheckRemote) {
			return dedupeSet;
		}

		try {
			const response = await axios.get('https://api.ashish.me/movies', {
				headers: { apiKey },
				timeout: 15000,
			});

			for (const movie of response.data ?? []) {
				const title = typeof movie?.title === 'string' ? movie.title.trim().toLowerCase() : '';
				if (!title) {
					continue;
				}
				// Bulk-import uses randomized watch dates, so dedupe needs to ignore dates.
				dedupeSet.add(title);
			}
		} catch (error) {
			this.logger.warn(`Remote dedupe check failed; continuing with file-only dedupe. Reason: ${error.message}`);
		}

		return dedupeSet;
	}

	private async processJob(jobId: string, apiKey: string, options: CreateMovieImportOptions, retryOnly: boolean): Promise<void> {
		if (this.processingJobs.has(jobId)) {
			this.logger.warn(`Skipping process trigger for job ${jobId}: already running`);
			return;
		}

		const job = await this.bulkImportRepository.get(jobId);
		if (!job) {
			return;
		}

		this.processingJobs.add(jobId);
		job.status = 'processing';
		job.startedAt = job.startedAt ?? new Date().toISOString();
		job.updatedAt = new Date().toISOString();
		await this.bulkImportRepository.save(job);

		const seenInJob = new Set<string>();
		const remoteDedupeSet = await this.loadExistingMovieDedupeSet(apiKey);

		try {
			for (const row of job.rows) {
				if (retryOnly && row.status !== 'pending') {
					continue;
				}
				if (!retryOnly && row.status !== 'pending') {
					continue;
				}

				row.status = 'processing';
				row.attemptCount += 1;
				row.updatedAt = new Date().toISOString();

				const normalized = this.normalizeMovieRow(row.rawPayload);
				if (!normalized.valid) {
					row.status = 'failed';
					row.errorCode = 'errorCode' in normalized ? normalized.errorCode : 'INVALID_ROW';
					row.errorMessage = 'errorMessage' in normalized ? normalized.errorMessage : 'Invalid row';
					row.updatedAt = new Date().toISOString();
					await this.bulkImportRepository.save(job);
					continue;
				}

				row.normalizedPayload = normalized.payload;

				const dedupeKey = normalized.payload.title.toLowerCase();
				if (options.skipDuplicates && seenInJob.has(dedupeKey)) {
					row.status = 'skipped';
					row.errorCode = 'DUPLICATE_IN_FILE';
					row.errorMessage = 'Duplicate title in this upload';
					row.updatedAt = new Date().toISOString();
					await this.bulkImportRepository.save(job);
					continue;
				}
				if (options.skipDuplicates && remoteDedupeSet.has(dedupeKey)) {
					row.status = 'skipped';
					row.errorCode = 'DUPLICATE_REMOTE';
					row.errorMessage = 'Movie already exists in api.ashish.me';
					row.updatedAt = new Date().toISOString();
					await this.bulkImportRepository.save(job);
					continue;
				}
				seenInJob.add(dedupeKey);

				if (options.dryRun) {
					row.status = 'success';
					row.errorCode = undefined;
					row.errorMessage = undefined;
					row.targetRecordId = 'dry-run';
					row.updatedAt = new Date().toISOString();
					await this.bulkImportRepository.save(job);
					continue;
				}

				try {
					const response = await this.moviesService.create(
						{
							title: normalized.payload.title,
							date: normalized.payload.date,
						},
						apiKey,
					);

					if (response?.error) {
						row.status = 'failed';
						row.errorCode = 'UPSERT_FAILED';
						row.errorMessage = response.error;
					} else {
						row.status = 'success';
						row.errorCode = undefined;
						row.errorMessage = undefined;
						if (response?.id) {
							row.targetRecordId = String(response.id);
						}
						remoteDedupeSet.add(dedupeKey);
					}
				} catch (error) {
					row.status = 'failed';
					row.errorCode = 'UPSERT_EXCEPTION';
					row.errorMessage = error.message;
				}

				row.updatedAt = new Date().toISOString();
				await this.bulkImportRepository.save(job);
			}
		} finally {
			this.recalculateCounters(job);
			job.completedAt = new Date().toISOString();
			job.updatedAt = job.completedAt;
			if (job.failedRows > 0 && job.successRows > 0) {
				job.status = 'partial';
			} else if (job.failedRows > 0 && job.successRows === 0) {
				job.status = 'failed';
			} else {
				job.status = 'completed';
			}
			await this.bulkImportRepository.save(job);

			this.processingJobs.delete(jobId);
			this.logger.log(`Finished import job ${jobId}: ${job.successRows} success, ${job.failedRows} failed, ${job.skippedRows} skipped`);
		}
	}

	private recalculateCounters(job: ImportJob): void {
		job.processedRows = job.rows.filter(row => row.status !== 'pending' && row.status !== 'processing').length;
		job.successRows = job.rows.filter(row => row.status === 'success').length;
		job.failedRows = job.rows.filter(row => row.status === 'failed').length;
		job.skippedRows = job.rows.filter(row => row.status === 'skipped').length;
	}

	private toSummary(job: ImportJob): ImportJobSummary {
		const recentErrors = job.rows
			.filter(row => row.status === 'failed')
			.slice(-20)
			.map(row => ({ rowNumber: row.rowNumber, errorCode: row.errorCode, errorMessage: row.errorMessage }));

		return {
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
			recentErrors,
		};
	}
}
