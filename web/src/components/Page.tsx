import { useEffect, type ReactNode } from "react";

import "./Page.css";

/** Props for {@link Page}. */
export interface PageProps {
  /** The page's <h1>, also used in the browser tab title. */
  title: string;
  /** Overrides the tab title when the heading alone is ambiguous, e.g. "Diagnosis e111…". */
  documentTitle?: string;
  /** Small uppercase label above the heading that names the area. */
  eyebrow?: string;
  /** One line under the heading saying what this page is for. */
  description?: ReactNode;
  /** Controls shown beside the heading on wide screens, below it on phones. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Appended to every tab title so the app is identifiable among many open tabs. */
const APP_NAME = "PaySupport";

/**
 * Standard page wrapper: sets the document title and renders the page's
 * single <h1>, with an optional eyebrow, description, and actions.
 *
 * The heading has tabIndex={-1} so AppShell can move focus to it after
 * each client-side navigation. Without that, screen reader users get no
 * signal that the page changed, and keyboard users' focus is stranded on
 * a link that may no longer exist.
 */
export function Page({ title, documentTitle, eyebrow, description, actions, children }: PageProps) {
  const tabTitle = documentTitle ?? title;

  useEffect(() => {
    // A unique tab title is how screen reader users (and anyone with many
    // tabs open) tell pages apart (WCAG 2.4.2).
    document.title = `${tabTitle} · ${APP_NAME}`;
  }, [tabTitle]);

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__heading">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="page__title" tabIndex={-1}>
            {title}
          </h1>
          {description ? <p className="page__description">{description}</p> : null}
        </div>
        {actions ? <div className="page__actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
