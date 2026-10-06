import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";

import "./TextField.css";

/** Props for {@link TextField}. Any other input attribute (autoComplete, maxLength, ...) passes through. */
export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-describedby" | "aria-invalid"> {
  /** Visible label text. Always shown: placeholders are not labels. */
  label: string;
  /** Short help shown under the label, before the user makes a mistake. */
  hint?: string;
  /** Error for this field. When set, it is announced with the label and the field is marked invalid. */
  error?: string | null;
  /** Extra control rendered beside the input, such as a show-password toggle. */
  action?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A labelled text input with optional hint and error.
 *
 * The hint and error are linked to the input with aria-describedby, so a
 * screen reader reads "Email, invalid entry, Enter your email address"
 * when the field gets focus. The form only needs to move focus here for
 * the user to hear what's wrong.
 *
 * Errors are shown as text with a visually hidden "Error:" prefix, plus a
 * thicker border, so the state never depends on colour alone.
 */
export function TextField({ label, hint, error, action, ref, className, ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error !== null && error !== "";
  const describedBy = [hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="text-field" data-invalid={hasError || undefined}>
      <label className="text-field__label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="text-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p className="text-field__error" id={errorId}>
          {/* The space sits outside the span on purpose: accessible-name rules trim whitespace at the edges of each element, so "Error: " inside the span would be read as "Error:Enter...". */}
          <span className="visually-hidden">Error:</span> {error}
        </p>
      ) : null}
      <div className="text-field__control">
        <input
          {...inputProps}
          ref={ref}
          id={id}
          className={["text-field__input", className].filter(Boolean).join(" ")}
          aria-describedby={describedBy}
          aria-invalid={hasError || undefined}
        />
        {action}
      </div>
    </div>
  );
}
