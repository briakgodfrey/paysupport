# PaySupport — Transaction Diagnostics & Reconciliation API

A backend project built to mirror the day-to-day of a **fintech production support / support engineering** role: a customer reports a problem with their money, and you have to cross-reference internal SQL records against a third-party vendor (card network / ACH processor) API to figure out what actually happened — then automate that investigation so it doesn't have to be done by hand every time.

## The problem it solves

Payments move through two systems that don't always agree: your own database, and the vendor who actually processed the money. When they drift out of sync, customers file support tickets ("why does the app say pending when my money already left my account?"). Someone has to run a SQL query, hit a vendor API, compare the two, and figure out which one is stale.

PaySupport turns that manual investigation into a repeatable engineering tool:

- **`GET /transactions/:id/diagnose`** — the on-demand version. Pulls the transaction (joined with account + card info via raw SQL), calls the vendor live, and returns a structured diff: match, status mismatch, amount mismatch, vendor has no record, or vendor unreachable.
- **`POST /reconciliation/run`** — the batch version. Sweeps recent transactions, runs the same comparison on each, and persists any new discrepancies so nothing has to wait for a customer to notice first.
- **`scripts/reconcile.sh`** — the automation version. Wraps the above in a script suitable for a cron job or scheduled task, exits non-zero when drift is found so it can trip an alert.

## Architecture

```
┌─────────────┐      REST      ┌──────────────┐      REST      ┌──────────────┐
│   Client /   │ ─────────────▶ │  PaySupport   │ ─────────────▶ │  Vendor Mock  │
│  support UI  │                │      API      │                │ (processor/   │
└─────────────┘                │ (Express+TS)  │                │  ACH sim)     │
                                └──────┬────────┘                └──────────────┘
                                       │  raw SQL (pg)
                                       ▼
                                ┌──────────────┐
                                │  PostgreSQL   │
                                └──────────────┘
```

- **`src/`** — the API: Express + TypeScript, raw SQL via `node-postgres` (no ORM, so every query is visible and reviewable), JWT auth, Zod request validation, structured JSON logging, and an append-only audit log for every mutating or diagnostic action.
- **`vendor-mock/`** — a standalone Express service that plays the part of a card/ACH processor. It deliberately drifts from the internal DB on a few seeded transactions (a stale "pending" that's actually settled, an amount that's off by a processing fee) so the reconciliation engine has real discrepancies to find, plus randomized 503s to exercise retry logic.
- **`db/schema.sql` / `db/seed.sql`** — the data model and demo data.
- **`scripts/`** — bash automation: seed the database, run a reconciliation sweep against a running API, health-check all three services.

## Data model

`accounts` → `cards` → `transactions` → `support_tickets`, plus `audit_log` (append-only trail) and `reconciliation_discrepancies` (findings from the engine). See `db/schema.sql` for full DDL, constraints, and indexes.

## Running it

**Docker (fastest):**

```bash
docker compose up --build
```

This brings up Postgres (auto-seeded), the vendor mock, and the API. API is at `http://localhost:4000`, interactive docs at `http://localhost:4000/docs`.

**Locally:**

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

Demo logins (all use password `password123`), one per role:

| Email | Role | Can run reconciliation sweeps |
|---|---|---|
| `admin@paysupport.dev` | admin | Yes |
| `engineer@paysupport.dev` | engineer | Yes |
| `support@paysupport.dev` | support | No (gets a 403) |

These are local demo credentials only.

## Try the core workflow

```bash
# Log in
TOKEN=$(curl -s -X POST localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@paysupport.dev","password":"password123"}' | jq -r .token)

# Diagnose a transaction the seed data knows is drifted (vendor settled it,
# internal DB still says "pending")
curl -s localhost:4000/transactions/t1111111-0000-0000-0000-000000000002/diagnose \
  -H "Authorization: Bearer $TOKEN" | jq

# Or sweep everything at once
curl -s -X POST localhost:4000/reconciliation/run \
  -H "Authorization: Bearer $TOKEN" | jq

# Same thing via the automation script
./scripts/reconcile.sh
```

## Tests

```bash
npm test
```

Unit tests cover the reconciliation/diagnosis logic (all five outcome branches: match, status mismatch, amount mismatch, vendor-not-found, no-vendor-ref) with the DB and vendor client mocked, plus route-level tests for auth, validation, and 404 handling.

## Stack

Node.js, TypeScript, Express, PostgreSQL (raw SQL via `node-postgres`), JWT auth, Zod validation, Jest + Supertest, Docker Compose, OpenAPI/Swagger.

## What's deliberately out of scope

No real payment processor integration (the vendor is a mock by design — same shape as a real one, without the compliance overhead), no frontend, no real production deployment config beyond the Dockerfiles (a real deploy would add this to AWS via RDS + ECS/Lambda and CloudWatch for the logging currently just written to stdout).
