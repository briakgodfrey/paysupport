import { query } from "../db/pool";
import { getVendorTransaction } from "./vendor.client";
import { ApiError } from "../middleware/errorHandler";

/**
 * Reconciliation & diagnostics engine.
 *
 * This is the part of the project that maps most directly to the job:
 * "Interface with critical vendor systems using a mix of SQL and API calls
 * to research a customer complaints" + "act as an engineering consultant
 * for Operations to automate manual processes."
 *
 * Two entry points:
 *  - diagnoseTransaction: on-demand, single-transaction deep dive (what a
 *    support engineer runs while on a ticket).
 *  - runReconciliation: batch sweep across recent transactions (what would
 *    run on a schedule / via the bash script to catch drift proactively).
 */

interface TransactionRow {
  id: string;
  account_id: string;
  card_id: string | null;
  type: string;
  amount_cents: number;
  status: string;
  vendor_ref_id: string | null;
  vendor_status: string | null;
  created_at: string;
  customer_name: string;
  account_email: string;
  card_last4: string | null;
  card_network: string | null;
}

const TRANSACTION_JOIN_SQL = `
  SELECT
    t.id, t.account_id, t.card_id, t.type, t.amount_cents, t.status,
    t.vendor_ref_id, t.vendor_status, t.created_at,
    a.customer_name, a.email AS account_email,
    c.last4 AS card_last4, c.network AS card_network
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN cards c ON c.id = t.card_id
`;

export type DiagnosisOutcome =
  | "match"
  | "status_mismatch"
  | "amount_mismatch"
  | "vendor_not_found"
  | "vendor_unavailable"
  | "no_vendor_ref";

export interface DiagnosisReport {
  transactionId: string;
  outcome: DiagnosisOutcome;
  internal: {
    status: string;
    amountCents: number;
    vendorRefId: string | null;
    customerName: string;
    accountEmail: string;
    card: string | null;
  };
  vendor: {
    status: string;
    amountCents: number;
  } | null;
  notes: string;
}

async function fetchTransactionRow(transactionId: string): Promise<TransactionRow> {
  const { rows } = await query<TransactionRow>(`${TRANSACTION_JOIN_SQL} WHERE t.id = $1`, [transactionId]);
  if (!rows[0]) throw new ApiError(404, "not_found", `No transaction with id ${transactionId}`);
  return rows[0];
}

export async function diagnoseTransaction(transactionId: string): Promise<DiagnosisReport> {
  const row = await fetchTransactionRow(transactionId);

  const internal = {
    status: row.status,
    amountCents: row.amount_cents,
    vendorRefId: row.vendor_ref_id,
    customerName: row.customer_name,
    accountEmail: row.account_email,
    card: row.card_last4 ? `${row.card_network} ****${row.card_last4}` : null,
  };

  if (!row.vendor_ref_id) {
    return {
      transactionId,
      outcome: "no_vendor_ref",
      internal,
      vendor: null,
      notes: "This transaction has no vendor reference (internal transfer, or vendor call failed at creation time).",
    };
  }

  const lookup = await getVendorTransaction(row.vendor_ref_id, 1);

  if (!lookup.found) {
    return {
      transactionId,
      outcome: lookup.reason === "not_found" ? "vendor_not_found" : "vendor_unavailable",
      internal,
      vendor: null,
      notes:
        lookup.reason === "not_found"
          ? "Vendor has no record of this transaction. Possible causes: vendor-side purge, failed registration, or data corruption."
          : "Vendor API did not respond. Retry later; do not assume failure.",
    };
  }

  const vendor = { status: lookup.transaction.status, amountCents: lookup.transaction.amountCents };

  if (row.amount_cents !== vendor.amountCents) {
    return {
      transactionId,
      outcome: "amount_mismatch",
      internal,
      vendor,
      notes: `Internal ledger shows ${row.amount_cents}c, vendor shows ${vendor.amountCents}c. Check for undisclosed fees or rounding.`,
    };
  }

  if (normalizeStatus(row.status) !== normalizeStatus(vendor.status)) {
    return {
      transactionId,
      outcome: "status_mismatch",
      internal,
      vendor,
      notes: `Internal status is "${row.status}" but vendor reports "${vendor.status}". Internal record is likely stale.`,
    };
  }

  return {
    transactionId,
    outcome: "match",
    internal,
    vendor,
    notes: "Internal and vendor records agree. No action needed.",
  };
}

// Both sides use slightly different vocabularies for the same real-world
// state (e.g. our "settled" vs. vendor's "settled" -- but this is where
// you'd map any vendor-specific terms like "captured" or "posted").
function normalizeStatus(status: string): string {
  return status.toLowerCase().trim();
}

export interface ReconciliationSummary {
  scanned: number;
  matched: number;
  discrepanciesFound: number;
  discrepancies: Array<{ transactionId: string; type: string; notes: string }>;
}

/**
 * Batch sweep: pull every transaction with a vendor_ref_id that isn't
 * already flagged, diagnose each one, and persist any new discrepancies.
 * Intended to be run periodically (see scripts/reconcile.sh) rather than
 * on every request.
 */
export async function runReconciliation(limit = 100): Promise<ReconciliationSummary> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM transactions WHERE vendor_ref_id IS NOT NULL ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );

  const summary: ReconciliationSummary = { scanned: 0, matched: 0, discrepanciesFound: 0, discrepancies: [] };

  for (const { id } of rows) {
    summary.scanned += 1;
    const report = await diagnoseTransaction(id);

    if (report.outcome === "match") {
      summary.matched += 1;
      continue;
    }
    if (report.outcome === "vendor_unavailable" || report.outcome === "no_vendor_ref") {
      // Not a discrepancy -- transient or not applicable.
      continue;
    }

    // Avoid piling up duplicate unresolved rows for the same transaction.
    const { rows: existing } = await query(
      `SELECT id FROM reconciliation_discrepancies WHERE transaction_id = $1 AND resolved = false`,
      [id]
    );
    if (existing.length === 0) {
      await query(
        `INSERT INTO reconciliation_discrepancies
           (transaction_id, discrepancy_type, internal_status, vendor_status, internal_amount_cents, vendor_amount_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          report.outcome,
          report.internal.status,
          report.vendor?.status ?? null,
          report.internal.amountCents,
          report.vendor?.amountCents ?? null,
        ]
      );
    }

    summary.discrepanciesFound += 1;
    summary.discrepancies.push({ transactionId: id, type: report.outcome, notes: report.notes });
  }

  return summary;
}

export async function listDiscrepancies(resolved?: boolean) {
  if (resolved === undefined) {
    const { rows } = await query(
      `SELECT d.*, a.customer_name, a.email AS account_email
       FROM reconciliation_discrepancies d
       JOIN transactions t ON t.id = d.transaction_id
       JOIN accounts a ON a.id = t.account_id
       ORDER BY d.created_at DESC`
    );
    return rows;
  }
  const { rows } = await query(
    `SELECT d.*, a.customer_name, a.email AS account_email
     FROM reconciliation_discrepancies d
     JOIN transactions t ON t.id = d.transaction_id
     JOIN accounts a ON a.id = t.account_id
     WHERE d.resolved = $1
     ORDER BY d.created_at DESC`,
    [resolved]
  );
  return rows;
}
