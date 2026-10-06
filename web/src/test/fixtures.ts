import type { z } from "zod";

import type {
  DiagnosisOutcome,
  diagnosisReportSchema,
  discrepancySchema,
  loginResponseSchema,
  reconciliationSummarySchema,
} from "../api/schemas";

/*
 * Wire-format API responses for tests, modelled on db/seed.sql and the
 * vendor mock so they look like what the real API returns.
 *
 * Each fixture is checked with `satisfies` against the schema's input
 * type, so if a schema changes, out-of-date fixtures fail typecheck
 * instead of quietly testing a shape the API no longer sends.
 *
 * These are test-only values: the token is not a real JWT and the
 * credentials don't exist in any database.
 */

/** Shaped like a JWT (three base64url segments) but not signed by anything. */
export const TEST_TOKEN = "test-header.test-payload.test-signature";

export const TEST_CREDENTIALS = {
  email: "engineer@paysupport.test",
  password: "test-password",
};

export const loginResponseFixture = {
  token: TEST_TOKEN,
  user: { id: "22222222-2222-2222-2222-222222222222", email: TEST_CREDENTIALS.email, role: "engineer" },
} satisfies z.input<typeof loginResponseSchema>;

const priyaInternal = {
  status: "pending",
  amountCents: 500000,
  vendorRefId: "vtx_1002",
  customerName: "Priya Natarajan",
  accountEmail: "priya.n@example.com",
  card: null,
};

/** One diagnosis per outcome, keyed by outcome. IDs follow the seed's e1111111-... pattern. */
export const diagnosisFixtures = {
  match: {
    transactionId: "e1111111-0000-0000-0000-000000000001",
    outcome: "match",
    internal: {
      status: "settled",
      amountCents: 4599,
      vendorRefId: "vtx_1001",
      customerName: "Jordan Reyes",
      accountEmail: "jordan.reyes@example.com",
      card: "visa ****4242",
    },
    vendor: { status: "settled", amountCents: 4599 },
    notes: "Internal and vendor records agree. No action needed.",
  },
  status_mismatch: {
    transactionId: "e1111111-0000-0000-0000-000000000002",
    outcome: "status_mismatch",
    internal: priyaInternal,
    vendor: { status: "settled", amountCents: 500000 },
    notes: 'Internal status is "pending" but vendor reports "settled". Internal record is likely stale.',
  },
  amount_mismatch: {
    transactionId: "e1111111-0000-0000-0000-000000000005",
    outcome: "amount_mismatch",
    internal: {
      status: "pending",
      amountCents: 20000,
      vendorRefId: "vtx_1005",
      customerName: "Jordan Reyes",
      accountEmail: "jordan.reyes@example.com",
      card: "visa ****4242",
    },
    vendor: { status: "settled", amountCents: 20050 },
    notes: "Internal ledger shows 20000c, vendor shows 20050c. Check for undisclosed fees or rounding.",
  },
  no_vendor_ref: {
    transactionId: "e1111111-0000-0000-0000-000000000004",
    outcome: "no_vendor_ref",
    internal: {
      status: "failed",
      amountCents: 7500,
      vendorRefId: null,
      customerName: "Elena Cho",
      accountEmail: "elena.cho@example.com",
      card: null,
    },
    vendor: null,
    notes: "This transaction has no vendor reference (internal transfer, or vendor call failed at creation time).",
  },
  vendor_unavailable: {
    transactionId: "e1111111-0000-0000-0000-000000000003",
    outcome: "vendor_unavailable",
    internal: {
      status: "settled",
      amountCents: 12050,
      vendorRefId: "vtx_1003",
      customerName: "Marcus Webb",
      accountEmail: "marcus.webb@example.com",
      card: "mastercard ****5100",
    },
    vendor: null,
    notes: "Vendor API did not respond. Retry later; do not assume failure.",
  },
  // Not in the seed data: the seed has no transaction the vendor has lost.
  vendor_not_found: {
    transactionId: "e1111111-0000-0000-0000-000000000006",
    outcome: "vendor_not_found",
    internal: { ...priyaInternal, vendorRefId: "vtx_9999" },
    vendor: null,
    notes:
      "Vendor has no record of this transaction. Possible causes: vendor-side purge, failed registration, or data corruption.",
  },
} satisfies Record<DiagnosisOutcome, z.input<typeof diagnosisReportSchema>>;

export const reconciliationSummaryFixture = {
  scanned: 4,
  matched: 2,
  discrepanciesFound: 2,
  discrepancies: [
    {
      transactionId: diagnosisFixtures.status_mismatch.transactionId,
      type: "status_mismatch",
      notes: diagnosisFixtures.status_mismatch.notes,
    },
    {
      transactionId: diagnosisFixtures.amount_mismatch.transactionId,
      type: "amount_mismatch",
      notes: diagnosisFixtures.amount_mismatch.notes,
    },
  ],
} satisfies z.input<typeof reconciliationSummarySchema>;

/** Raw snake_case rows, exactly as GET /reconciliation/discrepancies sends them. */
export const discrepancyRowFixtures = [
  {
    id: "f1111111-0000-0000-0000-000000000001",
    transaction_id: diagnosisFixtures.status_mismatch.transactionId,
    discrepancy_type: "status_mismatch",
    internal_status: "pending",
    vendor_status: "settled",
    internal_amount_cents: 500000,
    vendor_amount_cents: 500000,
    resolved: false,
    created_at: "2026-10-06T21:40:12.345Z",
    customer_name: "Priya Natarajan",
    account_email: "priya.n@example.com",
  },
  {
    id: "f1111111-0000-0000-0000-000000000002",
    transaction_id: diagnosisFixtures.amount_mismatch.transactionId,
    discrepancy_type: "amount_mismatch",
    internal_status: "pending",
    vendor_status: "settled",
    internal_amount_cents: 20000,
    vendor_amount_cents: 20050,
    resolved: true,
    created_at: "2026-10-05T14:02:47.000Z",
    customer_name: "Jordan Reyes",
    account_email: "jordan.reyes@example.com",
  },
] satisfies z.input<typeof discrepancySchema>[];
