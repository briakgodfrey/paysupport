# PaySupport: Transaction Diagnostics & Reconciliation

A full-stack project (Express API + React dashboard) built to mirror the day-to-day of a **fintech production support / support engineering** role: a customer reports a problem with their money, and you have to cross-reference internal SQL records against a third-party vendor (card network / ACH processor) API to figure out what actually happened. Then automate that investigation so it doesn't have to be done by hand every time.

## The problem it solves

Payments move through two systems that don't always agree: your own database, and the vendor who actually processed the money. When they drift out of sync, customers file support tickets ("why does the app say pending when my money already left my account?"). Someone has to run a SQL query, hit a vendor API, compare the two, and figure out which one is stale.

PaySupport turns that manual investigation into a repeatable engineering tool:

- **`GET /transactions/:id/diagnose`**: the on-demand version. Pulls the transaction (joined with account + card info via raw SQL), calls the vendor live, and returns a structured diff: match, status mismatch, amount mismatch, vendor has no record, or vendor unreachable.
- **`POST /reconciliation/run`**: the batch version. Sweeps recent transactions, runs the same comparison on each, and persists any new discrepancies so nothing has to wait for a customer to notice first.
- **`scripts/reconcile.sh`**: the automation version. Wraps the above in a script suitable for a cron job or scheduled task, exits non-zero when drift is found so it can trip an alert.
- **`web/`**: the human version. A support dashboard where an engineer pastes a transaction ID from a ticket and gets a plain-language verdict and next step, plus a queue of everything reconciliation has flagged.

## Architecture

```
┌──────────────┐      REST      ┌──────────────┐      REST      ┌──────────────┐
│   Support     │ ─────────────▶ │  PaySupport   │ ─────────────▶ │  Vendor Mock  │
│  dashboard    │                │      API      │                │ (processor/   │
│ (React + TS)  │                │ (Express+TS)  │                │  ACH sim)     │
└──────────────┘                └──────┬────────┘                └──────────────┘
                                        │  raw SQL (pg)
                                        ▼
                                 ┌──────────────┐
                                 │  PostgreSQL   │
                                 └──────────────┘
```

- **`web/`**: the dashboard. React + TypeScript (strict) on Vite, React Router, and Zod to validate every API response at runtime. Plain CSS built on design tokens with light and dark themes, WCAG 2.2 AA as the accessibility target, and the session token kept in memory only. Tested with Vitest, Testing Library, and MSW.
- **`src/`**: the API. Express + TypeScript, raw SQL via `node-postgres` (no ORM, so every query is visible and reviewable), JWT auth, Zod request validation (including path params, so a malformed ID is a 400, not a 500), structured JSON logging, and an append-only audit log for every mutating or diagnostic action.
- **`vendor-mock/`**: a standalone Express service that plays the part of a card/ACH processor. It deliberately drifts from the internal DB on a few seeded transactions (a stale "pending" that's actually settled, an amount that's off by a processing fee) so the reconciliation engine has real discrepancies to find, plus randomized 503s to exercise retry logic.
- **`db/schema.sql` / `db/seed.sql`**: the data model and demo data.
- **`scripts/`**: bash automation: seed the database, run a reconciliation sweep against a running API, health-check all three services.

## Data model

`accounts` → `cards` → `transactions` → `support_tickets`, plus `audit_log` (append-only trail) and `reconciliation_discrepancies` (findings from the engine). See `db/schema.sql` for full DDL, constraints, and indexes.

## Running it

**1. Backend (Docker, fastest):**

```bash
docker compose up -d --build
```

This brings up Postgres (auto-seeded), the vendor mock, and the API. API is at `http://localhost:4000`, interactive docs at `http://localhost:4000/docs`.

**Or locally:**

```bash
# 1. Start Postgres yourself, then:
cp .env.example .env
npm install
./scripts/seed.sh

# 2. In another terminal:
cd vendor-mock && npm install && npm run dev

# 3. Back in the root:
npm run dev
```

**2. Dashboard** (needs Node 22.22 or newer):

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. In development, Vite proxies `/api` to the API on port 4000, so there's no API URL to configure.

Demo logins for the dashboard and the API (all use password `password123`), one per role:

| Email | Role | Can run reconciliation sweeps |
|---|---|---|
| `admin@paysupport.dev` | admin | Yes |
| `engineer@paysupport.dev` | engineer | Yes |
| `support@paysupport.dev` | support | No (gets a 403) |

These are local demo credentials only.

## Try the core workflow

In the dashboard: sign in as `engineer@paysupport.dev`, paste `e1111111-0000-0000-0000-000000000002` into "Investigate a payment", and you'll get a status mismatch (our ledger says pending, the processor says settled) with what to tell the customer. Or run a reconciliation sweep from the workspace and watch the queue fill in.

Or straight against the API:

```bash
# Log in
TOKEN=$(curl -s -X POST localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@paysupport.dev","password":"password123"}' | jq -r .token)

# Diagnose a transaction the seed data knows is drifted (vendor settled it,
# internal DB still says "pending")
curl -s localhost:4000/transactions/e1111111-0000-0000-0000-000000000002/diagnose \
  -H "Authorization: Bearer $TOKEN" | jq

# Or sweep everything at once
curl -s -X POST localhost:4000/reconciliation/run \
  -H "Authorization: Bearer $TOKEN" | jq

# Same thing via the automation script
./scripts/reconcile.sh
```

## Tests

**API:**

```bash
npm test
```

Unit tests cover the reconciliation/diagnosis logic (all five outcome branches: match, status mismatch, amount mismatch, vendor-not-found, no-vendor-ref) with the DB and vendor client mocked, plus route-level tests for auth, validation, malformed IDs, and 404 handling.

**Dashboard:**

```bash
cd web
npm run check
```

Runs the typecheck, lint (including accessibility rules), and the test suite. The tests drive the app the way a user would, against a mocked API: every diagnosis outcome, sign-in and session expiry, the reconciliation sweep and its confirmation, role-based UI, and the loading, empty, and error states.

## Stack

**API:** Node.js, TypeScript, Express, PostgreSQL (raw SQL via `node-postgres`), JWT auth, Zod validation, Jest + Supertest, Docker Compose, OpenAPI/Swagger.

**Dashboard:** React, TypeScript, Vite, React Router, Zod, plain CSS with design tokens, Vitest, Testing Library, MSW.

## What's deliberately out of scope

- **No real payment processor integration.** The vendor is a mock by design: same shape as a real one, without the compliance overhead.
- **No production deployment config beyond the Dockerfiles.** A real deploy would put the API on AWS via RDS + ECS/Lambda, with CloudWatch for the logging that's currently written to stdout, and serve the dashboard from the same origin behind a reverse proxy.
- **The dashboard session lives in memory,** so refreshing the page signs you out. That keeps the token away from XSS. The production path is an httpOnly, Secure, SameSite cookie set by the API, which needs a logout endpoint and CSRF protection.
- **Discrepancies can't be resolved from the dashboard yet.** The API has no endpoint for it, so the "Resolved" view explains that rather than pretending.
