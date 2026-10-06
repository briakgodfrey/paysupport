import type { ReactNode } from "react";

import "./Notice.css";

/** Visual tone of a {@link Notice}. Each tone also has a distinct text title, so tone is never colour-only. */
export type NoticeTone = "info" | "success" | "danger";

/** Props for {@link Notice}. */
export interface NoticeProps {
  tone: NoticeTone;
  /** Short summary, shown in bold. Says what happened. */
  title: string;
  /** Optional detail. Says what the user can do next. */
  children?: ReactNode;
}

/**
 * An inline message box for results and errors. Notice is purely visual:
 * wrap it in a live region (see {@link LiveRegion}) when it appears in
 * response to something the user did and must be announced.
 */
export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <div className={`notice notice--${tone}`}>
      <p className="notice__title">{title}</p>
      {children ? <div className="notice__body">{children}</div> : null}
    </div>
  );
}

/** Props for {@link LiveRegion}. */
export interface LiveRegionProps {
  /**
   * "assertive" (role="alert") interrupts the screen reader: use it for
   * errors that block the user. "polite" (role="status") waits for a
   * pause: use it for confirmations and progress.
   */
  politeness: "assertive" | "polite";
  children?: ReactNode;
}

/**
 * A container that announces its content when it changes.
 *
 * It renders even when empty, on purpose. Screen readers only reliably
 * announce changes inside a live region that already existed in the page;
 * a region inserted together with its message is often skipped. Don't
 * "clean this up" by rendering it conditionally.
 */
export function LiveRegion({ politeness, children }: LiveRegionProps) {
  return <div role={politeness === "assertive" ? "alert" : "status"}>{children}</div>;
}
