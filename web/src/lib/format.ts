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
