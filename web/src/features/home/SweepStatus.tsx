import type { VisibleApiFailure } from "../../api/client";
import { describeApiFailure, type FailureMessage } from "../../api/failureMessages";
import { LiveRegion, Notice } from "../../components/Notice";
import { formatTime } from "../../lib/format";
import type { SweepState } from "./useReconciliationSweep";

/** "1 transaction" / "2 transactions". */
function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function failureCopy(failure: VisibleApiFailure): FailureMessage {
  if (failure.kind === "forbidden") {
    return {
      title: "You don’t have access to run sweeps.",
      action: "Engineers and admins can run them. You can still review every finding in the queue below.",
    };
  }
  if (failure.kind === "timeout") {
    // The server keeps sweeping after the browser stops waiting.
    return {
      title: "The sweep is taking longer than expected.",
      action:
        "It may still be running on the server. Refresh the queue in a minute before running it again. Running it twice is safe: open findings aren’t duplicated.",
    };
  }
  return describeApiFailure(failure);
}

/** Props for {@link SweepStatus}. */
export interface SweepStatusProps {
  state: SweepState;
}

/**
 * Progress and results for a reconciliation sweep, announced as they
 * change: progress and success politely, failures assertively.
 */
export function SweepStatus({ state }: SweepStatusProps) {
  return (
    <>
      <LiveRegion politeness="polite">
        {state.status === "running" ? (
          <Notice tone="info" title="Sweep running.">
            <p>
              Checking recent transactions against the payment processor. This can take up to two minutes.
              Stay on this page to see the results.
            </p>
          </Notice>
        ) : null}
        {state.status === "done" ? <SweepSummary state={state} /> : null}
      </LiveRegion>
      <LiveRegion politeness="assertive">
        {state.status === "failed" ? (
          <Notice tone="danger" title={failureCopy(state.failure).title}>
            <p>{failureCopy(state.failure).action}</p>
          </Notice>
        ) : null}
      </LiveRegion>
    </>
  );
}

function SweepSummary({ state }: { state: Extract<SweepState, { status: "done" }> }) {
  const { scanned, matched, discrepanciesFound } = state.summary;
  // The API counts unreachable transactions in `scanned` but in neither total.
  const unchecked = scanned - matched - discrepanciesFound;

  return (
    <Notice tone="success" title={`Sweep complete at ${formatTime(state.finishedAt)}.`}>
      <p>
        Checked {plural(scanned, "transaction")}: {matched} matched and {discrepanciesFound} had discrepancies
        {unchecked > 0 ? `, and ${String(unchecked)} couldn’t be checked` : ""}. The queue below is up to date.
      </p>
      {unchecked > 0 ? (
        <p>
          The processor didn’t answer for {plural(unchecked, "transaction")}, so {unchecked === 1 ? "it wasn’t" : "they weren’t"}{" "}
          marked as discrepancies. Run the sweep again later to check {unchecked === 1 ? "it" : "them"}.
        </p>
      ) : null}
      <p>Discrepancies found includes any that were already open from earlier sweeps.</p>
    </Notice>
  );
}
