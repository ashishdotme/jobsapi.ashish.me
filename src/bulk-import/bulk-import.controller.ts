import { Body, Controller, Get, Param, Post, Query, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { requireApiKey } from '../common/auth';
import { BulkImportService } from './bulk-import.service';
import { ImportRowStatus } from './types';

const MAX_UPLOAD_SIZE_BYTES = Number(process.env.BULK_UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024);
const RATE_LIMIT_PER_MINUTE = Number(process.env.BULK_IMPORT_RATE_LIMIT_PER_MINUTE ?? 120);
const ALLOWED_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel', 'application/csv']);
const ALLOWED_EXTENSIONS = ['.csv'];
const requestLog = new Map<string, number[]>();

const checkRateLimit = (apiKey: string): string | null => {
	const now = Date.now();
	const windowStart = now - 60 * 1000;
	const timestamps = requestLog.get(apiKey) ?? [];
	const recent = timestamps.filter(timestamp => timestamp >= windowStart);
	if (recent.length >= RATE_LIMIT_PER_MINUTE) {
		requestLog.set(apiKey, recent);
		return `Rate limit exceeded. Try again later`;
	}

	recent.push(now);
	requestLog.set(apiKey, recent);
	return null;
};

const validateCsvFile = (file: any): string | null => {
	if (!file?.buffer) {
		return 'CSV file is required';
	}

	if (typeof file.originalname !== 'string' || !ALLOWED_EXTENSIONS.some(ext => file.originalname.toLowerCase().endsWith(ext))) {
		return 'Only .csv files are supported';
	}

	if (typeof file.size === 'number' && file.size > MAX_UPLOAD_SIZE_BYTES) {
		return `File too large. Max allowed is ${MAX_UPLOAD_SIZE_BYTES} bytes`;
	}

	if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
		return `Unsupported file type: ${file.mimetype}`;
	}

	return null;
};

const authorizeRequest = (req: any, apiKeyParam: string) => {
	const apiKey = requireApiKey(req, apiKeyParam);
	const rateLimitError = checkRateLimit(apiKey);
	return { apiKey, rateLimitError };
};

const parseLimit = (value: string | undefined, fallback: number) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const createMoviesImport = async (
	bulkImportService: BulkImportService,
	req: any,
	file: any,
	apiKeyParam: string,
	source = 'letterboxd',
	dryRun?: string,
	skipDuplicates?: string,
) => {
	const { apiKey, rateLimitError } = authorizeRequest(req, apiKeyParam);
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	const fileValidationError = validateCsvFile(file);
	if (fileValidationError) {
		return { error: fileValidationError };
	}

	if (source !== 'letterboxd') {
		return { error: `Unsupported source "${source}"` };
	}

	try {
		return await bulkImportService.createMoviesImport(file.buffer, file.originalname, apiKey, {
			source: 'letterboxd',
			dryRun: dryRun === 'true',
			skipDuplicates: skipDuplicates !== 'false',
		});
	} catch (error) {
		return { error: error.message };
	}
};

const createMovieMetadataBackfill = async (bulkImportService: BulkImportService, req: any, apiKeyParam: string, body: any) => {
	const { apiKey, rateLimitError } = authorizeRequest(req, apiKeyParam);
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	try {
		return await bulkImportService.createMovieMetadataBackfill(apiKey, {
			movieIds: Array.isArray(body?.movieIds) ? body.movieIds.map((movieId: unknown) => String(movieId)) : undefined,
			allFiltered: body?.allFiltered === true,
			filters: body?.filters,
		});
	} catch (error) {
		return { error: error.message };
	}
};

const createShowMetadataBackfill = async (bulkImportService: BulkImportService, req: any, apiKeyParam: string, body: any) => {
	const { apiKey, rateLimitError } = authorizeRequest(req, apiKeyParam);
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	try {
		return await bulkImportService.createShowMetadataBackfill(apiKey, {
			showIds: Array.isArray(body?.showIds) ? body.showIds.map((showId: unknown) => String(showId)) : undefined,
			allFiltered: body?.allFiltered === true,
			filters: body?.filters,
		});
	} catch (error) {
		return { error: error.message };
	}
};

const getJob = async (bulkImportService: BulkImportService, req: any, jobId: string, apiKeyParam: string) => {
	const { rateLimitError } = authorizeRequest(req, apiKeyParam);
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	const job = await bulkImportService.getJob(jobId);
	if (!job) {
		return { error: 'Job not found' };
	}
	return job;
};

const listJobs = async (bulkImportService: BulkImportService, req: any, apiKeyParam: string, limitParam?: string, offsetParam?: string) => {
	const { rateLimitError } = authorizeRequest(req, apiKeyParam);
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	return bulkImportService.listJobs(parseLimit(limitParam, 25), parseLimit(offsetParam, 0));
};

const getJobRows = async (
	bulkImportService: BulkImportService,
	req: any,
	jobId: string,
	apiKeyParam: string,
	status?: ImportRowStatus,
	limitParam?: string,
	offsetParam?: string,
) => {
	const { rateLimitError } = authorizeRequest(req, apiKeyParam);
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	const rows = await bulkImportService.getJobRows(jobId, status, parseLimit(limitParam, 50), parseLimit(offsetParam, 0));
	if (!rows) {
		return { error: 'Job not found' };
	}
	return rows;
};

const retryFailedRows = async (bulkImportService: BulkImportService, req: any, jobId: string, apiKeyParam: string, dryRun?: string, skipDuplicates?: string) => {
	const { apiKey, rateLimitError } = authorizeRequest(req, apiKeyParam);
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	const job = await bulkImportService.retryFailedRows(jobId, apiKey, {
		dryRun: dryRun === 'true',
		skipDuplicates: skipDuplicates !== 'false',
	});
	if (!job) {
		return { error: 'Job not found' };
	}

	return job;
};

@Controller('bulk-import')
export class BulkImportController {
	constructor(private readonly bulkImportService: BulkImportService) {}

	@Post('movies')
	@UseInterceptors(FileInterceptor('file'))
	async createMoviesImport(
		@Request() req,
		@UploadedFile() file: any,
		@Query('apikey') apiKeyParam: string,
		@Body('source') source = 'letterboxd',
		@Body('dryRun') dryRun?: string,
		@Body('skipDuplicates') skipDuplicates?: string,
	) {
		return createMoviesImport(this.bulkImportService, req, file, apiKeyParam, source, dryRun, skipDuplicates);
	}

	@Get('jobs/:jobId')
	async getJob(@Request() req, @Param('jobId') jobId: string, @Query('apikey') apiKeyParam: string) {
		return getJob(this.bulkImportService, req, jobId, apiKeyParam);
	}

	@Get('jobs')
	async listJobs(@Request() req, @Query('apikey') apiKeyParam: string, @Query('limit') limitParam?: string, @Query('offset') offsetParam?: string) {
		return listJobs(this.bulkImportService, req, apiKeyParam, limitParam, offsetParam);
	}

	@Get('jobs/:jobId/rows')
	async getJobRows(
		@Request() req,
		@Param('jobId') jobId: string,
		@Query('apikey') apiKeyParam: string,
		@Query('status') status?: ImportRowStatus,
		@Query('limit') limitParam?: string,
		@Query('offset') offsetParam?: string,
	) {
		return getJobRows(this.bulkImportService, req, jobId, apiKeyParam, status, limitParam, offsetParam);
	}

	@Post('jobs/:jobId/retry-failed')
	async retryFailedRows(
		@Request() req,
		@Param('jobId') jobId: string,
		@Query('apikey') apiKeyParam: string,
		@Body('dryRun') dryRun?: string,
		@Body('skipDuplicates') skipDuplicates?: string,
	) {
		return retryFailedRows(this.bulkImportService, req, jobId, apiKeyParam, dryRun, skipDuplicates);
	}
}

@Controller('ops')
export class OpsJobsController {
	constructor(private readonly bulkImportService: BulkImportService) {}

	@Post('imports/movies')
	@UseInterceptors(FileInterceptor('file'))
	async createMoviesImport(
		@Request() req,
		@UploadedFile() file: any,
		@Query('apikey') apiKeyParam: string,
		@Body('source') source = 'letterboxd',
		@Body('dryRun') dryRun?: string,
		@Body('skipDuplicates') skipDuplicates?: string,
	) {
		return createMoviesImport(this.bulkImportService, req, file, apiKeyParam, source, dryRun, skipDuplicates);
	}

	@Post('backfills/movies/metadata')
	async createMovieMetadataBackfill(@Request() req, @Query('apikey') apiKeyParam: string, @Body() body: any) {
		return createMovieMetadataBackfill(this.bulkImportService, req, apiKeyParam, body);
	}

	@Post('backfills/shows/metadata')
	async createShowMetadataBackfill(@Request() req, @Query('apikey') apiKeyParam: string, @Body() body: any) {
		return createShowMetadataBackfill(this.bulkImportService, req, apiKeyParam, body);
	}

	@Get('jobs/:jobId')
	async getJob(@Request() req, @Param('jobId') jobId: string, @Query('apikey') apiKeyParam: string) {
		return getJob(this.bulkImportService, req, jobId, apiKeyParam);
	}

	@Get('jobs')
	async listJobs(@Request() req, @Query('apikey') apiKeyParam: string, @Query('limit') limitParam?: string, @Query('offset') offsetParam?: string) {
		return listJobs(this.bulkImportService, req, apiKeyParam, limitParam, offsetParam);
	}

	@Get('jobs/:jobId/rows')
	async getJobRows(
		@Request() req,
		@Param('jobId') jobId: string,
		@Query('apikey') apiKeyParam: string,
		@Query('status') status?: ImportRowStatus,
		@Query('limit') limitParam?: string,
		@Query('offset') offsetParam?: string,
	) {
		return getJobRows(this.bulkImportService, req, jobId, apiKeyParam, status, limitParam, offsetParam);
	}

	@Post('jobs/:jobId/retry-failed')
	async retryFailedRows(
		@Request() req,
		@Param('jobId') jobId: string,
		@Query('apikey') apiKeyParam: string,
		@Body('dryRun') dryRun?: string,
		@Body('skipDuplicates') skipDuplicates?: string,
	) {
		return retryFailedRows(this.bulkImportService, req, jobId, apiKeyParam, dryRun, skipDuplicates);
	}
}
