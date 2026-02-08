# api.ashish.me

Primary personal-data API and source of truth for your life tracking system.

## Purpose

`api.ashish.me` stores structured personal records across domains like:

- Movies watched
- Shows watched
- Step count and sleep
- Courses completed
- Books read
- Personal quotes collection
- Listens/music history
- Transactions/expenses
- Locations
- Todos and completion state
- Personal notes/wiki entries
- System/events logs

`jobsapi.ashish.me` exists to automate and enrich inserts into this API.

## System Role

- Canonical datastore API for personal history
- Authentication boundary via API keys
- Stable schema target for ingestion tools and jobs
- Query/reporting surface for dashboards and automations

## How jobsapi Uses api.ashish.me

`jobsapi.ashish.me` writes to these main endpoints on your behalf:

- `POST /movies`
- `POST /shows`
- `POST /transactions`
- `GET /transactions`
- `POST /steps`
- `POST /sleep`
- `POST /listens`
- `POST /locations`
- `POST /wiki`
- `POST /events`
- `GET /todos/incomplete`
- `POST /todos`
- `POST /todos/:todoId/completed`

Reference implementation for this integration is in this repo.

## Domain Model (Practical)

### Media

- `movies`: title, description, language, year, genre, viewing date, IMDb metadata, loved flag
- `shows`: show title + season context, started date, status, IMDb metadata, loved flag

### Health

- `steps`: per-day counts and date keys
- `sleep`: per-day sleep duration plus start/end timestamps

### Knowledge + Reflection

- `wiki`: captured notes/memos
- `quotes`: personal quote collection (direct API entry)
- `books`: books read with metadata (direct API entry)
- `courses`: completed courses with metadata (direct API entry)

### Lifestyle + Activity

- `listens`: song/album/artist + listen timestamp
- `locations`: device coordinates, battery metadata, timestamp
- `transactions`: amount, merchant, category, date

### Tasks + Events

- `todos`: task state for integrations (TickTick sync in jobsapi)
- `events`: ingestion/system events and failure signals

## Auth Model

Expected header for protected endpoints:

```http
apikey: <your_api_key>
```

Some clients may pass API key as query string (for compatibility with older jobs clients):

```text
?apikey=<your_api_key>
```

## Integration Contract Guidelines

When writing producers (like `jobsapi`) for `api.ashish.me`:

- Keep client payload minimal.
- Normalize dates before insert.
- Resolve enrichment upstream (OMDb/IMDb, categorization, etc.) before writing.
- Preserve canonical field names in API payloads.
- Emit failure events to `/events` for observability.

## Example Flow: Movie Capture

1. User sends title + optional date to `jobsapi /movies`.
2. Jobs API enriches via OMDb/IMDb.
3. Jobs API posts full movie record to `api.ashish.me /movies`.
4. `api.ashish.me` stores final canonical movie entry.

## Example Flow: Step + Sleep Ingestion

1. Producer sends Apple Health export payload to `jobsapi /metrics`.
2. Jobs API transforms to daily records.
3. Jobs API writes to `api.ashish.me /steps` and `/sleep`.

## Recommended API Characteristics

If you evolve `api.ashish.me`, these characteristics keep integrations stable:

- Consistent auth behavior across resources
- Resource-specific validation with clear 4xx errors
- Idempotency for automated ingest paths where possible
- Predictable date/time handling (UTC normalization)
- Pagination/filtering on list endpoints
- Structured error payloads

## Related Docs

- Jobs wrapper README: `README.md`
