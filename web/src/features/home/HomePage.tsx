import { Page } from "../../components/Page";

/**
 * Landing page for signed-in users. A placeholder until piece 4 turns it
 * into the transaction lookup, which is the first thing an engineer needs.
 */
export function HomePage() {
  return (
    <Page title="Transaction support">
      <p>
        Look up a transaction to see whether our ledger and the payment processor agree, and what to do if
        they don’t.
      </p>
    </Page>
  );
}
