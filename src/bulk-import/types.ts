export type ImportType = 'movies' | 'shows';
export type ImportSource = 'letterboxd' | 'metadata';
export type ImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'partial';
export type ImportRowStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped';
export type JobKind = 'import_movies' | 'import_shows' | 'backfill_movie_metadata' | 'backfill_show_metadata';
export type MetadataField = 'posterUrl' | 'tmdbId' | 'language' | 'genre' | 'description' | 'year' | 'imdbRating' | 'imdbId';
export const TRACKED_METADATA_FIELDS: MetadataField[] = ['posterUrl', 'tmdbId', 'language', 'genre', 'description', 'year', 'imdbRating', 'imdbId'];

export interface MovieCsvRow {
	Date: string;
	Name: string;
	Year?: string;
	'Letterboxd URI'?: string;
}

export interface ImportMovieNormalizedPayload {
	title: string;
	date: string;
	yearHint?: number;
	sourceUri?: string;
}

export interface MetadataBackfillRowPayload {
	id: string;
	title?: string;
	posterUrl?: string | null;
	tmdbId?: string | number | null;
	language?: string | null;
	genre?: string | null;
	description?: string | null;
	year?: string | number | null;
	imdbRating?: string | number | null;
	imdbId?: string | null;
	releaseStartYear?: string | number | null;
	[key: string]: unknown;
}

export interface MetadataBackfillNormalizedPayload {
	entityId: string;
	entityType: 'movie' | 'show';
	missingFields: MetadataField[];
	title: string;
}

export interface ImportRow {
	id: string;
	rowNumber: number;
	rawPayload: MovieCsvRow | MetadataBackfillRowPayload;
	normalizedPayload?: ImportMovieNormalizedPayload | MetadataBackfillNormalizedPayload;
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

export interface MetadataBackfillFilters {
	search?: string;
	missingFields?: MetadataField[];
}

export interface CreateMovieMetadataBackfillOptions {
	movieIds?: string[];
	allFiltered?: boolean;
	filters?: MetadataBackfillFilters;
}

export interface CreateShowMetadataBackfillOptions {
	showIds?: string[];
	allFiltered?: boolean;
	filters?: MetadataBackfillFilters;
}

export interface ImportJobSummary extends Omit<ImportJob, 'rows'> {
	kind: JobKind;
	recentErrors: Array<{ rowNumber: number; errorCode?: string; errorMessage?: string }>;
}

export const getJobKind = (type: ImportType, source: ImportSource): JobKind => {
	if (source === 'metadata') {
		return type === 'shows' ? 'backfill_show_metadata' : 'backfill_movie_metadata';
	}

	return type === 'shows' ? 'import_shows' : 'import_movies';
};
