/*
 * Transaction ID checks shared by the lookup form and the diagnosis page.
 *
 * This mirrors the API's own rule (idParamsSchema in
 * src/middleware/validate.ts): the 8-4-4-4-12 hex shape of a Postgres
 * UUID, without requiring an RFC version digit, because the seed IDs
 * (e1111111-0000-...) have a version digit of 0. It exists for fast,
 * specific feedback on typos. The API is still the real boundary.
 */

const TRANSACTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An example in the right shape, shown in hints so people know what to paste. */
export const TRANSACTION_ID_EXAMPLE = "e1111111-0000-0000-0000-000000000002";

/**
 * Cleans up a pasted ID: trims whitespace and lowercases it, so a value
 * copied from an email or a spreadsheet with stray spaces still works.
 */
export function normalizeTransactionId(value: string): string {
  return value.trim().toLowerCase();
}

/** True when `value` (already normalized) has the shape of a transaction ID. */
export function isTransactionId(value: string): boolean {
  return TRANSACTION_ID_PATTERN.test(value);
}
