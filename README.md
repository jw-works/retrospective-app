# Retrospective App

Collaborative retrospective board built with Next.js App Router.

## Current Status (February 19, 2026)

The codebase is currently in a backend-hardening phase and has moved from file persistence to PostgreSQL.

Implemented and active right now:
- PostgreSQL persistence via `DATABASE_URL`
- Explicit SQL migrations (`db/migrations/001_init.sql`) applied via `npm run db:migrate`
- Transactional backend store with permission checks and core business rules
- Integration test suite for backend API behavior (`tests/backend.integration.test.mjs`)
- TypeScript strict checks and ESLint checks passing

Still recommended next:
- Add CI pipeline for migrations + lint + tests
- Add frontend end-to-end tests (Playwright/Cypress)
- Address npm audit vulnerabilities with controlled package upgrades

## What The App Does

- Creates a retrospective session with one admin/facilitator
- Lets participants join via link/session slug
- Supports `went_right` and `went_wrong` entries
- Enforces a 5-vote cap per participant
- Supports grouping and moving entries
- Uses shared admin navigation (`retro` -> `discussion` -> `actions` -> `happiness` -> `done`)
- Stores individual happiness scores and computes aggregate metrics
- Supports action item creation/deletion (admin only)

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Radix UI primitives
- PostgreSQL (`pg`)

## Project Structure

- `app/page.tsx`: main client orchestration (setup/join/session flow)
- `app/api/sessions/**`: backend HTTP routes
- `lib/backend/store.ts`: business logic + Postgres persistence layer
- `lib/backend/types.ts`: shared backend/frontend types
- `lib/backend/http.ts`: API error/token helpers
- `lib/retro/api.ts`: frontend API client
- `scripts/db-migrate.mjs`: SQL migration runner
- `db/migrations/001_init.sql`: initial schema migration
- `tests/backend.integration.test.mjs`: integration tests against running Next server

## Data Model

Main persisted entities:
- `sessions`
- `participants`
- `entries`
- `entry_groups`
- `votes`
- `happiness_checks`
- `navigation`
- `action_items`
- `schema_migrations`

Notes:
- Participant auth tokens are self-signed HMAC tokens and are not stored in Postgres.
- Backend expects schema to exist; run migrations before running app or tests.

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string

Recommended:
- `AUTH_TOKEN_SECRET`: signing secret for participant tokens

Optional:
- `PGSSLMODE=require`: use for hosted Postgres that requires TLS
- `AUTH_TOKEN_TTL_SECONDS`: participant token TTL (default `43200`)
- `ERROR_MONITORING_WEBHOOK_URL`: optional error webhook

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Apply DB migrations:

```bash
npm run db:migrate
```

3. Start dev server:

```bash
npm run dev
```

4. Open:

- `http://localhost:3000`

## Testing

Type check:

```bash
npx tsc --noEmit
```

Lint:

```bash
npm run lint
```

Backend integration tests (default backend test command):

```bash
npm run db:migrate
npm run test:backend
```

## API Summary

All routes are under `/api/sessions`.

- `POST /api/sessions`
- `POST /api/sessions/:slug/join`
- `GET /api/sessions/:slug/state`
- `POST /api/sessions/:slug/entries`
- `DELETE /api/sessions/:slug/entries`
- `PATCH /api/sessions/:slug/entries/:entryId`
- `DELETE /api/sessions/:slug/entries/:entryId`
- `POST /api/sessions/:slug/entries/:entryId/move`
- `POST /api/sessions/:slug/votes`
- `DELETE /api/sessions/:slug/votes/:entryId`
- `POST /api/sessions/:slug/navigation`
- `POST /api/sessions/:slug/happiness`
- `POST /api/sessions/:slug/groups`
- `POST /api/sessions/:slug/groups/:groupId/entries`
- `DELETE /api/sessions/:slug/groups/:groupId/entries/:entryId`
- `POST /api/sessions/:slug/actions`
- `DELETE /api/sessions/:slug/actions/:actionId`

Authenticated endpoints require:
- `x-participant-token: <token>`

## Deployment Notes

- Ensure `DATABASE_URL` is configured in runtime environment.
- Run `npm run db:migrate` during deploy/startup before serving traffic.
- For managed Postgres with TLS requirements, set `PGSSLMODE=require`.

## Related Docs

- `BACKEND.md` for cURL examples and backend flow details.
