import { Link } from "react-router";

import { Page } from "../../components/Page";

/**
 * Shown for any URL the app doesn't know, usually a mistyped or outdated
 * link pasted from a ticket. Explains what happened and offers one way
 * back, instead of a blank screen.
 */
export function NotFoundPage() {
  return (
    <Page title="Page not found">
      <p>There’s nothing at this address. The link may be mistyped, or the page may have moved.</p>
      <p>
        <Link to="/">Go to transaction support</Link>
      </p>
    </Page>
  );
}
