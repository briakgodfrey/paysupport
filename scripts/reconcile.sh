#!/usr/bin/env bash
# Triggers a reconciliation sweep against the running API and prints a
# human-readable summary. Intended to be wired into a cron job / scheduled
# task in a real deployment so drift gets caught before a customer notices.
#
# Usage: ./scripts/reconcile.sh [api_base_url] [email] [password]
set -euo pipefail

API_BASE="${1:-http://localhost:4000}"
EMAIL="${2:-admin@paysupport.dev}"
PASSWORD="${3:-password123}"

command -v jq >/dev/null 2>&1 || { echo "jq is required (brew install jq / apt install jq)"; exit 1; }

echo "==> Logging in as $EMAIL"
TOKEN=$(curl -sf -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed" >&2
  exit 1
fi

echo "==> Running reconciliation sweep"
RESULT=$(curl -sf -X POST "$API_BASE/reconciliation/run" -H "Authorization: Bearer $TOKEN")

SCANNED=$(echo "$RESULT" | jq -r '.scanned')
MATCHED=$(echo "$RESULT" | jq -r '.matched')
FOUND=$(echo "$RESULT" | jq -r '.discrepanciesFound')

echo "Scanned: $SCANNED  Matched: $MATCHED  New discrepancies: $FOUND"

if [ "$FOUND" -gt 0 ]; then
  echo "--- Discrepancies ---"
  echo "$RESULT" | jq -r '.discrepancies[] | "\(.transactionId)  [\(.type)]  \(.notes)"'
  exit 2  # non-zero exit so a cron/CI wrapper can alert on drift
fi

echo "No discrepancies found."
