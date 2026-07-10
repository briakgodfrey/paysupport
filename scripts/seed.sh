#!/usr/bin/env bash
# Applies schema.sql and seed.sql to the configured Postgres database.
# Usage: ./scripts/seed.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# shellcheck disable=SC1091
[ -f "$ROOT_DIR/.env" ] && source "$ROOT_DIR/.env"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-paysupport}"
PGDATABASE="${PGDATABASE:-paysupport}"
export PGPASSWORD="${PGPASSWORD:-paysupport}"

echo "==> Applying schema to $PGDATABASE@$PGHOST:$PGPORT"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$ROOT_DIR/db/schema.sql"

echo "==> Loading seed data"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$ROOT_DIR/db/seed.sql"

echo "==> Done. Login with admin@paysupport.dev / password123"
