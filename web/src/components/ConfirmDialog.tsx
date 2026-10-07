import { useEffect, useId, useRef, type ReactNode } from "react";

import "./ConfirmDialog.css";

/** Props for {@link ConfirmDialog}. */
export interface ConfirmDialogProps {
  open: boolean;
  /** A question naming the action, e.g. "Run a reconciliation sweep?". */
  title: string;
  /** What will happen and what it costs, so the user can make an informed choice. */
  children: ReactNode;
  /** Names the action, e.g. "Run sweep". Never just "OK" or "Yes". */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Called for Cancel, the Escape key, or any other way the dialog is dismissed. */
  onCancel: () => void;
}

/**
 * A modal confirmation for expensive or hard-to-undo actions.
 *
 * Built on the native <dialog> element with showModal(), which gives a
 * focus trap, Escape to close, an inert background, and correct screen
 * reader semantics without a dependency.
 *
 * Cancel comes first in the DOM, so it's the button that receives focus
 * when the dialog opens. Pressing Enter by reflex then does the safe
 * thing, not the expensive one.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      // Remember the trigger so focus can go back to it afterwards.
      // Browsers are meant to do this themselves, but support varies.
      returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={() => {
        returnFocusTo.current?.focus();
        // Escape closes the native dialog directly; keep React state in sync.
        if (open) onCancel();
      }}
    >
      <h2 className="confirm-dialog__title" id={titleId}>
        {title}
      </h2>
      <div className="confirm-dialog__body" id={bodyId}>
        {children}
      </div>
      <div className="confirm-dialog__actions">
        <button type="button" className="button button--secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="button button--primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
