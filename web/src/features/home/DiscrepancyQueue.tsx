import { useId, useState } from "react";
import { Link } from "react-router";

import type { FailureMessage } from "../../api/failureMessages";
import type { Discrepancy } from "../../api/schemas";
import { CopyButton } from "../../components/CopyButton";
import { LiveRegion, Notice } from "../../components/Notice";
import { StatusBadge, type BadgeTone } from "../../components/StatusBadge";
import { TextField } from "../../components/TextField";
import { formatCents, formatDateTime, formatDiscrepancyType, formatStatus } from "../../lib/format";
import "./DiscrepancyQueue.css";

/** Which rows the queue shows. */
export type QueueFilter = "open" | "resolved" | "all";

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "open", label: "Needs attention" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All findings" },
];

const TYPE_TONES: Record<Discrepancy["type"], BadgeTone> = {
  status_mismatch: "warning",
  amount_mismatch: "warning",
  vendor_not_found: "danger",
};

function matchesFilter(row: Discrepancy, filter: QueueFilter): boolean {
  if (filter === "all") return true;
  return filter === "open" ? !row.resolved : row.resolved;
}

/** Case-insensitive search across the fields an engineer would have from a ticket. */
function matchesQuery(row: Discrepancy, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return [row.customerName, row.accountEmail, row.transactionId, formatDiscrepancyType(row.type)]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/** Props for {@link DiscrepancyQueue}. */
export interface DiscrepancyQueueProps {
  rows: Discrepancy[] | null;
  isLoading: boolean;
  failure: FailureMessage | null;
  onReload: () => void;
  /** Tailors the empty-state advice: engineers can run a sweep, support can't. */
  canRunSweep: boolean;
}

/**
 * The list of reconciliation findings, filterable by state and searchable
 * by customer, email, or transaction ID.
 *
 * Each row links to the full diagnosis, so the queue is a starting point
 * for investigation rather than a dead end.
 */
export function DiscrepancyQueue({ rows, isLoading, failure, onReload, canRunSweep }: DiscrepancyQueueProps) {
  const headingId = useId();
  const filterLabelId = useId();
  const [filter, setFilter] = useState<QueueFilter>("open");
  const [query, setQuery] = useState("");

  const all = rows ?? [];
  const counts: Record<QueueFilter, number> = {
    open: all.filter((row) => !row.resolved).length,
    resolved: all.filter((row) => row.resolved).length,
    all: all.length,
  };
  const visible = all.filter((row) => matchesFilter(row, filter) && matchesQuery(row, query));
  const filterLabel = FILTERS.find((option) => option.value === filter)?.label ?? "";

  return (
    <section className="panel queue" aria-labelledby={headingId}>
      <div className="queue__header">
        <div className="queue__intro">
          <h2 id={headingId}>Discrepancy queue</h2>
          <p className="text-muted">Payments where our ledger and the processor disagreed during a sweep.</p>
        </div>
        {/* aria-disabled rather than disabled: the button keeps focus and stays discoverable while a load runs. */}
        <button
          type="button"
          className="button button--secondary"
          aria-disabled={isLoading}
          onClick={() => {
            if (!isLoading) onReload();
          }}
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="queue__toolbar">
        {/*
          A labelled group of toggle buttons. role="group" is what makes the
          label count: an aria-label on a plain div is ignored by screen readers.
        */}
        <div className="queue__filters" role="group" aria-labelledby={filterLabelId}>
          <span id={filterLabelId} className="visually-hidden">
            Show
          </span>
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="queue__filter"
              aria-pressed={filter === option.value}
              onClick={() => {
                setFilter(option.value);
              }}
            >
              {option.label} <span className="queue__filter-count">({counts[option.value]})</span>
            </button>
          ))}
        </div>
        <div className="queue__search">
          <TextField
            label="Search"
            type="search"
            hint="Customer, email, or transaction ID"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>
      </div>

      {failure ? (
        <div className="queue__notice">
          <Notice tone="danger" title={`Couldn’t load the queue. ${failure.title}`}>
            <p>{failure.action}</p>
            <p className="queue__retry">
              <button type="button" className="button button--secondary" onClick={onReload}>
                Try again
              </button>
            </p>
          </Notice>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div className="queue__scroll">
          <table className="queue__table">
            <caption className="visually-hidden">
              {filterLabel}: {visible.length} of {all.length} findings
            </caption>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Transaction</th>
                <th scope="col">Discrepancy</th>
                <th scope="col">Our ledger</th>
                <th scope="col">Processor</th>
                <th scope="col">Detected</th>
                <th scope="col">
                  <span className="visually-hidden">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <QueueRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          isLoading={isLoading && rows === null}
          unavailable={rows === null && failure !== null}
          filter={filter}
          query={query}
          canRunSweep={canRunSweep}
        />
      )}

      {/* Announces how many rows match after each filter or search change. */}
      <div className="queue__footer">
        <LiveRegion politeness="polite">
          {rows === null ? null : (
            <p>
              Showing {visible.length} of {all.length} {all.length === 1 ? "finding" : "findings"}
            </p>
          )}
        </LiveRegion>
        <p className="text-muted">Every investigation is recorded in the audit log.</p>
      </div>
    </section>
  );
}

function QueueRow({ row }: { row: Discrepancy }) {
  return (
    <tr>
      <td>
        <span className="queue__primary">{row.customerName}</span>
        <span className="queue__secondary">{row.accountEmail}</span>
      </td>
      <td>
        <span className="queue__id">
          <code>{row.transactionId}</code>
          <CopyButton value={row.transactionId} label={`transaction ID for ${row.customerName}`} />
        </span>
      </td>
      <td>
        <StatusBadge tone={row.resolved ? "success" : TYPE_TONES[row.type]} label={formatDiscrepancyType(row.type)} />
        <span className="queue__secondary">{row.resolved ? "Resolved" : "Needs review"}</span>
      </td>
      <td>
        <span className="queue__primary queue__amount">
          {row.internalAmountCents === null ? "No amount" : formatCents(row.internalAmountCents)}
        </span>
        <span className="queue__secondary">{row.internalStatus ? formatStatus(row.internalStatus) : "No status"}</span>
      </td>
      <td>
        <span className="queue__primary queue__amount">
          {row.vendorAmountCents === null ? "No record" : formatCents(row.vendorAmountCents)}
        </span>
        <span className="queue__secondary">{row.vendorStatus ? formatStatus(row.vendorStatus) : "No record"}</span>
      </td>
      <td>{formatDateTime(row.createdAt)}</td>
      <td>
        {/*
          "Investigate" alone would repeat on every row; the hidden text names
          the customer for screen reader link lists. The space sits outside
          the span: accessible names trim each element's edges, so a space
          inside it would be read as "InvestigatePriya".
        */}
        <Link className="queue__action" to={`/diagnose/${encodeURIComponent(row.transactionId)}`}>
          Investigate <span className="visually-hidden">{row.customerName}’s transaction</span>
        </Link>
      </td>
    </tr>
  );
}

/** Props for {@link EmptyState}. */
interface EmptyStateProps {
  isLoading: boolean;
  unavailable: boolean;
  filter: QueueFilter;
  query: string;
  canRunSweep: boolean;
}

/** Explains why the table is empty and what to do, for each reason it can be empty. */
function EmptyState({ isLoading, unavailable, filter, query, canRunSweep }: EmptyStateProps) {
  let title: string;
  let body: string;

  if (isLoading) {
    title = "Loading findings…";
    body = "Fetching the latest reconciliation results.";
  } else if (unavailable) {
    title = "Findings are unavailable right now.";
    body = "Use Try again above once the API is reachable.";
  } else if (query.trim() !== "") {
    title = `No findings match “${query.trim()}”.`;
    body = "Try a customer name, an email address, or the start of a transaction ID.";
  } else if (filter === "open") {
    title = "No open discrepancies.";
    body = canRunSweep
      ? "Everything checked so far agrees. Run a sweep to check the latest payments."
      : "Everything checked so far agrees. New findings appear here after an engineer runs a sweep.";
  } else if (filter === "resolved") {
    title = "No resolved findings yet.";
    body = "Discrepancies are resolved outside this dashboard today, so this list stays empty until that’s supported.";
  } else {
    title = "No findings yet.";
    body = canRunSweep
      ? "Run a reconciliation sweep to compare recent payments with the processor."
      : "Findings appear here after an engineer runs a reconciliation sweep.";
  }

  return (
    <div className="queue__empty">
      <p className="queue__empty-title">{title}</p>
      <p className="text-muted">{body}</p>
    </div>
  );
}
