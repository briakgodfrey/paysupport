import type { DiscrepancyType, UserRole } from "../api/schemas";

/*
 * Human-readable formatting for values shown in the UI. Formatters are
 * created once because Intl constructors are relatively expensive and
 * these run on every render.
 */

/** Uses the browser's locale so times read naturally wherever the engineer is. */
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Formats a clock time with seconds, e.g. "2:41:07 PM". Seconds matter for
 * "last checked" style labels, where minutes alone would look frozen.
 */
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

/**
 * Date and time with the year, e.g. "Oct 6, 2026, 5:40 PM". Discrepancies
 * can be weeks old, and engineers quote these times to customers, so a
 * bare "Oct 6" isn't enough.
 */
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Formats an ISO timestamp from the API for display. Falls back to the raw value if it can't be parsed. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormatter.format(date);
}

/**
 * The API stores money as integer cents and returns no currency. The
 * schema's default is USD (db/schema.sql), so that's assumed here. If the
 * API ever returns a currency, pass it through instead.
 */
const moneyFormatter = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

/** Formats integer cents as money, e.g. 20050 becomes "$200.50". */
export function formatCents(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

/**
 * Describes how far the processor's amount is from the ledger's, e.g.
 * "$0.50 higher". Engineers need the size and direction of the gap, not
 * just "they differ".
 *
 * @param ledgerCents - Our internal amount.
 * @param processorCents - The processor's amount.
 */
export function describeAmountDifference(ledgerCents: number, processorCents: number): string {
  const difference = processorCents - ledgerCents;
  if (difference === 0) return "The same amount";
  return `${formatCents(Math.abs(difference))} ${difference > 0 ? "higher" : "lower"}`;
}

/** Formats a ledger or processor status for display, e.g. "pending" becomes "Pending". Unknown values pass through. */
export function formatStatus(status: string): string {
  const trimmed = status.trim();
  return trimmed === "" ? "Unknown" : trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const ROLE_LABELS: Record<UserRole, string> = {
  support: "Support",
  engineer: "Engineer",
  admin: "Admin",
};

/** Formats a role for display, e.g. "engineer" becomes "Engineer". */
export function formatRole(role: UserRole): string {
  return ROLE_LABELS[role];
}

const DISCREPANCY_TYPE_LABELS: Record<DiscrepancyType, string> = {
  status_mismatch: "Status mismatch",
  amount_mismatch: "Amount mismatch",
  vendor_not_found: "Processor has no record",
};

/** Plain-language label for a discrepancy type. "Vendor" is internal jargon; users say "processor". */
export function formatDiscrepancyType(type: DiscrepancyType): string {
  return DISCREPANCY_TYPE_LABELS[type];
}
