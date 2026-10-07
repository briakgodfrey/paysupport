import { useId } from "react";

import type { DiagnosisReport } from "../../api/schemas";
import { CopyButton } from "../../components/CopyButton";
import { StatusBadge } from "../../components/StatusBadge";
import { describeAmountDifference, formatCents, formatStatus } from "../../lib/format";
import { explainOutcome } from "./outcomeCopy";
import "./DiagnosisResult.css";

/** Props for {@link DiagnosisResult}. */
export interface DiagnosisResultProps {
  report: DiagnosisReport;
  /** Re-runs the diagnosis. Offered when the processor couldn't be reached. */
  onRetry: () => void;
}

/** One row of the ledger vs processor comparison. */
interface ComparisonRow {
  field: string;
  ledger: string;
  processor: string;
  /** Amounts use monospace so digits line up and can be read back exactly; words like "Pending" don't. */
  monospace: boolean;
  /** null when there's no processor record to compare against. */
  matches: boolean | null;
  /** Extra detail for a mismatch, e.g. "$0.50 higher". */
  difference?: string;
}

function comparisonRows(report: DiagnosisReport): ComparisonRow[] {
  const { internal, vendor } = report;
  if (vendor === null) {
    const missing = report.outcome === "vendor_unavailable" ? "Not available" : "No record";
    return [
      { field: "Status", ledger: formatStatus(internal.status), processor: missing, monospace: false, matches: null },
      {
        field: "Amount",
        ledger: formatCents(internal.amountCents),
        processor: missing,
        monospace: true,
        matches: null,
      },
    ];
  }
  const statusMatches = internal.status.trim().toLowerCase() === vendor.status.trim().toLowerCase();
  const amountMatches = internal.amountCents === vendor.amountCents;
  return [
    {
      field: "Status",
      ledger: formatStatus(internal.status),
      processor: formatStatus(vendor.status),
      monospace: false,
      matches: statusMatches,
    },
    {
      field: "Amount",
      ledger: formatCents(internal.amountCents),
      processor: formatCents(vendor.amountCents),
      monospace: true,
      matches: amountMatches,
      ...(amountMatches ? {} : { difference: describeAmountDifference(internal.amountCents, vendor.amountCents) }),
    },
  ];
}

function valueClass(row: ComparisonRow): string {
  return row.monospace ? "diagnosis-result__value diagnosis-result__value--mono" : "diagnosis-result__value";
}

/**
 * The result of a diagnosis, ordered by what an engineer on a ticket needs:
 * 1. the verdict and what to do next,
 * 2. ledger vs processor, with differences called out in words,
 * 3. customer and reference details, with copyable IDs,
 * 4. the API's raw note, collapsed, for escalations.
 */
export function DiagnosisResult({ report, onRetry }: DiagnosisResultProps) {
  const verdictId = useId();
  const outcome = explainOutcome(report);
  const rows = comparisonRows(report);

  return (
    <div className="diagnosis-result">
      <section
        className={`panel diagnosis-result__verdict diagnosis-result__verdict--${outcome.tone}`}
        aria-labelledby={verdictId}
      >
        <StatusBadge tone={outcome.tone} label={outcome.label} />
        <h2 id={verdictId} className="diagnosis-result__headline">
          {outcome.headline}
        </h2>
        <p className="text-muted">{outcome.explanation}</p>
        <p className="diagnosis-result__next-step">
          <strong>Next step:</strong> {outcome.nextStep}
        </p>
        {report.outcome === "vendor_unavailable" ? (
          <div>
            <button type="button" className="button button--primary" onClick={onRetry}>
              Check the processor again
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel diagnosis-result__section" aria-labelledby={`${verdictId}-comparison`}>
        <h2 id={`${verdictId}-comparison`}>Ledger vs processor</h2>
        <div className="diagnosis-result__table-scroll">
          <table className="diagnosis-result__table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Our ledger</th>
                <th scope="col">Payment processor</th>
                <th scope="col">Comparison</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.field} data-matches={row.matches === null ? "unknown" : String(row.matches)}>
                  <th scope="row">{row.field}</th>
                  <td className={valueClass(row)}>{row.ledger}</td>
                  <td className={valueClass(row)}>{row.processor}</td>
                  <td>
                    {row.matches === null ? (
                      <span className="text-muted">Can’t compare</span>
                    ) : row.matches ? (
                      <span className="diagnosis-result__match">
                        <span aria-hidden="true">✓ </span>Matches
                      </span>
                    ) : (
                      <span className="diagnosis-result__differs">
                        <span aria-hidden="true">✕ </span>Differs
                        {row.difference ? `: processor is ${row.difference}` : null}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel diagnosis-result__section" aria-labelledby={`${verdictId}-details`}>
        <h2 id={`${verdictId}-details`}>Details</h2>
        <dl className="diagnosis-result__details">
          <div>
            <dt>Customer</dt>
            <dd>{report.internal.customerName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{report.internal.accountEmail}</dd>
          </div>
          <div>
            <dt>Card</dt>
            <dd>{report.internal.card ?? "No card (ACH or transfer)"}</dd>
          </div>
          <div>
            <dt>Transaction ID</dt>
            <dd className="diagnosis-result__id">
              <code>{report.transactionId}</code>
              <CopyButton value={report.transactionId} label="transaction ID" />
            </dd>
          </div>
          <div>
            <dt>Processor reference</dt>
            <dd className="diagnosis-result__id">
              {report.internal.vendorRefId ? (
                <>
                  <code>{report.internal.vendorRefId}</code>
                  <CopyButton value={report.internal.vendorRefId} label="processor reference" />
                </>
              ) : (
                "None assigned"
              )}
            </dd>
          </div>
        </dl>

        {/* The API's own note is written for developers. It's kept for escalations, but collapsed so it doesn't compete with the plain-language verdict. */}
        <details className="diagnosis-result__technical">
          <summary>Technical detail</summary>
          <p>{report.notes}</p>
        </details>
      </section>
    </div>
  );
}
