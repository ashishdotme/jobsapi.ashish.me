# jobsapi.ashish.me

Operational wrapper over `api.ashish.me`.

It accepts smaller client payloads, does light parsing/enrichment where needed, proxies catalog reads for the admin UI, and stages long-running work as jobs.

## Auth

Most routes require an API key via `apikey` header or `?apikey=...`.
The `/1/*` listens endpoints are public.

## ListenBrainz Compatibility

The fake ListenBrainz endpoints exist so ListenBrainz-compatible clients can scrobble against `jobsapi.ashish.me`.

- `GET /1/user/:user/listens` supports `count`, `min_ts`, and `max_ts`
- the backend is single-user, so `:user` is accepted for compatibility and is not used to partition data

## Dashboard

`GET /dashboard` serves the admin toolbox UI.

Current workspaces:

- `Imports` for launching CSV ingestion jobs
- `Jobs` for monitoring imports and metadata-repair jobs
- `Movies` for client-side filtering of the full movie catalog and queuing metadata backfill jobs
- `Shows` for the equivalent show maintenance workflow
- `Settings` for storing the dashboard API key locally

The dashboard treats writes as queue-backed operations. Movies and Shows do not mutate records inline; they create background jobs.

## Threads Bridge

`jobsapi.ashish.me` now owns the Threads bridge integration:

- `POST /auth/threads/start` starts the Threads OAuth flow
- `GET /auth/threads/callback` handles the Threads redirect URL and stores the long-lived token locally
- a scheduled bridge polls Threads, writes canonical records to `api.ashish.me /updates`, and publishes them to Bluesky

## Jobs Model

Generalized jobs are exposed through `/ops/*`.

Current job kinds:

- `import_movies`
- `import_shows`
- `backfill_movie_metadata`
- `backfill_show_metadata`

Legacy `/bulk-import/*` routes still exist for compatibility with older clients.

## Endpoints

- `GET /` - health-style root response
- `GET /api` - Swagger UI
- `GET /dashboard` - admin toolbox UI
- `POST /movies`
- `GET /movies`
- `POST /shows`
- `GET /shows`
- `POST /transactions`
- `GET /transactions/total`
- `POST /metrics`
- `POST /locations`
- `GET /1/validate-token`
- `GET /1/user/:user/listens`
- `POST /1/submit-listens`
- `POST /wiki`
- `POST /auth/threads/start`
- `GET /auth/threads/callback`
- `POST /ops/imports/movies`
- `POST /ops/backfills/movies/metadata`
- `POST /ops/backfills/shows/metadata`
- `GET /ops/jobs`
- `GET /ops/jobs/:jobId`
- `GET /ops/jobs/:jobId/rows`
- `POST /ops/jobs/:jobId/retry-failed`
- `POST /bulk-import/movies`
- `GET /bulk-import/jobs`
- `GET /bulk-import/jobs/:jobId`
- `GET /bulk-import/jobs/:jobId/rows`
- `POST /bulk-import/jobs/:jobId/retry-failed`
