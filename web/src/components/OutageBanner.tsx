import { useId } from "react";

import { HEALTH_POLL_INTERVAL_MS } from "../hooks/useApiHealth";
import { formatTime } from "../lib/format";
import "./OutageBanner.css";

/** Props for {@link OutageBanner}. */
export interface OutageBannerProps {
  /** When the last failed check finished, shown so the engineer knows the status is current. */
  lastCheckedAt: Date | null;
  /** True while a re-check is running, so the button can confirm the click registered. */
  isChecking: boolean;
  onCheckNow: () => void;
}

const POLL_SECONDS = Math.round(HEALTH_POLL_INTERVAL_MS / 1000);

/**
 * In-page alert shown while the API is unavailable.
 *
 * The header pill alone is easy to miss under time pressure. This banner
 * explains the impact ("diagnoses won't work") before the engineer types a
 * transaction ID and hits a confusing error, and gives them one action.
 *
 * It is deliberately not a live region: the header StatusIndicator already
 * announces the change, and announcing twice would be noise.
 */
export function OutageBanner({ lastCheckedAt, isChecking, onCheckNow }: OutageBannerProps) {
  const titleId = useId();

  return (
    <section className="outage-banner" aria-labelledby={titleId}>
      <h2 className="outage-banner__title" id={titleId}>
        Can’t reach the PaySupport API
      </h2>
      <p>
        Diagnoses and reconciliation sweeps won’t work until the connection is back. The API may be down, or
        your network connection may have dropped.
      </p>
      <p className="outage-banner__meta">
        {lastCheckedAt ? <>Last checked at {formatTime(lastCheckedAt)}. </> : null}
        We’ll keep checking every {POLL_SECONDS} seconds.
      </p>
      <div>
        <button type="button" className="button button--secondary" onClick={onCheckNow}>
          {isChecking ? "Checking…" : "Check now"}
        </button>
      </div>
    </section>
  );
}
