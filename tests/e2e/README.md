# E2E Tests

These tests run real browser flows using Playwright.

## Prerequisites

- PostgreSQL running and reachable
- `DATABASE_URL` set in `.env.local` or environment

## Install

```bash
npm install
npx playwright install
```

## Run

```bash
npm run test:e2e
```

Headed mode:

```bash
npm run test:e2e:headed
```
