export type ImportType = 'movies' | 'shows';
export type ImportSource = 'letterboxd';
export type ImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'partial';
export type ImportRowStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped';

export interface MovieCsvRow {
	Date: string;
	Name: string;
	Year?: string;
	'Letterboxd URI'?: string;
}

export interface ImportRow {
	id: string;
	rowNumber: number;
	rawPayload: MovieCsvRow;
	normalizedPayload?: {
		title: string;
		date: string;
		yearHint?: number;
		sourceUri?: string;
	};
	status: ImportRowStatus;
	errorCode?: string;
	errorMessage?: string;
	targetRecordId?: string;
	attemptCount: number;
	updatedAt: string;
}

export interface ImportJob {
	id: string;
	type: ImportType;
	source: ImportSource;
	status: ImportJobStatus;
	fileName: string;
	totalRows: number;
	processedRows: number;
	successRows: number;
	failedRows: number;
	skippedRows: number;
	createdAt: string;
	updatedAt: string;
	startedAt?: string;
	completedAt?: string;
	rows: ImportRow[];
}

export interface CreateMovieImportOptions {
	dryRun?: boolean;
	skipDuplicates?: boolean;
	source: ImportSource;
}

export interface ImportJobSummary extends Omit<ImportJob, 'rows'> {
	recentErrors: Array<{ rowNumber: number; errorCode?: string; errorMessage?: string }>;
}
