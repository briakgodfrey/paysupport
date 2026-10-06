import type { UserRole } from "../api/schemas";

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

const ROLE_LABELS: Record<UserRole, string> = {
  support: "Support",
  engineer: "Engineer",
  admin: "Admin",
};

/** Formats a role for display, e.g. "engineer" becomes "Engineer". */
export function formatRole(role: UserRole): string {
  return ROLE_LABELS[role];
}
