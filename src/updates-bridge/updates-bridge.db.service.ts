import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

interface SqlMigration {
	version: number;
	name: string;
	sql: string;
}

const UPDATES_BRIDGE_MIGRATIONS: SqlMigration[] = [
	{
		version: 1,
		name: 'create_threads_bridge_integrations',
		sql: `
			CREATE TABLE IF NOT EXISTS threads_bridge_integrations (
				id uuid PRIMARY KEY,
				threads_user_id text NOT NULL,
				threads_username text NOT NULL,
				access_token text NOT NULL,
				access_token_expires_at timestamptz NOT NULL,
				connected_at timestamptz NOT NULL,
				disconnected_at timestamptz,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now()
			);

			CREATE TABLE IF NOT EXISTS threads_bridge_oauth_states (
				id uuid PRIMARY KEY,
				state text NOT NULL UNIQUE,
				return_to text,
				expires_at timestamptz NOT NULL,
				created_at timestamptz NOT NULL DEFAULT now()
			);

			CREATE TABLE IF NOT EXISTS threads_bridge_posts (
				id uuid PRIMARY KEY,
				source_platform text NOT NULL,
				source_post_id text NOT NULL,
				source_post_type text NOT NULL,
				source_url text NOT NULL,
				source_published_at timestamptz NOT NULL,
				title text NOT NULL,
				content text NOT NULL,
				media_urls text[] NOT NULL DEFAULT '{}',
				referenced_source_id text,
				referenced_source_url text,
				source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
				api_update_id text,
				api_status text NOT NULL,
				bluesky_uri text,
				bluesky_status text NOT NULL,
				attempt_count integer NOT NULL DEFAULT 0,
				next_attempt_at timestamptz,
				last_error text,
				last_attempted_at timestamptz,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now(),
				UNIQUE(source_platform, source_post_id)
			);

			CREATE TABLE IF NOT EXISTS threads_bridge_checkpoints (
				source_platform text PRIMARY KEY,
				last_checked_at timestamptz NOT NULL,
				last_seen_post_id text,
				last_cursor text,
				updated_at timestamptz NOT NULL DEFAULT now()
			);
		`,
	},
];

@Injectable()
export class UpdatesBridgeDbService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(UpdatesBridgeDbService.name);
	private pool: Pool | null = null;
	private enabled = false;

	async onModuleInit(): Promise<void> {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			this.logger.warn('DATABASE_URL is not configured; updates bridge will use in-memory mode');
			return;
		}

		this.pool = new Pool({ connectionString: databaseUrl });
		await this.runMigrations();
		this.enabled = true;
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
			CREATE TABLE IF NOT EXISTS updates_bridge_schema_migrations (
				version integer PRIMARY KEY,
				name text NOT NULL,
				executed_at timestamptz NOT NULL DEFAULT now()
			);
		`);

		const appliedResult = await this.pool.query('SELECT version FROM updates_bridge_schema_migrations');
		const applied = new Set<number>(appliedResult.rows.map(row => Number(row.version)));

		for (const migration of UPDATES_BRIDGE_MIGRATIONS) {
			if (applied.has(migration.version)) {
				continue;
			}

			await this.pool.query('BEGIN');
			try {
				await this.pool.query(migration.sql);
				await this.pool.query('INSERT INTO updates_bridge_schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
				await this.pool.query('COMMIT');
			} catch (error) {
				await this.pool.query('ROLLBACK');
				throw error;
			}
		}
	}
}
