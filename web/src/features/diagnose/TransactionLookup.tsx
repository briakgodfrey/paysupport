import { useId, useRef, useState, type SubmitEvent } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router";

import { TextField } from "../../components/TextField";
import { isTransactionId, normalizeTransactionId, TRANSACTION_ID_EXAMPLE } from "../../lib/ids";
import "./TransactionLookup.css";

/** Props for {@link TransactionLookup}. */
export interface TransactionLookupProps {
  /** Section heading. Differs by page ("Investigate a payment" vs "Diagnose another transaction"). */
  heading: string;
  /** One line under the heading explaining what happens. */
  description: string;
}

/**
 * The transaction ID form. Valid IDs navigate to /diagnose/:id, so every
 * result has a URL an engineer can paste into the ticket.
 *
 * The ID's format is checked here before any request, for instant, specific
 * feedback on a mistyped or partial paste. The API checks again and is the
 * real boundary.
 */
export function TransactionLookup({ heading, description }: TransactionLookupProps) {
  const navigate = useNavigate();
  const headingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = normalizeTransactionId(value);

    if (id === "" || !isTransactionId(id)) {
      // Commit the error before moving focus, so screen readers read the
      // field together with its new message (same pattern as sign-in).
      flushSync(() => {
        setError(
          id === ""
            ? "Enter a transaction ID."
            : "That doesn’t look like a transaction ID. Check for missing or extra characters.",
        );
      });
      inputRef.current?.focus();
      return;
    }

    setError(null);
    void navigate(`/diagnose/${encodeURIComponent(id)}`);
  }

  return (
    <section className="panel transaction-lookup" aria-labelledby={headingId}>
      <div className="transaction-lookup__intro">
        <h2 id={headingId}>{heading}</h2>
        <p className="text-muted">{description}</p>
      </div>
      {/* noValidate: one consistent, linked error message instead of the browser's own bubble. */}
      <form className="transaction-lookup__form" noValidate onSubmit={handleSubmit}>
        <TextField
          ref={inputRef}
          className="transaction-lookup__input"
          label="Transaction ID"
          hint={`Paste it from the ticket, for example ${TRANSACTION_ID_EXAMPLE}`}
          name="transactionId"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          error={error}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
        />
        <button type="submit" className="button button--primary transaction-lookup__submit">
          Diagnose
        </button>
      </form>
    </section>
  );
}
