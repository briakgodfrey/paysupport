import type { Discrepancy } from "../../api/schemas";
import type { SweepState } from "./useReconciliationSweep";
import "./MetricsStrip.css";

/** Props for {@link MetricsStrip}. */
export interface MetricsStripProps {
  rows: Discrepancy[] | null;
  isLoading: boolean;
  sweep: SweepState;
}

/** Placeholder while numbers load: an ellipsis for sight, the word "Loading" for screen readers. */
function Pending() {
  return (
    <>
      <span aria-hidden="true">…</span>
      <span className="visually-hidden">Loading</span>
    </>
  );
}

/**
 * Four headline numbers at the top of the workspace, so an engineer can
 * see at a glance whether anything needs attention before scrolling.
 *
 * Marked up as a description list: each label (dt) is announced with its
 * value (dd), which a grid of styled divs would lose.
 */
export function MetricsStrip({ rows, isLoading, sweep }: MetricsStripProps) {
  const open = rows?.filter((row) => !row.resolved) ?? null;

  function count(predicate: (row: Discrepancy) => boolean) {
    if (open === null) return isLoading ? <Pending /> : "Unavailable";
    return String(open.filter(predicate).length);
  }

  const unchecked =
    sweep.status === "done"
      ? sweep.summary.scanned - sweep.summary.matched - sweep.summary.discrepanciesFound
      : 0;

  return (
    <dl className="metrics">
      <div className="metric">
        <dt>Open discrepancies</dt>
        <dd className="metric__value">{count(() => true)}</dd>
        <dd className="metric__note">Payments that need attention</dd>
      </div>
      <div className="metric">
        <dt>Status mismatches</dt>
        <dd className="metric__value">{count((row) => row.type === "status_mismatch")}</dd>
        <dd className="metric__note">Ledger and processor disagree on state</dd>
      </div>
      <div className="metric">
        <dt>Amount mismatches</dt>
        <dd className="metric__value">{count((row) => row.type === "amount_mismatch")}</dd>
        <dd className="metric__note">Ledger and processor disagree on value</dd>
      </div>
      <div className="metric metric--brand">
        <dt>Last sweep</dt>
        {sweep.status === "done" ? (
          <>
            <dd className="metric__value">
              {sweep.summary.scanned}
              <span className="metric__unit"> checked</span>
            </dd>
            <dd className="metric__note">
              {sweep.summary.matched} matched, {sweep.summary.discrepanciesFound} found
              {unchecked > 0 ? `, ${String(unchecked)} unchecked` : ""}
            </dd>
          </>
        ) : (
          <>
            <dd className="metric__value metric__value--empty">
              {sweep.status === "running" ? "Running…" : "None yet"}
            </dd>
            <dd className="metric__note">Sweeps run this session appear here</dd>
          </>
        )}
      </div>
    </dl>
  );
}
