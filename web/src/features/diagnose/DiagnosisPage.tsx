import { Link, useParams } from "react-router";

import type { VisibleApiFailure } from "../../api/client";
import { describeApiFailure, type FailureMessage } from "../../api/failureMessages";
import { LiveRegion, Notice } from "../../components/Notice";
import { Page } from "../../components/Page";
import { isTransactionId, normalizeTransactionId, TRANSACTION_ID_EXAMPLE } from "../../lib/ids";
import { DiagnosisResult } from "./DiagnosisResult";
import { TransactionLookup } from "./TransactionLookup";
import { useDiagnosis } from "./useDiagnosis";
import "./DiagnosisPage.css";

/** Failures that won't change on retry, so offering "Try again" would only frustrate. */
const PERMANENT_FAILURES: ReadonlySet<VisibleApiFailure["kind"]> = new Set<VisibleApiFailure["kind"]>([
  "not_found",
  "validation",
  "forbidden",
]);

function failureCopy(failure: VisibleApiFailure): FailureMessage {
  // More specific than the generic copy: on this page, a 404 or 400 always means the transaction ID.
  if (failure.kind === "not_found") {
    return {
      title: "There’s no transaction with that ID.",
      action: "Check it against the ticket, character by character. It may also belong to a different environment.",
    };
  }
  if (failure.kind === "validation") {
    return {
      title: "That isn’t a valid transaction ID.",
      action: `Transaction IDs look like ${TRANSACTION_ID_EXAMPLE}.`,
    };
  }
  return describeApiFailure(failure);
}

/** Shortens an ID for the browser tab, where the full UUID wouldn't fit. */
function shortId(id: string): string {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

/**
 * Route component for /diagnose/:transactionId.
 *
 * The ID lives in the URL, so a result can be pasted into a ticket and
 * reopened by anyone signed in. The ID from the URL is untrusted input: it
 * is shown only as plain text, and checked before any request is sent.
 */
export function DiagnosisPage() {
  const { transactionId: rawId = "" } = useParams();
  const id = normalizeTransactionId(rawId);
  const valid = isTransactionId(id);

  return (
    <Page
      eyebrow="Diagnosis"
      title="Transaction diagnosis"
      documentTitle={valid ? `Diagnosis ${shortId(id)}` : "Diagnosis"}
      description={
        <>
          Comparing our ledger with the payment processor for <code className="diagnosis-page__id">{rawId}</code>
        </>
      }
      actions={
        <Link className="button button--secondary" to="/">
          Back to workspace
        </Link>
      }
    >
      {valid ? (
        <DiagnosisContent key={id} transactionId={id} />
      ) : (
        <Notice tone="danger" title="That isn’t a valid transaction ID.">
          <p>
            Transaction IDs look like <code>{TRANSACTION_ID_EXAMPLE}</code>. Check the link, or paste the ID from
            the ticket below.
          </p>
        </Notice>
      )}

      <TransactionLookup
        heading="Diagnose another transaction"
        description="Results open on their own page, so you can share the link."
      />
    </Page>
  );
}

/** Props for {@link DiagnosisContent}. */
interface DiagnosisContentProps {
  transactionId: string;
}

/**
 * Loading, error, and result states for one valid ID. Keyed by the ID in
 * DiagnosisPage, so moving to a different transaction starts from a clean
 * state instead of briefly showing the previous result.
 */
function DiagnosisContent({ transactionId }: DiagnosisContentProps) {
  const { state, retry } = useDiagnosis(transactionId);

  return (
    <>
      {/* Polite: progress and completion shouldn't interrupt whatever a screen reader is saying. */}
      <LiveRegion politeness="polite">
        {state.status === "loading" ? (
          <p className="diagnosis-page__loading">
            <span className="diagnosis-page__spinner" aria-hidden="true" />
            Checking our ledger and the payment processor…
          </p>
        ) : state.status === "success" ? (
          <p className="visually-hidden">Diagnosis complete.</p>
        ) : null}
      </LiveRegion>

      <LiveRegion politeness="assertive">
        {state.status === "failure" ? <FailureNotice failure={state.failure} onRetry={retry} /> : null}
      </LiveRegion>

      {state.status === "success" ? <DiagnosisResult report={state.report} onRetry={retry} /> : null}
    </>
  );
}

/** Props for {@link FailureNotice}. */
interface FailureNoticeProps {
  failure: VisibleApiFailure;
  onRetry: () => void;
}

function FailureNotice({ failure, onRetry }: FailureNoticeProps) {
  const copy = failureCopy(failure);
  return (
    <Notice tone="danger" title={copy.title}>
      <p>{copy.action}</p>
      {PERMANENT_FAILURES.has(failure.kind) ? null : (
        <p className="diagnosis-page__retry">
          <button type="button" className="button button--primary" onClick={onRetry}>
            Try again
          </button>
        </p>
      )}
    </Notice>
  );
}
