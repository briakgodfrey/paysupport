#!/usr/bin/env bash
# Quick smoke check for all three moving parts: API, vendor mock, Postgres.
# Usage: ./scripts/health-check.sh
set -uo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
VENDOR_BASE="${VENDOR_BASE:-http://localhost:4100}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-paysupport}"
PGDATABASE="${PGDATABASE:-paysupport}"

status=0

check() {
  local name="$1" url="$2"
  if curl -sf -o /dev/null -m 3 "$url"; then
    echo "OK   $name ($url)"
  else
    echo "FAIL $name ($url)"
    status=1
  fi
}

check "API" "$API_BASE/health"
check "Vendor mock" "$VENDOR_BASE/health"

if command -v pg_isready >/dev/null 2>&1; then
  if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; then
    echo "OK   Postgres ($PGHOST:$PGPORT/$PGDATABASE)"
  else
    echo "FAIL Postgres ($PGHOST:$PGPORT/$PGDATABASE)"
    status=1
  fi
else
  echo "SKIP Postgres check (pg_isready not installed)"
fi

exit $status
