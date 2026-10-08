import type { z } from "zod";

import type {
  DiagnosisOutcome,
  diagnosisReportSchema,
  discrepancySchema,
  loginResponseSchema,
  reconciliationSummarySchema,
} from "../api/schemas";

/*
 * Sample data for the browser-only demo, modelled on db/seed.sql and the
 * vendor mock's deliberate drift, so the demo tells the same story as the
 * real stack: two payments disagree with the processor, one processor call
 * fails, one payment never reached the processor.
 *
 * Kept separate from src/test/fixtures.ts on purpose: tests pin their own
 * data, and changing the demo can never change what a test checks.
 *
 * Every value is fake. The tokens are JWT-shaped but signed by nothing, and
 * the accounts exist only in this file.
 */

export type DemoRole = "admin" | "engineer" | "support";

/** The same demo logins the README documents for the local stack. */
export const DEMO_PASSWORD = "password123";

export const demoUsers: Record<string, z.input<typeof loginResponseSchema>> = {
  "admin@paysupport.dev": {
    token: "demo-header.admin.demo-signature",
    user: { id: "11111111-1111-1111-1111-111111111111", email: "admin@paysupport.dev", role: "admin" },
  },
  "engineer@paysupport.dev": {
    token: "demo-header.engineer.demo-signature",
    user: { id: "22222222-2222-2222-2222-222222222222", email: "engineer@paysupport.dev", role: "engineer" },
  },
  "support@paysupport.dev": {
    token: "demo-header.support.demo-signature",
    user: { id: "33333333-3333-3333-3333-333333333333", email: "support@paysupport.dev", role: "support" },
  },
};

/** Looks up who a bearer token belongs to, the way the API's auth middleware would. */
export function roleForToken(token: string): DemoRole | null {
  const match = Object.values(demoUsers).find((entry) => entry.token === token);
  return match ? match.user.role : null;
}

const jordan = { customerName: "Jordan Reyes", accountEmail: "jordan.reyes@example.com" };
const priya = { customerName: "Priya Natarajan", accountEmail: "priya.n@example.com" };

/** One diagnosis per seeded transaction, plus one the processor has lost. */
export const demoDiagnoses: z.input<typeof diagnosisReportSchema>[] = [
  {
    transactionId: "e1111111-0000-0000-0000-000000000001",
    outcome: "match",
    internal: { status: "settled", amountCents: 4599, vendorRefId: "vtx_1001", ...jordan, card: "visa ****4242" },
    vendor: { status: "settled", amountCents: 4599 },
    notes: "Internal and vendor records agree. No action needed.",
  },
  {
    transactionId: "e1111111-0000-0000-0000-000000000002",
    outcome: "status_mismatch",
    internal: { status: "pending", amountCents: 500000, vendorRefId: "vtx_1002", ...priya, card: null },
    vendor: { status: "settled", amountCents: 500000 },
    notes: 'Internal status is "pending" but vendor reports "settled". Internal record is likely stale.',
  },
  {
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
  {
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
  {
    transactionId: "e1111111-0000-0000-0000-000000000005",
    outcome: "amount_mismatch",
    internal: { status: "pending", amountCents: 20000, vendorRefId: "vtx_1005", ...jordan, card: "visa ****4242" },
    vendor: { status: "settled", amountCents: 20050 },
    notes: "Internal ledger shows 20000c, vendor shows 20050c. Check for undisclosed fees or rounding.",
  },
  {
    // Not in the seed: lets the demo show what a lost processor record looks like.
    transactionId: "e1111111-0000-0000-0000-000000000006",
    outcome: "vendor_not_found",
    internal: { status: "pending", amountCents: 500000, vendorRefId: "vtx_9999", ...priya, card: null },
    vendor: null,
    notes:
      "Vendor has no record of this transaction. Possible causes: vendor-side purge, failed registration, or data corruption.",
  },
];

/** Outcomes a sweep records as discrepancies. */
const DISCREPANCY_OUTCOMES: DiagnosisOutcome[] = ["status_mismatch", "amount_mismatch"];

/**
 * What a sweep finds: every transaction with a processor reference is
 * checked, matching the API's runReconciliation. The unavailable call is
 * counted as checked but isn't a discrepancy, because a timeout isn't drift.
 */
export function sweepResult(): z.input<typeof reconciliationSummarySchema> {
  const checked = demoDiagnoses.filter(
    (d) => d.internal.vendorRefId !== null && d.transactionId !== "e1111111-0000-0000-0000-000000000006",
  );
  const found = checked.filter((d) => DISCREPANCY_OUTCOMES.includes(d.outcome));
  return {
    scanned: checked.length,
    matched: checked.length - found.length,
    discrepanciesFound: found.length,
    discrepancies: found.map((d) => ({
      transactionId: d.transactionId,
      type: d.outcome as "status_mismatch" | "amount_mismatch",
      notes: d.notes,
    })),
  };
}

/** A discrepancy row exactly as GET /reconciliation/discrepancies sends it. */
export function discrepancyRow(
  transactionId: string,
  index: number,
  detectedAt: Date,
): z.input<typeof discrepancySchema> | null {
  const d = demoDiagnoses.find((entry) => entry.transactionId === transactionId);
  if (!d?.vendor) return null;
  return {
    id: `f1111111-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    transaction_id: d.transactionId,
    discrepancy_type: d.outcome as "status_mismatch" | "amount_mismatch",
    internal_status: d.internal.status,
    vendor_status: d.vendor.status,
    internal_amount_cents: d.internal.amountCents,
    vendor_amount_cents: d.vendor.amountCents,
    resolved: false,
    created_at: detectedAt.toISOString(),
    customer_name: d.internal.customerName,
    account_email: d.internal.accountEmail,
  };
}
