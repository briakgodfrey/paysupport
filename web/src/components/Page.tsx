import { useEffect, type ReactNode } from "react";

import "./Page.css";

/** Props for {@link Page}. */
export interface PageProps {
  /** The page's <h1>, also used in the browser tab title. */
  title: string;
  children?: ReactNode;
}

/** Appended to every tab title so the app is identifiable among many open tabs. */
const APP_NAME = "PaySupport";

/**
 * Standard page wrapper: sets the document title and renders the page's
 * single <h1>.
 *
 * The heading has tabIndex={-1} so AppShell can move focus to it after
 * each client-side navigation. Without that, screen reader users get no
 * signal that the page changed, and keyboard users' focus is stranded on
 * a link that may no longer exist.
 */
export function Page({ title, children }: PageProps) {
  useEffect(() => {
    // A unique tab title is how screen reader users (and anyone with many
    // tabs open) tell pages apart (WCAG 2.4.2).
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  return (
    <div className="page">
      <h1 className="page__title" tabIndex={-1}>
        {title}
      </h1>
      {children}
    </div>
  );
}
