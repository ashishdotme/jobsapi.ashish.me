import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { randomInt, randomUUID } from 'crypto';
import { MoviesService } from '../movies/movies.service';
import { formatLogMessage, getErrorMessage } from '../common/logging';
import { fetchDetailsFromOmdb, fetchDetailsFromOmdbByImdbId } from '../common/utils';
import { BulkImportRepository } from './bulk-import.repository';
import {
	CreateMovieImportOptions,
	CreateMovieMetadataBackfillOptions,
	CreateShowMetadataBackfillOptions,
	ImportJob,
	ImportJobSummary,
	ImportRow,
	ImportRowStatus,
	MetadataBackfillFilters,
	MetadataBackfillNormalizedPayload,
	MetadataBackfillRowPayload,
	MetadataField,
	MovieCsvRow,
	TRACKED_METADATA_FIELDS,
	getJobKind,
} from './types';

const REQUIRED_MOVIE_HEADERS = ['Date', 'Name', 'Year', 'Letterboxd URI'];
const MIN_RANDOM_WATCH_YEAR = 2010;
const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

interface TmdbMetadataCandidate {
	id: number;
	poster_path?: string | null;
	imdb_id?: string | null;
	external_ids?: { imdb_id?: string | null } | null;
}

interface TmdbMovieDetails {
	id: number;
	poster_path?: string | null;
	overview?: string | null;
	original_language?: string | null;
	genres?: Array<{ name?: string | null } | null> | null;
	release_date?: string | null;
	imdb_id?: string | null;
	first_air_date?: string | null;
	external_ids?: { imdb_id?: string | null } | null;
}

interface TmdbShowDetails {
	id: number;
	poster_path?: string | null;
	overview?: string | null;
	original_language?: string | null;
	genres?: Array<{ name?: string | null } | null> | null;
	first_air_date?: string | null;
	imdb_id?: string | null;
	external_ids?: { imdb_id?: string | null } | null;
	release_date?: string | null;
}

interface OmdbDetails {
	Response?: string;
	Title?: string;
	Plot?: string;
	Year?: string;
	Genre?: string;
	Language?: string;
	imdbID?: string;
	imdbRating?: string;
	Poster?: string;
}

interface ResolvedMetadataContext {
	tmdb: {
		candidate: TmdbMetadataCandidate | null;
		details: TmdbMovieDetails | TmdbShowDetails | null;
	};
	omdb: OmdbDetails | null;
	canonical: Partial<Record<MetadataField, string | number | null>>;
}

interface MetadataReconciliationResult {
	status: 'success' | 'skipped';
	patchPayload: Partial<Record<MetadataField, string | number>>;
}

@Injectable()
export class BulkImportService {
	private readonly logger = new Logger(BulkImportService.name);
	private readonly processingJobs = new Set<string>();
	private readonly upstreamApiKey: string | undefined;
	private readonly tmdbApiKey: string | undefined;
	private readonly omdbApiKey: string | undefined;

	constructor(
		private readonly moviesService: MoviesService,
		private readonly bulkImportRepository: BulkImportRepository,
		private readonly configService: ConfigService,
	) {
		this.upstreamApiKey = this.configService.get<string>('ASHISHDOTME_TOKEN');
		this.tmdbApiKey = this.configService.get<string>('TMDB_API_KEY');
		this.omdbApiKey = this.configService.get<string>('OMDB');
	}

	private resolveUpstreamApiKey(apiKey: string): string {
		return this.upstreamApiKey?.trim() || apiKey;
	}

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
		this.logger.log(formatLogMessage('bulkImport.job.created', { jobId, fileName, totalRows: jobRows.length, options }));
		setImmediate(() => {
			void this.processJob(jobId, apiKey, options, false);
		});

		return this.toSummary(job);
	}

	async createMovieMetadataBackfill(apiKey: string, options: CreateMovieMetadataBackfillOptions): Promise<ImportJobSummary> {
		const movies = await this.loadAllMovies(apiKey);
		const now = new Date().toISOString();
		const rows = this.buildMovieMetadataBackfillRows(movies, options, now);
		const job: ImportJob = {
			id: randomUUID(),
			type: 'movies',
			source: 'metadata',
			status: 'queued',
			fileName: 'movie-metadata-backfill',
			totalRows: rows.length,
			processedRows: 0,
			successRows: 0,
			failedRows: 0,
			skippedRows: 0,
			createdAt: now,
			updatedAt: now,
			rows,
		};

		this.recalculateCounters(job);
		this.assignMetadataBackfillJobStatus(job);
		await this.bulkImportRepository.save(job);
		if (job.status === 'queued') {
			setImmediate(() => {
				void this.processMetadataBackfillJob(job.id, apiKey);
			});
		}

		return this.toSummary(job);
	}

	async createShowMetadataBackfill(apiKey: string, options: CreateShowMetadataBackfillOptions): Promise<ImportJobSummary> {
		const shows = await this.loadAllShows(apiKey);
		const now = new Date().toISOString();
		const rows = this.buildShowMetadataBackfillRows(shows, options, now);
		const job: ImportJob = {
			id: randomUUID(),
			type: 'shows',
			source: 'metadata',
			status: 'queued',
			fileName: 'show-metadata-backfill',
			totalRows: rows.length,
			processedRows: 0,
			successRows: 0,
			failedRows: 0,
			skippedRows: 0,
			createdAt: now,
			updatedAt: now,
			rows,
		};

		this.recalculateCounters(job);
		this.assignMetadataBackfillJobStatus(job);
		await this.bulkImportRepository.save(job);
		if (job.status === 'queued') {
			setImmediate(() => {
				void this.processMetadataBackfillJob(job.id, apiKey);
			});
		}

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
		const result = await this.bulkImportRepository.listJobs(limit, offset);
		return {
			total: result.total,
			jobs: result.jobs.map(job => this.withKind(job)),
		};
	}

	async retryFailedRows(jobId: string, apiKey: string, options: Pick<CreateMovieImportOptions, 'dryRun' | 'skipDuplicates'>): Promise<ImportJobSummary | null> {
		const job = await this.bulkImportRepository.get(jobId);
		if (!job) {
			return null;
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
		job.updatedAt = new Date().toISOString();
		this.recalculateCounters(job);
		await this.bulkImportRepository.save(job);

		if (getJobKind(job.type, job.source) === 'import_movies') {
			setImmediate(() => {
				void this.processJob(jobId, apiKey, { source: 'letterboxd', ...options }, true);
			});
		} else if (job.source === 'metadata') {
			setImmediate(() => {
				void this.processMetadataBackfillJob(jobId, apiKey);
			});
		}

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

	private async loadAllMovies(apiKey: string): Promise<MetadataBackfillRowPayload[]> {
		const upstreamApiKey = this.resolveUpstreamApiKey(apiKey);
		const response = await axios.get('https://api.ashish.me/movies', {
			headers: { apiKey: upstreamApiKey },
			timeout: 15000,
		});

		return Array.isArray(response.data) ? response.data : [];
	}

	private async loadAllShows(apiKey: string): Promise<MetadataBackfillRowPayload[]> {
		const upstreamApiKey = this.resolveUpstreamApiKey(apiKey);
		const response = await axios.get('https://api.ashish.me/shows', {
			headers: { apiKey: upstreamApiKey },
			timeout: 15000,
		});

		return Array.isArray(response.data) ? response.data : [];
	}

	private async loadExistingMovieDedupeSet(apiKey: string): Promise<Set<string>> {
		const dedupeSet = new Set<string>();
		const shouldCheckRemote = process.env.BULK_IMPORT_REMOTE_DEDUPE === 'true';
		if (!shouldCheckRemote) {
			return dedupeSet;
		}

		try {
			const upstreamApiKey = this.resolveUpstreamApiKey(apiKey);
			const response = await axios.get('https://api.ashish.me/movies', {
				headers: { apiKey: upstreamApiKey },
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
			this.logger.warn(formatLogMessage('bulkImport.dedupe.remote_failed', { errorMessage: getErrorMessage(error) }));
		}

		return dedupeSet;
	}

	private async processJob(jobId: string, apiKey: string, options: CreateMovieImportOptions, retryOnly: boolean): Promise<void> {
		if (this.processingJobs.has(jobId)) {
			this.logger.warn(formatLogMessage('bulkImport.job.skipped', { jobId, reason: 'already_running' }));
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

				const normalized = this.normalizeMovieRow(row.rawPayload as MovieCsvRow);
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
			this.logger.log(
				formatLogMessage('bulkImport.job.completed', {
					jobId,
					status: job.status,
					successRows: job.successRows,
					failedRows: job.failedRows,
					skippedRows: job.skippedRows,
				}),
			);
		}
	}

	private async processMetadataBackfillJob(jobId: string, apiKey: string): Promise<void> {
		if (this.processingJobs.has(jobId)) {
			this.logger.warn(formatLogMessage('bulkImport.job.skipped', { jobId, reason: 'already_running' }));
			return;
		}

		const job = await this.bulkImportRepository.get(jobId);
		if (!job || job.source !== 'metadata') {
			return;
		}

		this.processingJobs.add(jobId);
		job.status = 'processing';
		job.startedAt = job.startedAt ?? new Date().toISOString();
		job.updatedAt = new Date().toISOString();
		await this.bulkImportRepository.save(job);

		try {
			for (const row of job.rows) {
				if (row.status !== 'pending') {
					continue;
				}

				row.status = 'processing';
				row.attemptCount += 1;
				row.errorCode = undefined;
				row.errorMessage = undefined;
				row.updatedAt = new Date().toISOString();
				await this.bulkImportRepository.save(job);

				try {
					const normalized = row.normalizedPayload as MetadataBackfillNormalizedPayload | undefined;
					if (!normalized) {
						throw new Error('Missing metadata backfill payload');
					}

					let reconciliationResult: MetadataReconciliationResult;
					if (normalized.entityType === 'movie') {
						reconciliationResult = await this.applyMovieMetadataBackfill(row.rawPayload as MetadataBackfillRowPayload, normalized, apiKey);
					} else {
						reconciliationResult = await this.applyShowMetadataBackfill(row.rawPayload as MetadataBackfillRowPayload, normalized, apiKey);
					}

					row.status = reconciliationResult.status;
					row.targetRecordId = normalized.entityId;
				} catch (error) {
					row.status = 'failed';
					row.errorCode = 'METADATA_BACKFILL_FAILED';
					row.errorMessage = getErrorMessage(error);
				}

				row.updatedAt = new Date().toISOString();
				job.updatedAt = row.updatedAt;
				this.recalculateCounters(job);
				await this.bulkImportRepository.save(job);
			}

			this.recalculateCounters(job);
			this.assignMetadataBackfillJobStatus(job);
			job.updatedAt = new Date().toISOString();
			await this.bulkImportRepository.save(job);
		} finally {
			this.processingJobs.delete(jobId);
		}
	}

	private async applyMovieMetadataBackfill(
		rawPayload: MetadataBackfillRowPayload,
		normalized: MetadataBackfillNormalizedPayload,
		apiKey: string,
	): Promise<MetadataReconciliationResult> {
		const metadataContext = await this.resolveMovieMetadataContext(rawPayload);
		const patchPayload = this.buildMetadataPatchPayload(rawPayload, normalized.missingFields, metadataContext.canonical);
		if (Object.keys(patchPayload).length) {
			await this.patchMovieMetadata(normalized.entityId, patchPayload, apiKey);
			return { status: 'success', patchPayload };
		}

		if (this.hasCanonicalMetadata(metadataContext.canonical, normalized.missingFields)) {
			return { status: 'skipped', patchPayload };
		}

		throw new Error(`Metadata reconciliation did not produce canonical values for "${normalized.title}"`);
	}

	private async applyShowMetadataBackfill(
		rawPayload: MetadataBackfillRowPayload,
		normalized: MetadataBackfillNormalizedPayload,
		apiKey: string,
	): Promise<MetadataReconciliationResult> {
		const metadataContext = await this.resolveShowMetadataContext(rawPayload);
		const patchPayload = this.buildMetadataPatchPayload(rawPayload, normalized.missingFields, metadataContext.canonical);
		if (Object.keys(patchPayload).length) {
			await this.patchShowMetadata(normalized.entityId, patchPayload, apiKey);
			return { status: 'success', patchPayload };
		}

		if (this.hasCanonicalMetadata(metadataContext.canonical, normalized.missingFields)) {
			return { status: 'skipped', patchPayload };
		}

		throw new Error(`Metadata reconciliation did not produce canonical values for "${normalized.title}"`);
	}

	private async resolveMovieMetadataContext(rawPayload: MetadataBackfillRowPayload): Promise<ResolvedMetadataContext> {
		const tmdb = await this.resolveTmdbMovieMetadata(rawPayload);
		const omdb = await this.resolveOmdbMetadata(rawPayload, this.resolvePreferredImdbId(tmdb));
		return {
			tmdb,
			omdb,
			canonical: this.buildCanonicalMovieMetadata(rawPayload, tmdb, omdb),
		};
	}

	private async resolveShowMetadataContext(rawPayload: MetadataBackfillRowPayload): Promise<ResolvedMetadataContext> {
		const tmdb = await this.resolveTmdbShowMetadata(rawPayload);
		const omdb = await this.resolveOmdbMetadata(rawPayload, this.resolvePreferredImdbId(tmdb));
		return {
			tmdb,
			omdb,
			canonical: this.buildCanonicalShowMetadata(rawPayload, tmdb, omdb),
		};
	}

	private async resolveTmdbMovieMetadata(rawPayload: MetadataBackfillRowPayload): Promise<ResolvedMetadataContext['tmdb']> {
		const candidate = await this.lookupTmdbMovie(rawPayload);
		if (!candidate) {
			return { candidate: null, details: null };
		}

		return {
			candidate,
			details: await this.fetchTmdbMovieDetails(candidate.id),
		};
	}

	private async resolveTmdbShowMetadata(rawPayload: MetadataBackfillRowPayload): Promise<ResolvedMetadataContext['tmdb']> {
		const candidate = await this.lookupTmdbShow(rawPayload);
		if (!candidate) {
			return { candidate: null, details: null };
		}

		return {
			candidate,
			details: await this.fetchTmdbShowDetails(candidate.id),
		};
	}

	private async fetchTmdbMovieDetails(movieId: number): Promise<TmdbMovieDetails | null> {
		const response = await this.tmdbGet(`/movie/${movieId}`, { append_to_response: 'external_ids' });
		return response && typeof response === 'object' ? (response as TmdbMovieDetails) : null;
	}

	private async fetchTmdbShowDetails(showId: number): Promise<TmdbShowDetails | null> {
		const response = await this.tmdbGet(`/tv/${showId}`, { append_to_response: 'external_ids' });
		return response && typeof response === 'object' ? (response as TmdbShowDetails) : null;
	}

	private async resolveOmdbMetadata(rawPayload: MetadataBackfillRowPayload, imdbId?: string | null): Promise<OmdbDetails | null> {
		const apiKey = this.omdbApiKey?.trim();
		if (!apiKey) {
			return null;
		}

		if (imdbId) {
			const byImdbId = await fetchDetailsFromOmdbByImdbId(imdbId, apiKey);
			if (byImdbId) {
				return byImdbId as OmdbDetails;
			}
		}

		const byTitle = await fetchDetailsFromOmdb(this.getBackfillTitle(rawPayload), apiKey);
		return byTitle as OmdbDetails | null;
	}

	private resolvePreferredImdbId(tmdb: ResolvedMetadataContext['tmdb']): string | null {
		return (
			this.normalizeTextMetadata(tmdb.details?.imdb_id) ??
			this.normalizeTextMetadata(tmdb.details?.external_ids?.imdb_id) ??
			this.normalizeTextMetadata(tmdb.candidate?.imdb_id) ??
			null
		);
	}

	private buildCanonicalMovieMetadata(
		rawPayload: MetadataBackfillRowPayload,
		tmdb: ResolvedMetadataContext['tmdb'],
		omdb: OmdbDetails | null,
	): Partial<Record<MetadataField, string | number | null>> {
		const tmdbDetails = tmdb.details;
		return {
			tmdbId: this.normalizeNumericMetadata(tmdbDetails?.id ?? tmdb.candidate?.id),
			posterUrl: this.resolveCanonicalPosterUrl(tmdbDetails?.poster_path ?? tmdb.candidate?.poster_path, omdb?.Poster),
			language: this.resolveCanonicalLanguage(tmdbDetails?.original_language, omdb?.Language),
			genre: this.resolveCanonicalGenre(tmdbDetails?.genres, omdb?.Genre),
			description: this.resolveCanonicalText(tmdbDetails?.overview, omdb?.Plot),
			year: this.resolveCanonicalYear(tmdbDetails?.release_date, omdb?.Year),
			imdbRating: this.normalizeNumericMetadata(omdb?.imdbRating),
			imdbId: this.resolveCanonicalImdbId(omdb?.imdbID, tmdbDetails?.imdb_id ?? tmdbDetails?.external_ids?.imdb_id ?? tmdb.candidate?.imdb_id),
		};
	}

	private buildCanonicalShowMetadata(
		rawPayload: MetadataBackfillRowPayload,
		tmdb: ResolvedMetadataContext['tmdb'],
		omdb: OmdbDetails | null,
	): Partial<Record<MetadataField, string | number | null>> {
		const tmdbDetails = tmdb.details;
		return {
			tmdbId: this.normalizeNumericMetadata(tmdbDetails?.id ?? tmdb.candidate?.id),
			posterUrl: this.resolveCanonicalPosterUrl(tmdbDetails?.poster_path ?? tmdb.candidate?.poster_path, omdb?.Poster),
			language: this.resolveCanonicalLanguage(tmdbDetails?.original_language, omdb?.Language),
			genre: this.resolveCanonicalGenre(tmdbDetails?.genres, omdb?.Genre),
			description: this.resolveCanonicalText(tmdbDetails?.overview, omdb?.Plot),
			year: this.resolveCanonicalYear(tmdbDetails?.first_air_date, omdb?.Year),
			imdbRating: this.normalizeNumericMetadata(omdb?.imdbRating),
			imdbId: this.resolveCanonicalImdbId(omdb?.imdbID, tmdbDetails?.imdb_id ?? tmdbDetails?.external_ids?.imdb_id ?? tmdb.candidate?.imdb_id),
		};
	}

	private resolveCanonicalPosterUrl(primaryPosterPath?: string | null, fallbackPosterUrl?: unknown): string | null {
		const posterPath = this.normalizeTextMetadata(primaryPosterPath);
		if (posterPath) {
			return `${TMDB_IMAGE_BASE_URL}${posterPath}`;
		}

		return this.normalizeTextMetadata(fallbackPosterUrl);
	}

	private resolveCanonicalLanguage(primaryLanguage?: unknown, fallbackLanguage?: unknown): string | null {
		const resolvedPrimary = this.normalizeLanguageMetadata(primaryLanguage);
		if (resolvedPrimary) {
			return resolvedPrimary;
		}

		return this.normalizeLanguageMetadata(fallbackLanguage);
	}

	private resolveCanonicalGenre(primaryGenres?: Array<{ name?: string | null } | null> | null, fallbackGenre?: unknown): string | null {
		const genres = this.normalizeGenreList(primaryGenres);
		if (genres) {
			return genres;
		}

		return this.normalizeTextMetadata(fallbackGenre);
	}

	private resolveCanonicalText(primaryText?: unknown, fallbackText?: unknown): string | null {
		const primary = this.normalizeTextMetadata(primaryText);
		if (primary) {
			return primary;
		}

		return this.normalizeTextMetadata(fallbackText);
	}

	private resolveCanonicalYear(primaryYear?: unknown, fallbackYear?: unknown): number | null {
		const primary = this.normalizeYearValue(primaryYear);
		if (primary) {
			return primary;
		}

		return this.normalizeYearValue(fallbackYear);
	}

	private resolveCanonicalImdbId(primaryImdbId?: unknown, fallbackImdbId?: unknown, tertiaryImdbId?: unknown): string | null {
		return this.normalizeTextMetadata(primaryImdbId) ?? this.normalizeTextMetadata(fallbackImdbId) ?? this.normalizeTextMetadata(tertiaryImdbId);
	}

	private normalizeTextMetadata(value: unknown): string | null {
		if (typeof value !== 'string') {
			return null;
		}

		const normalized = value.trim();
		if (!normalized) {
			return null;
		}

		const lowered = normalized.toLowerCase();
		if (lowered === 'n/a' || lowered === 'unknown' || lowered === 'null' || lowered === 'undefined') {
			return null;
		}

		return normalized;
	}

	private normalizeNumericMetadata(value: unknown): number | null {
		if (value === null || value === undefined || value === '') {
			return null;
		}

		const numericValue = typeof value === 'number' ? value : Number(value);
		if (!Number.isFinite(numericValue) || numericValue <= 0) {
			return null;
		}

		return numericValue;
	}

	private normalizeYearValue(value: unknown): number | null {
		if (typeof value === 'string') {
			const yearMatch = value.trim().match(/^(\d{4})/);
			if (yearMatch) {
				return this.normalizeNumericMetadata(Number(yearMatch[1]));
			}
		}

		return this.normalizeNumericMetadata(value);
	}

	private normalizeGenreList(genres?: Array<{ name?: string | null } | null> | null): string | null {
		if (!Array.isArray(genres) || !genres.length) {
			return null;
		}

		const names = genres.map(genre => this.normalizeTextMetadata(genre?.name)).filter((genreName): genreName is string => Boolean(genreName));

		return names.length ? names.join(', ') : null;
	}

	private normalizeDelimitedMetadata(value: unknown): string | null {
		const normalized = this.normalizeTextMetadata(value);
		if (!normalized) {
			return null;
		}

		const parts = normalized
			.split(',')
			.map(part => this.normalizeTextMetadata(part))
			.filter((part): part is string => Boolean(part));

		return parts.length ? parts.join(', ') : normalized;
	}

	private normalizeLanguageMetadata(value: unknown): string | null {
		const normalized = this.normalizeTextMetadata(value);
		if (!normalized) {
			return null;
		}

		if (/^[a-z]{2,3}(?:-[a-z]{2})?$/i.test(normalized)) {
			try {
				const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
				const displayName = displayNames.of(normalized.toLowerCase());
				const resolved = this.normalizeTextMetadata(displayName);
				if (resolved) {
					return resolved;
				}
			} catch {
				// Fall back to the raw code if language display names are unavailable.
			}
		}

		return normalized;
	}

	private buildMetadataPatchPayload(
		rawPayload: MetadataBackfillRowPayload,
		fieldsToReconcile: MetadataField[],
		canonical: Partial<Record<MetadataField, string | number | null>>,
	): Partial<Record<MetadataField, string | number>> {
		const payload: Partial<Record<MetadataField, string | number>> = {};

		for (const field of fieldsToReconcile) {
			const canonicalValue = this.normalizeMetadataFieldValue(field, canonical[field]);
			if (canonicalValue === null) {
				continue;
			}

			const currentValue = this.normalizeMetadataFieldValue(field, rawPayload[field]);
			if (this.areMetadataValuesEqual(field, currentValue, canonicalValue)) {
				continue;
			}

			payload[field] = canonicalValue;
		}

		return payload;
	}

	private hasCanonicalMetadata(canonical: Partial<Record<MetadataField, string | number | null>>, fieldsToReconcile: MetadataField[]): boolean {
		return fieldsToReconcile.some(field => this.normalizeMetadataFieldValue(field, canonical[field]) !== null);
	}

	private normalizeMetadataFieldValue(field: MetadataField, value: unknown): string | number | null {
		switch (field) {
			case 'tmdbId':
			case 'year':
			case 'imdbRating':
				return this.normalizeNumericMetadata(value);
			case 'posterUrl':
			case 'description':
			case 'imdbId':
				return this.normalizeTextMetadata(value);
			case 'language':
				return this.normalizeLanguageMetadata(value);
			case 'genre':
				return this.normalizeDelimitedMetadata(value);
			default:
				return null;
		}
	}

	private areMetadataValuesEqual(field: MetadataField, left: string | number | null, right: string | number | null): boolean {
		if (left === null || right === null) {
			return left === right;
		}

		if (field === 'imdbRating') {
			return Math.abs(Number(left) - Number(right)) < 0.0001;
		}

		return left === right;
	}

	private async patchMovieMetadata(recordId: string, payload: Record<string, unknown>, apiKey: string): Promise<void> {
		const upstreamApiKey = this.resolveUpstreamApiKey(apiKey);
		await axios.patch(`https://api.ashish.me/movies/${recordId}`, payload, {
			headers: { apiKey: upstreamApiKey },
			timeout: 15000,
		});
	}

	private async patchShowMetadata(recordId: string, payload: Record<string, unknown>, apiKey: string): Promise<void> {
		const upstreamApiKey = this.resolveUpstreamApiKey(apiKey);
		await axios.patch(`https://api.ashish.me/shows/${recordId}`, payload, {
			headers: { apiKey: upstreamApiKey },
			timeout: 15000,
		});
	}

	private async lookupTmdbMovie(rawPayload: MetadataBackfillRowPayload): Promise<{ id: number; poster_path?: string | null } | null> {
		const imdbId = this.getImdbId(rawPayload);
		if (imdbId) {
			const match = await this.findTmdbByImdbId(imdbId, 'movie');
			if (match) {
				return match;
			}
		}

		const title = this.getBackfillTitle(rawPayload);
		const year = typeof rawPayload.year === 'number' ? rawPayload.year : Number(rawPayload.year);
		const response = await this.tmdbGet('/search/movie', {
			query: title,
			include_adult: 'false',
			year: Number.isFinite(year) ? String(year) : undefined,
		});
		const results = Array.isArray(response?.results) ? response.results : [];
		return results[0] ?? null;
	}

	private async lookupTmdbShow(rawPayload: MetadataBackfillRowPayload): Promise<{ id: number; poster_path?: string | null } | null> {
		const imdbId = this.getImdbId(rawPayload);
		if (imdbId) {
			const match = await this.findTmdbByImdbId(imdbId, 'tv');
			if (match) {
				return match;
			}
		}

		const title = this.getBackfillTitle(rawPayload);
		const year = typeof rawPayload.releaseStartYear === 'number' ? rawPayload.releaseStartYear : Number(rawPayload.releaseStartYear ?? rawPayload.year);
		const response = await this.tmdbGet('/search/tv', {
			query: title,
			first_air_date_year: Number.isFinite(year) ? String(year) : undefined,
		});
		const results = Array.isArray(response?.results) ? response.results : [];
		return results[0] ?? null;
	}

	private getImdbId(rawPayload: MetadataBackfillRowPayload): string | null {
		const imdbId = typeof rawPayload.imdbId === 'string' ? rawPayload.imdbId.trim() : '';
		return imdbId || null;
	}

	private async findTmdbByImdbId(imdbId: string, entityType: 'movie' | 'tv'): Promise<{ id: number; poster_path?: string | null } | null> {
		const response = await this.tmdbGet(`/find/${imdbId}`, { external_source: 'imdb_id' });
		const key = entityType === 'movie' ? 'movie_results' : 'tv_results';
		const results = Array.isArray(response?.[key]) ? response[key] : [];
		return results[0] ?? null;
	}

	private async tmdbGet(path: string, params: Record<string, string | undefined>): Promise<any> {
		const token = this.tmdbApiKey?.trim();
		if (!token) {
			throw new Error('TMDB_API_KEY is not configured');
		}

		const response = await axios.get(`${TMDB_API_BASE_URL}${path}`, {
			params,
			headers: {
				Authorization: `Bearer ${token}`,
			},
			timeout: 15000,
		});
		return response.data;
	}

	private recalculateCounters(job: ImportJob): void {
		job.processedRows = job.rows.filter(row => row.status !== 'pending' && row.status !== 'processing').length;
		job.successRows = job.rows.filter(row => row.status === 'success').length;
		job.failedRows = job.rows.filter(row => row.status === 'failed').length;
		job.skippedRows = job.rows.filter(row => row.status === 'skipped').length;
	}

	private buildMovieMetadataBackfillRows(movies: MetadataBackfillRowPayload[], options: CreateMovieMetadataBackfillOptions, now: string): ImportRow[] {
		const selectedMovies = this.selectMoviesForMetadataBackfill(movies, options);

		return selectedMovies.map((selection, index) => {
			if ('errorCode' in selection) {
				return {
					id: randomUUID(),
					rowNumber: index + 1,
					rawPayload: { id: String(selection.entityId), title: selection.title },
					normalizedPayload: {
						entityId: String(selection.entityId),
						entityType: 'movie',
						missingFields: [...TRACKED_METADATA_FIELDS],
						title: selection.title,
					},
					status: 'failed',
					errorCode: String(selection.errorCode),
					errorMessage: String(selection.errorMessage),
					attemptCount: 0,
					updatedAt: now,
				};
			}

			return {
				id: randomUUID(),
				rowNumber: index + 1,
				rawPayload: selection,
				normalizedPayload: {
					entityId: String(selection.id),
					entityType: 'movie',
					missingFields: [...TRACKED_METADATA_FIELDS],
					title: this.getBackfillTitle(selection),
				},
				status: 'pending',
				attemptCount: 0,
				updatedAt: now,
			};
		});
	}

	private buildShowMetadataBackfillRows(shows: MetadataBackfillRowPayload[], options: CreateShowMetadataBackfillOptions, now: string): ImportRow[] {
		const selectedShows = this.selectShowsForMetadataBackfill(shows, options);

		return selectedShows.map((selection, index) => {
			if ('errorCode' in selection) {
				return {
					id: randomUUID(),
					rowNumber: index + 1,
					rawPayload: { id: String(selection.entityId), title: selection.title },
					normalizedPayload: {
						entityId: String(selection.entityId),
						entityType: 'show',
						missingFields: [...TRACKED_METADATA_FIELDS],
						title: selection.title,
					},
					status: 'failed',
					errorCode: String(selection.errorCode),
					errorMessage: String(selection.errorMessage),
					attemptCount: 0,
					updatedAt: now,
				};
			}

			return {
				id: randomUUID(),
				rowNumber: index + 1,
				rawPayload: selection,
				normalizedPayload: {
					entityId: String(selection.id),
					entityType: 'show',
					missingFields: [...TRACKED_METADATA_FIELDS],
					title: this.getBackfillTitle(selection),
				},
				status: 'pending',
				attemptCount: 0,
				updatedAt: now,
			};
		});
	}

	private selectMoviesForMetadataBackfill(
		movies: MetadataBackfillRowPayload[],
		options: CreateMovieMetadataBackfillOptions,
	): Array<MetadataBackfillRowPayload | { entityId: string; title: string; errorCode: string; errorMessage: string }> {
		if (options.movieIds?.length) {
			return options.movieIds.map(movieId => {
				const movie = movies.find(candidate => String(candidate.id) === String(movieId));
				if (!movie) {
					return {
						entityId: String(movieId),
						title: `Unknown movie ${movieId}`,
						errorCode: 'MOVIE_NOT_FOUND',
						errorMessage: `Movie ${movieId} was not found`,
					};
				}

				return movie;
			});
		}

		if (options.allFiltered) {
			return movies.filter(movie => this.matchesMetadataFilters(movie, options.filters));
		}

		throw new Error('movieIds or allFiltered is required');
	}

	private selectShowsForMetadataBackfill(
		shows: MetadataBackfillRowPayload[],
		options: CreateShowMetadataBackfillOptions,
	): Array<MetadataBackfillRowPayload | { entityId: string; title: string; errorCode: string; errorMessage: string }> {
		if (options.showIds?.length) {
			return options.showIds.map(showId => {
				const show = shows.find(candidate => String(candidate.id) === String(showId));
				if (!show) {
					return {
						entityId: String(showId),
						title: `Unknown show ${showId}`,
						errorCode: 'SHOW_NOT_FOUND',
						errorMessage: `Show ${showId} was not found`,
					};
				}

				return show;
			});
		}

		if (options.allFiltered) {
			return shows.filter(show => this.matchesMetadataFilters(show, options.filters));
		}

		throw new Error('showIds or allFiltered is required');
	}

	private matchesMetadataFilters(movie: MetadataBackfillRowPayload, filters?: MetadataBackfillFilters): boolean {
		const title = this.getBackfillTitle(movie).toLowerCase();
		const search = filters?.search?.trim().toLowerCase();
		if (search && !title.includes(search)) {
			return false;
		}

		const missingFields = filters?.missingFields ?? [];
		if (!missingFields.length) {
			return true;
		}

		const presentMissingFields = this.getMissingMetadataFields(movie);
		return missingFields.every(field => presentMissingFields.includes(field));
	}

	private getMissingMetadataFields(movie: MetadataBackfillRowPayload): MetadataField[] {
		const missingFields: MetadataField[] = [];
		if (this.isMissingTextMetadata(movie.posterUrl)) {
			missingFields.push('posterUrl');
		}
		if (this.isMissingNumericMetadata(movie.tmdbId)) {
			missingFields.push('tmdbId');
		}
		if (this.isMissingTextMetadata(movie.language)) {
			missingFields.push('language');
		}
		if (this.isMissingTextMetadata(movie.genre)) {
			missingFields.push('genre');
		}
		if (this.isMissingTextMetadata(movie.description)) {
			missingFields.push('description');
		}
		if (this.isMissingNumericMetadata(movie.year)) {
			missingFields.push('year');
		}
		if (this.isMissingNumericMetadata(movie.imdbRating)) {
			missingFields.push('imdbRating');
		}
		if (this.isMissingTextMetadata(movie.imdbId)) {
			missingFields.push('imdbId');
		}
		return missingFields;
	}

	private isMissingTextMetadata(value: unknown): boolean {
		if (typeof value !== 'string') {
			return true;
		}

		const normalized = value.trim().toLowerCase();
		return normalized === '' || normalized === 'n/a' || normalized === 'unknown';
	}

	private isMissingNumericMetadata(value: unknown): boolean {
		if (value === null || value === undefined || value === '') {
			return true;
		}
		const numericValue = typeof value === 'number' ? value : Number(value);
		return !Number.isFinite(numericValue) || numericValue <= 0;
	}

	private getBackfillTitle(movie: MetadataBackfillRowPayload): string {
		return typeof movie.title === 'string' && movie.title.trim() ? movie.title.trim() : `Movie ${movie.id}`;
	}

	private assignMetadataBackfillJobStatus(job: ImportJob): void {
		if (job.rows.some(row => row.status === 'pending')) {
			job.status = 'queued';
			job.completedAt = undefined;
			return;
		}

		job.completedAt = job.updatedAt;
		if (job.failedRows > 0 && (job.successRows > 0 || job.skippedRows > 0)) {
			job.status = 'partial';
			return;
		}
		if (job.failedRows > 0) {
			job.status = 'failed';
			return;
		}
		job.status = 'completed';
	}

	private toSummary(job: ImportJob): ImportJobSummary {
		const recentErrors = job.rows
			.filter(row => row.status === 'failed')
			.slice(-20)
			.map(row => ({ rowNumber: row.rowNumber, errorCode: row.errorCode, errorMessage: row.errorMessage }));

		return this.withKind({
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
		});
	}

	private withKind(job: Omit<ImportJobSummary, 'kind'> & Partial<Pick<ImportJobSummary, 'kind'>>): ImportJobSummary {
		return {
			...job,
			kind: job.kind ?? getJobKind(job.type, job.source),
		};
	}
}
