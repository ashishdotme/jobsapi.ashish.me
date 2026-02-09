import { Injectable, Logger } from '@nestjs/common';
import { ImportJob, ImportJobStatus, ImportJobSummary, ImportRow, ImportRowStatus } from './types';
import { BulkImportDbService } from './bulk-import.db.service';

@Injectable()
export class BulkImportRepository {
	private readonly logger = new Logger(BulkImportRepository.name);
	private readonly memoryStore = new Map<string, ImportJob>();

	constructor(private readonly bulkImportDbService: BulkImportDbService) {
		if (!this.bulkImportDbService.isEnabled()) {
			this.logger.debug('Bulk import repository initialized; using in-memory store until DB is enabled');
		}
	}

	async save(job: ImportJob): Promise<void> {
		const pool = this.bulkImportDbService.getPool();
		if (!this.bulkImportDbService.isEnabled() || !pool) {
			this.memoryStore.set(job.id, JSON.parse(JSON.stringify(job)));
			return;
		}

		await pool.query('BEGIN');
		try {
			await pool.query(
				`INSERT INTO bulk_import_jobs (
					id, type, source, status, file_name, total_rows, processed_rows, success_rows, failed_rows, skipped_rows, started_at, completed_at, created_at, updated_at
				)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13::timestamptz, $14::timestamptz)
			 ON CONFLICT (id)
			 DO UPDATE SET
				type = EXCLUDED.type,
				source = EXCLUDED.source,
				status = EXCLUDED.status,
				file_name = EXCLUDED.file_name,
				total_rows = EXCLUDED.total_rows,
				processed_rows = EXCLUDED.processed_rows,
				success_rows = EXCLUDED.success_rows,
				failed_rows = EXCLUDED.failed_rows,
				skipped_rows = EXCLUDED.skipped_rows,
				started_at = EXCLUDED.started_at,
				completed_at = EXCLUDED.completed_at,
				updated_at = EXCLUDED.updated_at`,
				[
					job.id,
					job.type,
					job.source,
					job.status,
					job.fileName,
					job.totalRows,
					job.processedRows,
					job.successRows,
					job.failedRows,
					job.skippedRows,
					job.startedAt ?? null,
					job.completedAt ?? null,
					job.createdAt,
					job.updatedAt,
				],
			);

			for (const row of job.rows) {
				await pool.query(
					`INSERT INTO bulk_import_rows (
						id, job_id, row_number, raw_payload, normalized_payload, status, error_code, error_message, target_record_id, attempt_count, updated_at
					)
					VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11::timestamptz)
					ON CONFLICT (id)
					DO UPDATE SET
						raw_payload = EXCLUDED.raw_payload,
						normalized_payload = EXCLUDED.normalized_payload,
						status = EXCLUDED.status,
						error_code = EXCLUDED.error_code,
						error_message = EXCLUDED.error_message,
						target_record_id = EXCLUDED.target_record_id,
						attempt_count = EXCLUDED.attempt_count,
						updated_at = EXCLUDED.updated_at`,
					[
						row.id,
						job.id,
						row.rowNumber,
						JSON.stringify(row.rawPayload),
						row.normalizedPayload ? JSON.stringify(row.normalizedPayload) : null,
						row.status,
						row.errorCode ?? null,
						row.errorMessage ?? null,
						row.targetRecordId ?? null,
						row.attemptCount,
						row.updatedAt,
					],
				);
			}

			await pool.query('COMMIT');
		} catch (error) {
			await pool.query('ROLLBACK');
			throw error;
		}
	}

	async get(jobId: string): Promise<ImportJob | null> {
		const pool = this.bulkImportDbService.getPool();
		if (!this.bulkImportDbService.isEnabled() || !pool) {
			return this.memoryStore.get(jobId) ?? null;
		}

		const jobResult = await pool.query('SELECT * FROM bulk_import_jobs WHERE id = $1 LIMIT 1', [jobId]);
		if (!jobResult.rows.length) {
			return null;
		}

		const rowsResult = await pool.query('SELECT * FROM bulk_import_rows WHERE job_id = $1 ORDER BY row_number ASC', [jobId]);

		const dbJob = jobResult.rows[0];
		return {
			id: dbJob.id,
			type: dbJob.type,
			source: dbJob.source,
			status: dbJob.status as ImportJobStatus,
			fileName: dbJob.file_name,
			totalRows: dbJob.total_rows,
			processedRows: dbJob.processed_rows,
			successRows: dbJob.success_rows,
			failedRows: dbJob.failed_rows,
			skippedRows: dbJob.skipped_rows,
			createdAt: new Date(dbJob.created_at).toISOString(),
			updatedAt: new Date(dbJob.updated_at).toISOString(),
			startedAt: dbJob.started_at ? new Date(dbJob.started_at).toISOString() : undefined,
			completedAt: dbJob.completed_at ? new Date(dbJob.completed_at).toISOString() : undefined,
			rows: rowsResult.rows.map(dbRow => ({
				id: dbRow.id,
				rowNumber: dbRow.row_number,
				rawPayload: dbRow.raw_payload,
				normalizedPayload: dbRow.normalized_payload ?? undefined,
				status: dbRow.status as ImportRowStatus,
				errorCode: dbRow.error_code ?? undefined,
				errorMessage: dbRow.error_message ?? undefined,
				targetRecordId: dbRow.target_record_id ?? undefined,
				attemptCount: dbRow.attempt_count,
				updatedAt: new Date(dbRow.updated_at).toISOString(),
			})),
		};
	}

	async getRows(jobId: string, status?: ImportRowStatus, limit = 50, offset = 0): Promise<{ total: number; rows: ImportRow[] } | null> {
		const pool = this.bulkImportDbService.getPool();
		if (!this.bulkImportDbService.isEnabled() || !pool) {
			const job = this.memoryStore.get(jobId);
			if (!job) {
				return null;
			}

			const filteredRows = status ? job.rows.filter(row => row.status === status) : job.rows;
			return {
				total: filteredRows.length,
				rows: filteredRows.slice(offset, offset + limit),
			};
		}

		const jobExists = await pool.query('SELECT 1 FROM bulk_import_jobs WHERE id = $1 LIMIT 1', [jobId]);
		if (!jobExists.rows.length) {
			return null;
		}

		const whereClause = status ? 'WHERE job_id = $1 AND status = $2' : 'WHERE job_id = $1';
		const countParams = status ? [jobId, status] : [jobId];
		const totalResult = await pool.query(`SELECT count(*)::int AS total FROM bulk_import_rows ${whereClause}`, countParams);

		const rowsParams = status ? [jobId, status, limit, offset] : [jobId, limit, offset];
		const rowsQuery = status
			? `SELECT * FROM bulk_import_rows WHERE job_id = $1 AND status = $2 ORDER BY row_number ASC LIMIT $3 OFFSET $4`
			: `SELECT * FROM bulk_import_rows WHERE job_id = $1 ORDER BY row_number ASC LIMIT $2 OFFSET $3`;
		const rowsResult = await pool.query(rowsQuery, rowsParams);

		return {
			total: totalResult.rows[0].total,
			rows: rowsResult.rows.map(dbRow => ({
				id: dbRow.id,
				rowNumber: dbRow.row_number,
				rawPayload: dbRow.raw_payload,
				normalizedPayload: dbRow.normalized_payload ?? undefined,
				status: dbRow.status as ImportRowStatus,
				errorCode: dbRow.error_code ?? undefined,
				errorMessage: dbRow.error_message ?? undefined,
				targetRecordId: dbRow.target_record_id ?? undefined,
				attemptCount: dbRow.attempt_count,
				updatedAt: new Date(dbRow.updated_at).toISOString(),
			})),
		};
	}

	async listJobs(limit = 25, offset = 0): Promise<{ total: number; jobs: ImportJobSummary[] }> {
		const pool = this.bulkImportDbService.getPool();
		if (!this.bulkImportDbService.isEnabled() || !pool) {
			const jobs = Array.from(this.memoryStore.values())
				.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
				.slice(offset, offset + limit)
				.map(job => this.toSummary(job));
			return { total: this.memoryStore.size, jobs };
		}

		const totalResult = await pool.query('SELECT count(*)::int AS total FROM bulk_import_jobs');
		const jobsResult = await pool.query(`SELECT * FROM bulk_import_jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);

		return {
			total: totalResult.rows[0].total,
			jobs: jobsResult.rows.map(row => ({
				id: row.id,
				type: row.type,
				source: row.source,
				status: row.status as ImportJobStatus,
				fileName: row.file_name,
				totalRows: row.total_rows,
				processedRows: row.processed_rows,
				successRows: row.success_rows,
				failedRows: row.failed_rows,
				skippedRows: row.skipped_rows,
				createdAt: new Date(row.created_at).toISOString(),
				updatedAt: new Date(row.updated_at).toISOString(),
				startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
				completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
				recentErrors: [],
			})),
		};
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
