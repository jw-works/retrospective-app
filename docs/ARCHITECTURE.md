# Retrospective Architecture

## Overview

This is a single Next.js application that serves both:
- frontend UI (App Router pages)
- backend API (`/api/sessions/*` route handlers)

The backend persists data in PostgreSQL and uses HMAC-signed participant tokens for auth.

## Runtime Topology

- `npm run dev` (or `npm run start`) runs one Next.js process.
- API routes call `backendStore` in `lib/backend/store.ts`.
- `backendStore` talks to PostgreSQL using pooled connections (`pg`).

No separate backend service process is required for this codebase.

## Core Components

- `app/page.tsx`
  - Main client orchestration.
  - Polls session state and sends mutations through `lib/retro/api.ts`.

- `app/api/sessions/**`
  - Route handlers validate input shape and auth headers.
  - Request throttling is applied via `enforceRequestRateLimit`.

- `lib/backend/store.ts`
  - Source of truth for business rules and permissions.
  - Uses SQL transactions for all write operations.
  - Session scoping is enforced by `session_id` in every query path.

- `lib/backend/auth.ts`
  - Issues/verifies participant tokens signed by `AUTH_TOKEN_SECRET`.

- `db/migrations/*.sql` + `scripts/db-migrate.mjs`
  - Schema versioning and bootstrap.

## Data Model

Main tables:
- `sessions`
- `participants`
- `entries`
- `entry_groups`
- `votes`
- `happiness_checks`
- `navigation`
- `action_items`
- `schema_migrations`

Key relationships:
- almost all child tables reference `sessions(id)` with `ON DELETE CASCADE`
- votes, actions, happiness rows are session-scoped

## Session Isolation and Multi-Session Behavior

Multiple sessions can run concurrently without data bleed.

Why isolation works:
- all domain objects are keyed by `session_id`
- every read/write query in the store filters by session scope
- participant tokens include `sessionId`; token verification rejects cross-session usage

This supports many active sessions at once (limited by DB and app capacity).

## Request Flow

1. User action triggers frontend API call.
2. Route handler validates payload and token.
3. Rate-limit guard checks per-IP request budget.
4. Store method executes in SQL transaction.
5. Updated read model is returned to client.

## Security and Operational Controls

Implemented:
- HMAC token auth (`AUTH_TOKEN_SECRET`)
- permission checks (admin vs participant)
- SQL parameterization (no string-interpolated SQL)
- request rate limiting (`RATE_LIMIT_*` env vars)
- migration tracking via `schema_migrations`

Recommended further hardening:
- centralize rate limiting in Redis for multi-instance strict consistency
- add WAF/CDN edge protection
- add secret rotation runbook for `AUTH_TOKEN_SECRET`

## Deployment Sequence

1. Set env vars (`DATABASE_URL`, `AUTH_TOKEN_SECRET`, optional `PGSSLMODE=require`).
2. Run `npm run db:migrate`.
3. Start app (`npm run start`).
4. Run backend integration tests in CI/CD before promotion.

## Backup and Recovery

Minimum operational baseline:
- periodic `pg_dump` backups
- restore drills into staging
- migration rollback strategy (forward-fix preferred)

Example backup command:

```bash
pg_dump "$DATABASE_URL" -Fc -f retrospective_$(date +%Y%m%d_%H%M%S).dump
```

Example restore command:

```bash
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" retrospective_<timestamp>.dump
```
