# jobsapi.ashish.me

Automation wrapper API for inserting enriched records into `api.ashish.me` with minimal manual input.

## What This Service Does

`jobsapi.ashish.me` is a thin ingestion layer that accepts small payloads (for example: movie title + date), enriches them using external sources (OMDb/IMDb), transforms payloads into your canonical schema, and writes them to `api.ashish.me`.

This is designed to reduce manual entry effort for personal tracking.

## Relationship to api.ashish.me

- `api.ashish.me`: source of truth for personal data (movies, shows, steps, sleep, transactions, listens, notes/wiki, locations, todos, etc.)
- `jobsapi.ashish.me`: helper service that automates data creation and synchronization into `api.ashish.me`

Detailed documentation for the main API is in `docs/api.ashish.me.md`.

## Tech Stack

- NestJS 10 (TypeScript)
- Axios for upstream API calls
- Swagger at `/api`
- Scheduled jobs via `@nestjs/schedule`

## Architecture

1. Client sends small payload to `jobsapi.ashish.me`.
2. Jobs API validates/minimally parses input.
3. Jobs API enriches/normalizes data when needed.
4. Jobs API forwards final payload to `https://api.ashish.me/<resource>` with your API key.
5. Failures can emit events to `https://api.ashish.me/events`.

## Authentication

Most endpoints require an API key that is forwarded to `api.ashish.me`.

Supported patterns:

- Query param: `?apikey=<key>`
- Header: `apikey: <key>`
- ListenBrainz-compatible endpoint uses: `Authorization: Token <key>`

If no key is provided, endpoints usually return:

```json
{ "error": "Apikey cannot be blank" }
```

## Environment Variables

Create `.env` with:

```bash
OMDB=<omdb_api_key>
ASHISHDOTME_TOKEN=<api_key_for_todo_sync_job>
TICKTICK_TOKEN=<ticktick_access_token>
```

## Run Locally

```bash
npm install
npm run start:dev
```

Service runs on `http://localhost:3000`.
Swagger UI: `http://localhost:3000/api`

## Docker

```bash
docker build -t jobsapi .
docker run --rm -p 3000:3000 --env-file .env jobsapi
```

## Endpoint Reference

### `POST /movies`

Minimal payload:

```json
{
  "title": "The Social Network",
  "date": "2026-02-08",
  "loved": true
}
```

Optional fields:

- `date`
- `startDate`
- `endDate`
- `loved`

Behavior:

- Looks up title in OMDb (`http://www.omdbapi.com`)
- Falls back to `https://imdb.ashish.me` if OMDb fails
- Builds full movie payload (description, year, genre, IMDb rating/id, viewing date)
- Writes to `POST https://api.ashish.me/movies`

### `POST /shows`

Minimal payload:

```json
{
  "title": "Severance",
  "seasonNumber": 1,
  "date": "2026-02-08",
  "loved": true
}
```

Behavior:

- Enriches from OMDb
- Creates canonical show payload (season title, showName, metadata, startedDate)
- Writes to `POST https://api.ashish.me/shows`

### `POST /transactions`

Payload:

```json
{
  "transaction": "24.99 Starbucks",
  "date": "2026-02-08T00:00:00.000Z"
}
```

Behavior:

- Parses `transaction` into amount + merchant
- Auto-categorizes by keyword map (`src/data/categories.ts`)
- Falls back to `Miscellaneous`
- Writes to `POST https://api.ashish.me/transactions`

### `GET /transactions/total`

Behavior:

- Fetches transactions from `GET https://api.ashish.me/transactions`
- Returns total spend and per-category totals

Response shape:

```json
{
  "total": "1234.56",
  "categories": {
    "Food": 120.34,
    "Transport": 56.78
  }
}
```

### `POST /metrics`

Accepts Apple Health style metrics payload and forwards normalized metrics.

Behavior:

- `step_count` metric -> `POST https://api.ashish.me/steps`
- `sleep_analysis` metric -> `POST https://api.ashish.me/sleep`
- Computes sleep duration from `sleepStart` and `sleepEnd`

### `POST /locations`

Payload includes array of location points; only latest point is used.

Behavior:

- Extracts final location record
- Converts battery level to percentage integer
- Writes to `POST https://api.ashish.me/locations`

### ListenBrainz-compatible endpoints

- `GET /1/validate-token`
- `POST /1/submit-listens`

`/1/submit-listens` behavior:

- Parses latest listen payload
- Maps to `{ title, album, artist, listenDate }`
- Writes to `POST https://api.ashish.me/listens`

### `POST /wiki`

Payload example:

```json
{
  "memo": {
    "content": "Use partial indexes when cardinality is low"
  }
}
```

Behavior:

- Maps to `{ content, category: "Tech", date }`
- Writes to `POST https://api.ashish.me/wiki`

## Scheduled Sync Job

`TasksService` runs every 60 seconds.

Flow:

1. Pull tasks from TickTick.
2. Pull incomplete todos from `api.ashish.me`.
3. Create missing todos in `api.ashish.me`.
4. Mark todos completed in `api.ashish.me` when TickTick task is completed.

Used endpoints:

- `GET https://api.ashish.me/todos/incomplete`
- `POST https://api.ashish.me/todos`
- `POST https://api.ashish.me/todos/:todoId/completed`

## Error Handling + Events

On some ingestion failures, jobs API emits events:

- `create_movie_failed`
- `create_show_failed`
- `create_listen_failed`
- `create_transaction_failed`
- `create_memo_failed`

Emitted to:

- `POST https://api.ashish.me/events`

## Notes / Current Behavior Details

- `loved` currently defaults to `true` in movie/show payload mapping when omitted.
- Date randomization is supported for date ranges via `startDate` + optional `endDate`.
- Most transforms are intentionally lightweight and optimized for low-friction capture.

## Scripts

```bash
npm run build
npm run start
npm run start:dev
npm run lint
npm run test
npm run test:e2e
```
