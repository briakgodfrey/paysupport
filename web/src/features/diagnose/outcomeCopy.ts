import type { DiagnosisReport } from "../../api/schemas";
import type { BadgeTone } from "../../components/StatusBadge";
import { describeAmountDifference, formatCents } from "../../lib/format";

/** Everything the result panel needs to explain a diagnosis in plain language. */
export interface OutcomeExplanation {
  tone: BadgeTone;
  /** Badge text, e.g. "Status mismatch". */
  label: string;
  /** The verdict in one sentence, specific to this transaction. */
  headline: string;
  /** Why this happens, so the engineer understands rather than just follows. */
  explanation: string;
  /** What to do now: the line an engineer under time pressure actually needs. */
  nextStep: string;
}

/*
 * The API's own `notes` are written for developers ("Internal ledger
 * shows 20000c...") and stay available under "Technical detail". This
 * copy is what support engineers read first, and it is specific to the
 * values in the report.
 *
 * Statuses are compared case-insensitively, matching the backend's
 * normalizeStatus().
 */

function status(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Turns a diagnosis report into a verdict, an explanation, and a next
 * step. Exhaustive over every outcome, so adding an outcome to the schema
 * fails typecheck here until it has copy.
 */
export function explainOutcome(report: DiagnosisReport): OutcomeExplanation {
  const ledgerStatus = status(report.internal.status);

  switch (report.outcome) {
    case "match":
      return {
        tone: "success",
        label: "Records match",
        headline: "Our ledger and the processor agree.",
        explanation: `Both show this payment as ${ledgerStatus} for ${formatCents(report.internal.amountCents)}.`,
        nextStep:
          "No fix is needed on our side. If the customer still sees a problem, check what their bank or the app is showing them.",
      };

    case "status_mismatch": {
      const processorStatus = status(report.vendor.status);
      return {
        tone: "warning",
        label: "Status mismatch",
        headline: `Our ledger says ${ledgerStatus}, but the processor says ${processorStatus}.`,
        explanation:
          "The processor is where the money actually moves, so its status is the reliable one. Our ledger is most likely out of date.",
        nextStep: `Tell the customer the payment is ${processorStatus}, and ask engineering to correct the ledger status.`,
      };
    }

    case "amount_mismatch": {
      const difference = describeAmountDifference(report.internal.amountCents, report.vendor.amountCents);
      const processorStatus = status(report.vendor.status);
      /*
       * The API checks the amount before the status and reports only the
       * first problem it finds, so an amount mismatch can hide a status
       * mismatch on the same payment. Without this, an engineer would
       * explain a $0.50 fee and miss that our ledger still says "pending".
       */
      const statusAlsoDiffers = ledgerStatus !== processorStatus;
      return {
        tone: "warning",
        label: "Amount mismatch",
        headline: `The processor’s amount is ${difference} than our ledger.`,
        explanation:
          `Our ledger shows ${formatCents(report.internal.amountCents)} and the processor shows ${formatCents(report.vendor.amountCents)}. A small gap like this is usually a processing fee or rounding that we didn’t record.` +
          (statusAlsoDiffers
            ? ` The status also differs: our ledger says ${ledgerStatus}, but the processor says ${processorStatus}.`
            : ""),
        nextStep: statusAlsoDiffers
          ? `Check the fee schedule before replying to the customer, and tell them the payment is ${processorStatus}. Ask engineering to correct the ledger status, and to review the amount if it isn’t explained by a known fee.`
          : "Check the fee schedule before replying to the customer. Escalate to engineering if the difference isn’t explained by a known fee.",
      };
    }

    case "vendor_not_found":
      return {
        tone: "danger",
        label: "Processor has no record",
        headline: "The processor has no record of this payment.",
        explanation:
          "Our ledger has it, but the processor doesn’t. It may never have been registered with the processor, or the processor’s record was removed.",
        nextStep:
          "Don’t confirm this payment to the customer yet. Escalate to engineering with the transaction ID and processor reference.",
      };

    case "vendor_unavailable":
      return {
        tone: "info",
        label: "Processor unavailable",
        headline: "We couldn’t reach the processor, so there’s no answer yet.",
        explanation: "This is a temporary connection problem. It is not a sign that the payment failed.",
        nextStep: "Don’t tell the customer anything has gone wrong. Check the processor again in a minute.",
      };

    case "no_vendor_ref":
      return {
        tone: "neutral",
        label: "No processor reference",
        headline: "This payment was never sent to the processor.",
        explanation:
          "Internal transfers, and payments that failed before reaching the processor, have no processor record to compare against.",
        nextStep: `Use our ledger status (${ledgerStatus}) when replying to the customer.`,
      };
  }
}
