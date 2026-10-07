import { useState } from "react";

import { useSession } from "../../auth/SessionContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Page } from "../../components/Page";
import { TransactionLookup } from "../diagnose/TransactionLookup";
import { DiscrepancyQueue } from "./DiscrepancyQueue";
import { MetricsStrip } from "./MetricsStrip";
import { SweepStatus } from "./SweepStatus";
import { useDiscrepancies } from "./useDiscrepancies";
import { useReconciliationSweep } from "./useReconciliationSweep";
import "./HomePage.css";

/**
 * The signed-in workspace: everything a support engineer needs at the
 * start of a ticket on one page.
 *
 * User task: either look up the transaction from a ticket, or work
 * through what reconciliation has flagged. So the order is: headline
 * numbers, the lookup (the most common action, and the page's one primary
 * button), then the queue.
 *
 * Running a sweep is secondary: it's occasional, expensive, and limited to
 * engineers and admins, so it sits in the header behind a confirmation.
 */
export function HomePage() {
  const { user } = useSession();
  const queue = useDiscrepancies();
  const sweep = useReconciliationSweep(queue.reload);
  const [confirmingSweep, setConfirmingSweep] = useState(false);

  // A UX convenience, not access control: the API rejects sweeps from
  // other roles with a 403 no matter what the browser shows.
  const canRunSweep = user?.role === "engineer" || user?.role === "admin";
  const sweepRunning = sweep.state.status === "running";

  return (
    <Page
      eyebrow="Payment operations"
      title="Transaction support"
      description="Investigate a customer’s payment, or review what reconciliation has flagged."
      actions={
        canRunSweep ? (
          <button
            type="button"
            className="button button--secondary"
            aria-disabled={sweepRunning}
            onClick={() => {
              if (!sweepRunning) setConfirmingSweep(true);
            }}
          >
            {sweepRunning ? "Sweep running…" : "Run reconciliation sweep"}
          </button>
        ) : (
          // Explains the missing button instead of showing a dead, disabled one.
          <p className="workspace__role-note">Reconciliation sweeps are run by engineers and admins.</p>
        )
      }
    >
      <SweepStatus state={sweep.state} />

      <MetricsStrip rows={queue.rows} isLoading={queue.isLoading} sweep={sweep.state} />

      <TransactionLookup
        heading="Investigate a payment"
        description="Compare a transaction in our ledger with the live processor record."
      />

      <DiscrepancyQueue
        rows={queue.rows}
        isLoading={queue.isLoading}
        failure={queue.failure}
        onReload={queue.reload}
        canRunSweep={canRunSweep}
      />

      <ConfirmDialog
        open={confirmingSweep}
        title="Run a reconciliation sweep?"
        confirmLabel="Run sweep"
        onConfirm={() => {
          setConfirmingSweep(false);
          sweep.run();
        }}
        onCancel={() => {
          setConfirmingSweep(false);
        }}
      >
        <p>
          This checks up to 100 of the most recent transactions against the payment processor and records any new
          discrepancies.
        </p>
        <p>It sends one request to the processor per transaction and can take up to two minutes.</p>
      </ConfirmDialog>
    </Page>
  );
}
