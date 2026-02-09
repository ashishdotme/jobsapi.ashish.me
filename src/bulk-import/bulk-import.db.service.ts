import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

interface SqlMigration {
	version: number;
	name: string;
	sql: string;
}

const BULK_IMPORT_MIGRATIONS: SqlMigration[] = [
	{
		version: 1,
		name: 'create_bulk_import_jobs',
		sql: `
			CREATE TABLE IF NOT EXISTS bulk_import_jobs (
				id uuid PRIMARY KEY,
				type varchar(20) NOT NULL,
				source varchar(50) NOT NULL,
				status varchar(20) NOT NULL,
				file_name text NOT NULL,
				total_rows integer NOT NULL DEFAULT 0,
				processed_rows integer NOT NULL DEFAULT 0,
				success_rows integer NOT NULL DEFAULT 0,
				failed_rows integer NOT NULL DEFAULT 0,
				skipped_rows integer NOT NULL DEFAULT 0,
				started_at timestamptz,
				completed_at timestamptz,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now()
			);
		`,
	},
	{
		version: 2,
		name: 'create_bulk_import_rows',
		sql: `
			CREATE TABLE IF NOT EXISTS bulk_import_rows (
				id uuid PRIMARY KEY,
				job_id uuid NOT NULL REFERENCES bulk_import_jobs(id) ON DELETE CASCADE,
				row_number integer NOT NULL,
				raw_payload jsonb NOT NULL,
				normalized_payload jsonb,
				status varchar(20) NOT NULL,
				error_code varchar(50),
				error_message text,
				target_record_id text,
				attempt_count integer NOT NULL DEFAULT 0,
				updated_at timestamptz NOT NULL DEFAULT now(),
				created_at timestamptz NOT NULL DEFAULT now(),
				UNIQUE(job_id, row_number)
			);
		`,
	},
	{
		version: 3,
		name: 'add_bulk_import_rows_indexes',
		sql: `
			CREATE INDEX IF NOT EXISTS idx_bulk_import_rows_job_status ON bulk_import_rows(job_id, status);
			CREATE INDEX IF NOT EXISTS idx_bulk_import_rows_job_row_number ON bulk_import_rows(job_id, row_number);
		`,
	},
];

@Injectable()
export class BulkImportDbService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(BulkImportDbService.name);
	private pool: Pool | null = null;
	private enabled = false;

	async onModuleInit(): Promise<void> {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			this.logger.warn('DATABASE_URL is not configured; bulk import will use in-memory mode');
			return;
		}

		this.pool = new Pool({ connectionString: databaseUrl });
		await this.runMigrations();
		this.enabled = true;
		this.logger.log('Bulk import DB connected and migrations are up to date');
	}

	async onModuleDestroy(): Promise<void> {
		if (this.pool) {
			await this.pool.end();
		}
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	getPool(): Pool | null {
		return this.pool;
	}

	private async runMigrations(): Promise<void> {
		if (!this.pool) {
			return;
		}

		await this.pool.query(`
			CREATE TABLE IF NOT EXISTS bulk_import_schema_migrations (
				version integer PRIMARY KEY,
				name text NOT NULL,
				executed_at timestamptz NOT NULL DEFAULT now()
			);
		`);

		const appliedResult = await this.pool.query('SELECT version FROM bulk_import_schema_migrations');
		const applied = new Set<number>(appliedResult.rows.map(row => Number(row.version)));

		for (const migration of BULK_IMPORT_MIGRATIONS) {
			if (applied.has(migration.version)) {
				continue;
			}

			this.logger.log(`Applying migration ${migration.version}: ${migration.name}`);
			await this.pool.query('BEGIN');
			try {
				await this.pool.query(migration.sql);
				await this.pool.query('INSERT INTO bulk_import_schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
				await this.pool.query('COMMIT');
			} catch (error) {
				await this.pool.query('ROLLBACK');
				throw error;
			}
		}
	}
}
