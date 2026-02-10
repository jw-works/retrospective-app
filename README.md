# Retrospective App

A collaborative retrospective board built with Next.js App Router.

## What This App Does

- Creates a retrospective session with one admin/facilitator.
- Lets participants join by shared link/session slug.
- Supports adding "went right" and "went wrong" entries.
- Enforces per-user vote limit (5 votes).
- Allows grouping and drag/drop organization of entries.
- Keeps all participants synchronized to the admin-controlled stage:
  - `retro` -> `discussion` -> `happiness` -> `done`
- Stores individual happiness scores and exposes average/count.

## Tech Stack

- Next.js 16 (App Router)
- React + TypeScript
- Tailwind CSS 4
- Radix UI primitives (`Dialog`) + lightweight shadcn-style wrappers
- File-backed backend store (`data/retro-store.json`)

## Project Structure

- `app/page.tsx`
: Main client page. Orchestrates session setup/join, board interactions, polling, and stage rendering.
- `components/retro/retro-column.tsx`
: Reusable board column UI for both "went right" and "went wrong".
- `components/ui/*`
: Shared primitives (`Button`, `Dialog`) used across the app.
- `lib/retro/api.ts`
: Frontend API client for all `/api/sessions/*` calls.
- `lib/retro/session-storage.ts`
: Browser storage helpers for active session slug/token.
- `lib/retro/utils.ts`
: Frontend utilities (join-code parsing, initials/tone selection, entry->UI shaping).
- `lib/discussion.ts`
: Pure sorting and queue-building logic for discussion stage.
- `lib/backend/store.ts`
: Core business logic + persistence (JSON store + permission/rule enforcement).
- `lib/backend/types.ts`
: Shared domain contracts for backend and frontend.
- `lib/backend/http.ts`
: Route-level helpers for consistent auth/error mapping.
- `app/api/sessions/**`
: HTTP route handlers that validate request shape and delegate to `backendStore`.
- `scripts/backend-smoke-test.sh`
: End-to-end backend smoke tests.

## Data Model and Persistence

Data is persisted to:

- `data/retro-store.json`

Main entities:

- `sessions`
- `participants`
- `entries`
- `groups`
- `votes`
- `happinessChecks`
- `navigation`
- `authTokens`

Notes:

- This is simple file-based persistence intended for local/small deployments.
- Concurrent writes are serialized through an in-process queue in `lib/backend/store.ts`.

## Local Development

Requirements:

- Node.js 18+ (Node 20+ recommended)
- npm

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Open:

- `http://localhost:3000`

## Environment Variables

- `AUTH_TOKEN_SECRET`
: HMAC secret used to sign participant tokens. Set this in every non-local environment.
- `AUTH_TOKEN_TTL_SECONDS` (optional)
: Participant token lifetime in seconds. Default: `43200` (12 hours).
- `ERROR_MONITORING_WEBHOOK_URL` (optional)
: If set, server errors are posted as JSON payloads to this webhook in addition to structured logs.

## Testing

Type check:

```bash
npx tsc --noEmit
```

Backend smoke tests:

```bash
npm run test:backend
```

## API Summary

All APIs are under `/api/sessions`.

- `POST /api/sessions` -> create session + admin token
- `POST /api/sessions/:slug/join` -> join as participant
- `GET /api/sessions/:slug/state` -> full read model
- `POST /api/sessions/:slug/entries` -> create entry
- `DELETE /api/sessions/:slug/entries` -> clear all entries (admin only)
- `DELETE /api/sessions/:slug/entries/:entryId` -> delete entry
- `POST /api/sessions/:slug/votes` -> add vote
- `DELETE /api/sessions/:slug/votes/:entryId` -> remove vote
- `POST /api/sessions/:slug/navigation` -> set shared stage (admin only)
- `POST /api/sessions/:slug/happiness` -> upsert happiness score
- `POST /api/sessions/:slug/groups` -> create group
- `POST /api/sessions/:slug/groups/:groupId/entries` -> add entry to group
- `DELETE /api/sessions/:slug/groups/:groupId/entries/:entryId` -> ungroup entry
- `POST /api/sessions/:slug/entries/:entryId/move` -> move entry side

Authenticated endpoints require:

- Header: `x-participant-token: <token>`

## Business Rules Implemented

- Session creator is admin.
- Non-admin users can delete only their own entries.
- Admin can clear all entries.
- Vote cap is 5 votes per participant.
- Only admin can move the shared navigation section.
- Happiness score range is 1..10.
- Grouping only allowed for entries on the same side.

## Deployment

### Option A: Vercel (quickest)

1. Push repo to GitHub/GitLab/Bitbucket.
2. Import project in Vercel.
3. Build command: `npm run build`
4. Start command: `npm run start` (handled automatically by Vercel).

Important for file-backed persistence:

- Vercel serverless filesystem is ephemeral.
- `data/retro-store.json` will not be durable across deployments/instances.
- For production, migrate `lib/backend/store.ts` to a real database.

### Option B: Docker / VM (persistent disk)

Build:

```bash
npm ci
npm run build
```

Run:

```bash
npm run start
```

Persist data:

- Ensure `data/` is on a persistent volume.
- Back up `data/retro-store.json`.

## Production Hardening Recommendations

- Replace JSON file store with PostgreSQL/SQLite + proper migrations.
- Rotate `AUTH_TOKEN_SECRET` periodically and keep it in your secrets manager.
- Add server-side rate limiting for session/join/vote endpoints.
- Add integration tests for UI flows (Playwright/Cypress).
- Add observability (structured logs + error monitoring).

## Related Docs

- `BACKEND.md`: backend smoke usage and cURL examples.
