import { Body, Controller, Get, Param, Post, Query, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { API_KEY_MISSING_MESSAGE, extractApiKey, getApiKeyError } from '../common/auth';
import { BulkImportService } from './bulk-import.service';
import { ImportRowStatus } from './types';

const MAX_UPLOAD_SIZE_BYTES = Number(process.env.BULK_UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024);
const RATE_LIMIT_PER_MINUTE = Number(process.env.BULK_IMPORT_RATE_LIMIT_PER_MINUTE ?? 120);
const ALLOWED_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel', 'application/csv']);
const ALLOWED_EXTENSIONS = ['.csv'];

@Controller('bulk-import')
export class BulkImportController {
	private readonly requestLog = new Map<string, number[]>();

	constructor(private readonly bulkImportService: BulkImportService) {}

	private checkRateLimit(apiKey: string): string | null {
		const now = Date.now();
		const windowStart = now - 60 * 1000;
		const timestamps = this.requestLog.get(apiKey) ?? [];
		const recent = timestamps.filter(timestamp => timestamp >= windowStart);
		if (recent.length >= RATE_LIMIT_PER_MINUTE) {
			this.requestLog.set(apiKey, recent);
			return `Rate limit exceeded. Try again later`;
		}

		recent.push(now);
		this.requestLog.set(apiKey, recent);
		return null;
	}

	private validateCsvFile(file: any): string | null {
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
	}

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
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: getApiKeyError(req, apiKeyParam) ?? API_KEY_MISSING_MESSAGE };
		}
		const rateLimitError = this.checkRateLimit(apiKey);
		if (rateLimitError) {
			return { error: rateLimitError };
		}

		const fileValidationError = this.validateCsvFile(file);
		if (fileValidationError) {
			return { error: fileValidationError };
		}

		if (source !== 'letterboxd') {
			return { error: `Unsupported source "${source}"` };
		}

		try {
			return await this.bulkImportService.createMoviesImport(file.buffer, file.originalname, apiKey, {
				source: 'letterboxd',
				dryRun: dryRun === 'true',
				skipDuplicates: skipDuplicates !== 'false',
			});
		} catch (error) {
			return { error: error.message };
		}
	}

	@Get('jobs/:jobId')
	async getJob(@Request() req, @Param('jobId') jobId: string, @Query('apikey') apiKeyParam: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: getApiKeyError(req, apiKeyParam) ?? API_KEY_MISSING_MESSAGE };
		}
		const rateLimitError = this.checkRateLimit(apiKey);
		if (rateLimitError) {
			return { error: rateLimitError };
		}

		const job = await this.bulkImportService.getJob(jobId);
		if (!job) {
			return { error: 'Job not found' };
		}
		return job;
	}

	@Get('jobs')
	async listJobs(@Request() req, @Query('apikey') apiKeyParam: string, @Query('limit') limitParam?: string, @Query('offset') offsetParam?: string) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: getApiKeyError(req, apiKeyParam) ?? API_KEY_MISSING_MESSAGE };
		}
		const rateLimitError = this.checkRateLimit(apiKey);
		if (rateLimitError) {
			return { error: rateLimitError };
		}

		const limit = Number.isFinite(Number(limitParam)) ? Number(limitParam) : 25;
		const offset = Number.isFinite(Number(offsetParam)) ? Number(offsetParam) : 0;
		return this.bulkImportService.listJobs(limit, offset);
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
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: getApiKeyError(req, apiKeyParam) ?? API_KEY_MISSING_MESSAGE };
		}
		const rateLimitError = this.checkRateLimit(apiKey);
		if (rateLimitError) {
			return { error: rateLimitError };
		}

		const limit = Number.isFinite(Number(limitParam)) ? Number(limitParam) : 50;
		const offset = Number.isFinite(Number(offsetParam)) ? Number(offsetParam) : 0;

		const rows = await this.bulkImportService.getJobRows(jobId, status, limit, offset);
		if (!rows) {
			return { error: 'Job not found' };
		}
		return rows;
	}

	@Post('jobs/:jobId/retry-failed')
	async retryFailedRows(
		@Request() req,
		@Param('jobId') jobId: string,
		@Query('apikey') apiKeyParam: string,
		@Body('dryRun') dryRun?: string,
		@Body('skipDuplicates') skipDuplicates?: string,
	) {
		const apiKey = extractApiKey(req, apiKeyParam);
		if (!apiKey) {
			return { error: getApiKeyError(req, apiKeyParam) ?? API_KEY_MISSING_MESSAGE };
		}
		const rateLimitError = this.checkRateLimit(apiKey);
		if (rateLimitError) {
			return { error: rateLimitError };
		}

		const job = await this.bulkImportService.retryFailedRows(jobId, apiKey, {
			dryRun: dryRun === 'true',
			skipDuplicates: skipDuplicates !== 'false',
		});
		if (!job) {
			return { error: 'Job not found' };
		}

		return job;
	}
}
