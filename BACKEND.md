# Retrospective Backend (Barebones)

This project now includes a minimal backend implemented with Next.js route handlers and a PostgreSQL store.

Data is persisted in PostgreSQL using `DATABASE_URL`.

Required env vars:
- `DATABASE_URL` (PostgreSQL connection string)
- `AUTH_TOKEN_SECRET` (recommended outside local dev)

## Quick flow

Run backend integration tests:

```bash
npm run db:migrate
npm run test:backend
```

1. Create session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{"title":"Sprint 9 Retro","adminName":"John"}'
```

2. Join session

```bash
curl -X POST http://localhost:3000/api/sessions/<slug>/join \
  -H 'Content-Type: application/json' \
  -d '{"name":"Priya"}'
```

3. Fetch session state

```bash
curl http://localhost:3000/api/sessions/<slug>/state
```

4. Authenticated calls use the participant token in header:
- `x-participant-token: <token>`

## Implemented rules

- Session creator is admin.
- Join by link (`/session/[slug]/join`).
- Participants list tracks everyone who joined.
- Any participant can add entries (`went_right`, `went_wrong`).
- Each participant can cast at most 5 votes total per session.
- Admin can delete all entries.
- Non-admin participants can only delete their own entries.
- Only admin can change navigation section (`retro`, `discussion`, `happiness`, `done`).
- Happiness is individual submission (1-10) and state returns average.

## Minimal pages

- `http://localhost:3000/create-session`
- `http://localhost:3000/session/<slug>/join`
- `http://localhost:3000/session/<slug>`

These pages are intentionally simple and meant as a working baseline for iteration.
