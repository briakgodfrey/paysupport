import "./StatusBadge.css";

/** The meaning a badge conveys. Maps to the status colour pairs in tokens.css. */
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

/**
 * One glyph per tone, so badges differ in shape as well as colour (for
 * colour-blind users and greyscale printouts). Hidden from screen readers:
 * the text label already says it.
 */
const TONE_ICONS: Record<BadgeTone, string> = {
  success: "✓",
  warning: "!",
  danger: "✕",
  info: "i",
  neutral: "•",
};

/** Props for {@link StatusBadge}. */
export interface StatusBadgeProps {
  tone: BadgeTone;
  /** The status in words, e.g. "Amount mismatch". Always required: colour is never the only signal. */
  label: string;
}

/** A compact status label with a tone colour and a matching icon. */
export function StatusBadge({ tone, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span className="status-badge__icon" aria-hidden="true">
        {TONE_ICONS[tone]}
      </span>
      {label}
    </span>
  );
}
