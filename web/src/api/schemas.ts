import { z } from "zod";

/*
 * Runtime schemas for every API response. TypeScript types are derived
 * from these with z.infer, so the compile-time types can never drift from
 * what is actually checked at runtime.
 *
 * Each schema mirrors the backend source, not the OpenAPI file, which
 * leaves most response bodies untyped. References point at the code that
 * produces each shape.
 *
 * z.object() strips unknown keys by default. That is deliberate: if the
 * API starts returning extra fields (for example something sensitive added
 * by mistake), they never reach component state.
 *
 * Strictness policy: fields that drive UI logic (outcomes, roles,
 * discrepancy types) are strict enums, so an unexpected value fails loudly
 * instead of rendering the wrong guidance. Display-only text such as
 * ledger and vendor statuses stays z.string(), so a new status value shows
 * as-is instead of breaking the whole screen.
 */

// ---- Shared building blocks ----

/**
 * Money in integer cents. The API parses Postgres BIGINT into a JS number
 * (src/db/pool.ts); .int() rejects fractions and anything outside the
 * safe-integer range, where cents would silently lose precision.
 */
const centsSchema = z.number().int();

/** Postgres timestamps serialised by JSON.stringify, e.g. "2026-10-06T21:31:55.123Z". */
const timestampSchema = z.iso.datetime({ offset: true });

/** Error body from src/middleware/errorHandler.ts and auth.ts. `message` is missing on one requireRole branch. */
export const apiErrorBodySchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

/** The `{ error, message }` body the API sends with 4xx and 5xx responses. */
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

// ---- GET /health (src/app.ts) ----

/** "ok" is the only healthy value, so anything else counts as unavailable. */
export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
});

/** A healthy response from GET /health. */
export type Health = z.infer<typeof healthSchema>;

// ---- POST /auth/login (src/services/auth.service.ts) ----

/** Roles from the users table CHECK constraint (db/schema.sql). */
export const userRoleSchema = z.enum(["support", "engineer", "admin"]);

/** A staff member's role. Engineers and admins can run reconciliation sweeps. */
export type UserRole = z.infer<typeof userRoleSchema>;

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  role: userRoleSchema,
});

/** The signed-in staff member, as returned by the API. */
export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * The token must look like a JWT: three base64url segments. The client
 * never decodes or trusts its contents (the API verifies it), but checking
 * the shape guarantees it is safe to put in an Authorization header. A
 * value containing a newline or other control characters could otherwise
 * make every later request fail, or inject extra header content.
 */
const jwtSchema = z
  .string()
  .max(4096)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "Expected a JWT");

export const loginResponseSchema = z.object({
  token: jwtSchema,
  user: authUserSchema,
});

/** A successful sign-in: the bearer token plus who it belongs to. */
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ---- GET /transactions/:id/diagnose (src/services/reconciliation.service.ts) ----

/** Outcomes where the vendor returned a record, so both sides can be compared. */
const comparedOutcomeSchema = z.enum(["match", "status_mismatch", "amount_mismatch"]);

/** Outcomes where there is no vendor record to compare against. */
const uncomparedOutcomeSchema = z.enum(["vendor_not_found", "vendor_unavailable", "no_vendor_ref"]);

/** Every possible diagnosis result. */
export const diagnosisOutcomeSchema = z.enum([...comparedOutcomeSchema.options, ...uncomparedOutcomeSchema.options]);

/** The verdict of a single-transaction diagnosis. */
export type DiagnosisOutcome = z.infer<typeof diagnosisOutcomeSchema>;

const internalSideSchema = z.object({
  status: z.string(),
  amountCents: centsSchema,
  vendorRefId: z.string().nullable(),
  customerName: z.string(),
  accountEmail: z.string(),
  /** Pre-formatted by the API, e.g. "visa ****4242". Null for ACH and transfers. */
  card: z.string().nullable(),
});

const vendorSideSchema = z.object({
  status: z.string(),
  amountCents: centsSchema,
});

const diagnosisBase = {
  transactionId: z.string(),
  internal: internalSideSchema,
  notes: z.string(),
};

/**
 * A discriminated union on `outcome`: vendor data is present exactly when
 * the outcome says it should be. The backend guarantees this pairing, and
 * encoding it here means the UI can't render a "match" with no vendor
 * side, and TypeScript narrows `vendor` to non-null after checking
 * the outcome.
 */
export const diagnosisReportSchema = z.discriminatedUnion("outcome", [
  z.object({ ...diagnosisBase, outcome: comparedOutcomeSchema, vendor: vendorSideSchema }),
  z.object({ ...diagnosisBase, outcome: uncomparedOutcomeSchema, vendor: z.null() }),
]);

/**
 * Internal ledger vs. live vendor record for one transaction. Note that
 * vendor outages arrive here as outcome "vendor_unavailable" in a 200
 * response, not as an HTTP error.
 */
export type DiagnosisReport = z.infer<typeof diagnosisReportSchema>;

// ---- Reconciliation (src/services/reconciliation.service.ts) ----

/** Only these three are ever persisted (db/schema.sql CHECK constraint). */
export const discrepancyTypeSchema = z.enum(["status_mismatch", "amount_mismatch", "vendor_not_found"]);

/** The kind of disagreement a reconciliation sweep recorded. */
export type DiscrepancyType = z.infer<typeof discrepancyTypeSchema>;

const countSchema = z.number().int().nonnegative();

export const reconciliationSummarySchema = z.object({
  scanned: countSchema,
  matched: countSchema,
  /**
   * Includes discrepancies that were already open from an earlier sweep,
   * so this is "found", not "new". Transactions where the vendor was
   * unreachable are counted in `scanned` but in neither total.
   */
  discrepanciesFound: countSchema,
  discrepancies: z.array(
    z.object({
      transactionId: z.string(),
      type: discrepancyTypeSchema,
      notes: z.string(),
    }),
  ),
});

/** Result of POST /reconciliation/run. */
export type ReconciliationSummary = z.infer<typeof reconciliationSummarySchema>;

/**
 * One row from GET /reconciliation/discrepancies. The API returns raw
 * snake_case database columns (unlike the camelCase diagnose endpoint).
 * The transform converts them at the boundary so the rest of the UI only
 * ever sees one naming convention.
 */
export const discrepancySchema = z
  .object({
    id: z.string(),
    transaction_id: z.string(),
    discrepancy_type: discrepancyTypeSchema,
    internal_status: z.string().nullable(),
    vendor_status: z.string().nullable(),
    internal_amount_cents: centsSchema.nullable(),
    vendor_amount_cents: centsSchema.nullable(),
    resolved: z.boolean(),
    created_at: timestampSchema,
    customer_name: z.string(),
    account_email: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    transactionId: row.transaction_id,
    type: row.discrepancy_type,
    internalStatus: row.internal_status,
    vendorStatus: row.vendor_status,
    internalAmountCents: row.internal_amount_cents,
    vendorAmountCents: row.vendor_amount_cents,
    resolved: row.resolved,
    createdAt: row.created_at,
    customerName: row.customer_name,
    accountEmail: row.account_email,
  }));

/** A recorded reconciliation finding, in the UI's camelCase shape. */
export type Discrepancy = z.output<typeof discrepancySchema>;

/** The endpoint wraps rows in `{ discrepancies }`; callers only need the array. */
export const discrepancyListSchema = z
  .object({ discrepancies: z.array(discrepancySchema) })
  .transform((body) => body.discrepancies);
