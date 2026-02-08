# Tech Plan: Bulk Upload + Dashboard for jobsapi.ashish.me

## 1. Objective

Build a reliable bulk-ingestion system in `jobsapi.ashish.me` so you can upload CSV exports (starting with Letterboxd movies, then shows), enrich data, and insert canonical records into `api.ashish.me` with visibility, retries, and audit history.

## 2. Scope

### In Scope (Phase 1)
- Movie CSV bulk upload endpoint (Letterboxd format)
- Async processing pipeline with job + row tracking
- Deduping/idempotency checks
- Row-level status (`pending/success/failed/skipped`)
- Basic web dashboard for upload + progress + errors
- Retry failed rows

### Phase 2
- Shows CSV support
- Template download + schema validation UX
- Batch tuning and parallel workers
- Advanced filters/search in dashboard

### Out of Scope (initial)
- Replacing current single-record endpoints
- Direct writes into `api.ashish.me` DB tables (we will write via HTTP API contracts)

## 3. CSV Inputs

### Movies (Letterboxd)
Expected headers:
- `Date`
- `Name`
- `Year`
- `Letterboxd URI`

Example row:
- `2026-02-08,Pride & Prejudice,2005,https://boxd.it/24u8`

### Shows (future)
- Similar structure; adapter/parser will be pluggable per source format.

## 4. High-Level Architecture

1. User uploads CSV from dashboard (or API).
2. API stores file metadata + parsed rows into jobs DB tables.
3. API enqueues a processing job.
4. Worker processes rows in chunks:
   - Normalize and validate row
   - Enrich via OMDb/IMDb
   - Optional dedupe check against `api.ashish.me`
   - Insert via existing `POST https://api.ashish.me/movies` or `/shows`
5. Worker updates row/job status counters.
6. Dashboard polls job progress and displays per-row outcomes.

## 5. Data Storage Strategy

Recommendation: add a small DB layer to `jobsapi.ashish.me` for import tracking only.

Why:
- You need persistent progress/history and retries.
- Processing can be async and resumable.
- Enables dashboard query/filtering.

### DB Source
- Reuse DB credentials from `/Users/ashish/dev/api.ashish.me/.env` (`DATABASE_URL`) but use separate schema/tables for jobsapi import system.
- Keep secrets in env only; do not hardcode.

### Proposed Tables

#### `import_jobs`
- `id` (uuid)
- `type` (`movies`, `shows`)
- `source` (`letterboxd`, future values)
- `status` (`queued`, `processing`, `completed`, `failed`, `partial`)
- `total_rows`, `processed_rows`, `success_rows`, `failed_rows`, `skipped_rows`
- `uploaded_by` (optional string)
- `file_name`
- `started_at`, `completed_at`
- `created_at`, `updated_at`

#### `import_rows`
- `id` (uuid)
- `job_id` (fk)
- `row_number`
- `raw_payload` (jsonb)
- `normalized_payload` (jsonb)
- `status` (`pending`, `processing`, `success`, `failed`, `skipped`)
- `error_code`, `error_message`
- `target_record_id` (id returned by `api.ashish.me`, nullable)
- `attempt_count`
- `created_at`, `updated_at`

#### `import_job_events` (optional but useful)
- `id`, `job_id`, `level`, `message`, `meta`, `created_at`

## 6. API Design (jobsapi)

### Upload + Create Job
- `POST /bulk-import/movies`
- Multipart form-data:
  - `file` (CSV)
  - `source=letterboxd`
  - optional flags: `dryRun`, `skipDuplicates`

Response:
- `jobId`
- parsed row count
- immediate validation summary

### Job Status
- `GET /bulk-import/jobs/:jobId`
- Returns counters + status + recent errors.

### Job Rows
- `GET /bulk-import/jobs/:jobId/rows?status=failed&limit=50&offset=0`

### Retry
- `POST /bulk-import/jobs/:jobId/retry-failed`

### Cancel (optional)
- `POST /bulk-import/jobs/:jobId/cancel`

## 7. Processing Pipeline

### Parsing + Validation
- Use streaming CSV parser (`csv-parse`/`fast-csv`) to avoid memory blowup.
- Strict header match for Letterboxd movie CSV.
- Validate per row:
  - `Date` parseable
  - `Name` non-empty
  - `Year` numeric (optional hard check)
  - URI optional but stored for traceability

### Normalization
- Map CSV row to internal movie seed:
  - `title <- Name`
  - `date <- Date`
  - `yearHint <- Year`
  - `sourceUri <- Letterboxd URI`

### Enrichment + Insert
- Reuse existing movie enrichment flow (`OMDb -> IMDb fallback`) from `MoviesService`.
- Add reusable internal method to avoid duplicating logic between single and bulk inserts.

### Dedupe Strategy
Default: skip probable duplicates.
- Compute dedupe key: normalized title + viewing date (`YYYY-MM-DD`).
- Before insert, query `api.ashish.me` (new lightweight endpoint recommended) or maintain local job-level seen set.
- Row marked `skipped` with reason `duplicate`.

## 8. Dashboard UI Plan

Create a small frontend (prefer separate app under `jobsapi.ashish.me/dashboard`):

### Screens
1. Upload page
- Drag/drop CSV
- Select type (`movies`, later `shows`)
- Source (`letterboxd`)
- Options (`dry run`, `skip duplicates`)

2. Job detail page
- Progress bar + counters
- Live row status table
- Failed rows with error reasons
- Retry failed button

3. Jobs history page
- List previous imports with status and timestamps

### UX Notes
- Show parsing errors before job starts when possible.
- Export failed rows as CSV for correction/reupload.
- Keep styling simple but intentional; mobile-friendly.

## 9. Logging + Observability

- Use Nest logger for job lifecycle events:
  - upload accepted
  - parse summary
  - chunk start/end
  - failures with row number
- Emit compact metrics per job:
  - duration
  - success rate
  - avg row processing time
- Keep PII-free logs.

## 10. Security

- Require API key for bulk endpoints.
- File constraints:
  - max size (for example 10MB initially)
  - CSV mime + extension checks
- Rate limit bulk endpoints.
- Validate and sanitize all CSV inputs.

## 11. Rollout Plan

### Milestone A: Backend foundation
- Add TypeORM + migrations to jobsapi (if not already)
- Create import tables
- Implement upload, status APIs, and worker skeleton

### Milestone B: Movie import
- Letterboxd parser + row validator
- Enrichment/insertion integration
- Retry failed rows

### Milestone C: Dashboard
- Upload UI + job progress UI + failed-row handling

### Milestone D: Shows support
- Add shows CSV adapter + mapping

## 12. Test Plan

### Unit Tests
- CSV parser + header validation
- Row normalization
- Dedupe decision logic
- Error mapping and retry behavior

### Integration Tests
- Upload -> queued job -> processed rows flow
- Partial failure handling and retry
- Idempotent re-run behavior

### E2E (happy path)
- Import sample Letterboxd CSV and verify records created in `api.ashish.me`.

## 13. Suggested Initial Backlog (ordered)

1. Add `BulkImportModule` with controllers/services/entities.
2. Add migrations for `import_jobs` and `import_rows`.
3. Add `POST /bulk-import/movies` + parser/validator.
4. Add async worker (queue or scheduled batch loop).
5. Refactor `MoviesService` to expose reusable `createFromSeed` method.
6. Add `GET /bulk-import/jobs/:jobId` and rows listing endpoint.
7. Add retry endpoint.
8. Build minimal dashboard pages (Upload, Job Detail, History).
9. Add shows adapter.

## 14. Key Decisions

- Keep `api.ashish.me` as source of truth; jobsapi should not write direct domain data tables.
- Use DB in jobsapi for import orchestration/state only.
- Process asynchronously for reliability and UI feedback.
- Build adapter pattern for future sources (Letterboxd now, others later).
