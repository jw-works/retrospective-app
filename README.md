# Retrospective App

Collaborative retrospective board built with Next.js App Router.

## Current Status (February 19, 2026)

The codebase is currently in a backend-hardening phase and has moved from file persistence to PostgreSQL.

Implemented and active right now:
- PostgreSQL persistence via `DATABASE_URL`
- Explicit SQL migrations (`db/migrations/001_init.sql`) applied via `npm run db:migrate`
- Transactional backend store with permission checks and core business rules
- Request rate limiting for API routes
- Integration test suite for backend API behavior (`tests/backend.integration.test.mjs`)
- Playwright E2E browser tests for core facilitator/participant flows
- CI workflow running migrations + typecheck + lint + integration tests
- TypeScript strict checks and ESLint checks passing

Still recommended next:
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
- `.github/workflows/ci.yml`: CI pipeline for quality gates
- `docs/ARCHITECTURE.md`: architecture, operations, and scaling notes

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
- `RATE_LIMIT_ENABLED`: set to `false` to disable API rate limiting (default enabled)
- `RATE_LIMIT_WRITE_LIMIT`: write requests per window per IP (default `120`)
- `RATE_LIMIT_WRITE_WINDOW_MS`: write rate-limit window in ms (default `60000`)
- `RATE_LIMIT_READ_LIMIT`: read requests per window per IP (default `300`)
- `RATE_LIMIT_READ_WINDOW_MS`: read rate-limit window in ms (default `60000`)

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

E2E browser tests:

```bash
npx playwright install
npm run test:e2e
```

## Multi-Session Behavior

The backend supports multiple active sessions concurrently.

How isolation is enforced:
- every query is scoped by `session_id`
- participant tokens are bound to a specific session id
- integration tests include parallel-session isolation checks

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

## Production Checklist

- Configure `AUTH_TOKEN_SECRET` from your secrets manager (do not commit it).
- Keep `RATE_LIMIT_*` values set for your expected traffic profile.
- Ensure automated backups of PostgreSQL and periodic restore drills.
- Enforce CI checks from `.github/workflows/ci.yml` on protected branches.
- Review and remediate `npm audit` output regularly (Dependabot config included).

## Related Docs

- `BACKEND.md` for cURL examples and backend flow details.
- `docs/ARCHITECTURE.md` for system architecture and production operations.
