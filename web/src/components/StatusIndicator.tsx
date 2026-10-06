import type { ApiHealthStatus } from "../hooks/useApiHealth";
import "./StatusIndicator.css";

const LABELS: Record<ApiHealthStatus, string> = {
  checking: "Checking API…",
  connected: "API connected",
  unavailable: "API unavailable",
};

/** Props for {@link StatusIndicator}. */
export interface StatusIndicatorProps {
  status: ApiHealthStatus;
}

/**
 * Compact API connection pill for the header.
 *
 * The label always states the status in words, and the dot changes shape
 * (solid when connected, hollow ring when unavailable), so the status
 * never depends on colour alone.
 *
 * role="status" makes this a polite live region. Screen readers announce
 * it only when the text changes, so a 30-second poll that keeps returning
 * "connected" stays silent, while a drop to "unavailable" is announced.
 */
export function StatusIndicator({ status }: StatusIndicatorProps) {
  return (
    <p className="status-indicator" data-status={status} role="status">
      <span className="status-indicator__dot" aria-hidden="true" />
      {LABELS[status]}
    </p>
  );
}
