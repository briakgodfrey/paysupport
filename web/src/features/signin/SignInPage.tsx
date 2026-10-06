import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { flushSync } from "react-dom";
import { Navigate, useLocation } from "react-router";

import { describeApiFailure, type FailureMessage } from "../../api/failureMessages";
import { safeRedirectPath } from "../../auth/redirect";
import { useSession, type SessionEndReason } from "../../auth/SessionContext";
import { LiveRegion, Notice } from "../../components/Notice";
import { Page } from "../../components/Page";
import { TextField } from "../../components/TextField";
import { SIGN_IN_FIELD_ORDER, validateSignIn, type SignInField, type SignInFieldErrors } from "./signInValidation";
import "./SignInPage.css";

/** Copy for a wrong email or password. More specific than the generic "unauthorized" message. */
const WRONG_CREDENTIALS: FailureMessage = {
  title: "That email and password don’t match an account.",
  action: "Check both and try again. Passwords are case-sensitive.",
};

const END_REASON_NOTICES: Record<SessionEndReason, { tone: "info" | "success"; title: string; body: string }> = {
  signed_out: {
    tone: "success",
    title: "You’ve signed out.",
    body: "Your session has ended on this device.",
  },
  expired: {
    tone: "info",
    title: "Your session has ended.",
    body: "Sessions expire for security. Sign in again to pick up where you left off.",
  },
};

/**
 * Sign-in screen.
 *
 * User task: get into the tool quickly, often mid-ticket. States:
 * - empty form (with a notice if they just signed out or their session expired)
 * - field errors (shown on submit, focus moves to the first one)
 * - submitting ("Signing in…", repeat submits ignored)
 * - wrong credentials, or the API failing (announced; the form keeps the email)
 * - already signed in (redirects to where they were going)
 */
export function SignInPage() {
  const { user, endReason, signIn } = useSession();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({});
  const [formError, setFormError] = useState<FailureMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A ref, not just state, guards against double submits: two fast clicks
  // can both run before React re-renders with isSubmitting = true.
  const inFlight = useRef<AbortController | null>(null);
  const fieldRefs = {
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  } satisfies Record<SignInField, unknown>;

  // Cancel a pending sign-in if the user navigates away mid-request.
  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [],
  );

  // Once signed in, this page has nothing to show. This also completes a
  // successful sign-in: the session update re-renders into this redirect.
  if (user !== null) {
    return <Navigate to={safeRedirectPath(location.state)} replace />;
  }

  /*
   * flushSync commits the new errors to the DOM before focus moves, so a
   * screen reader announces the field together with its new error
   * message, not the stale state from before the update.
   */
  function showFieldErrors(errors: SignInFieldErrors) {
    flushSync(() => {
      setFieldErrors(errors);
    });
    const firstInvalid = SIGN_IN_FIELD_ORDER.find((field) => errors[field] !== undefined);
    if (firstInvalid) fieldRefs[firstInvalid].current?.focus();
  }

  function clearFieldError(field: SignInField) {
    if (fieldErrors[field] === undefined) return;
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const validation = validateSignIn({ email, password });
    if (!validation.ok) {
      setFormError(null);
      showFieldErrors(validation.errors);
      return;
    }

    const controller = new AbortController();
    inFlight.current = controller;
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    const result = await signIn(validation.data, { signal: controller.signal });
    inFlight.current = null;

    // Success needs no handling here: the session update redirects.
    if (result.ok) return;
    if (result.error.kind === "aborted") return;

    setIsSubmitting(false);

    if (result.error.kind === "unauthorized") {
      // Keep the email (usually right), clear the password (usually the
      // mistake), and put the cursor where the fix happens.
      flushSync(() => {
        setPassword("");
        setFormError(WRONG_CREDENTIALS);
      });
      fieldRefs.password.current?.focus();
      return;
    }

    setFormError(describeApiFailure(result.error));
  }

  const endNotice = endReason ? END_REASON_NOTICES[endReason] : null;

  return (
    <Page title="Sign in">
      <div className="sign-in">
        {endNotice ? (
          <Notice tone={endNotice.tone} title={endNotice.title}>
            <p>{endNotice.body}</p>
          </Notice>
        ) : null}

        <p className="sign-in__intro">Use your PaySupport staff account.</p>

        <LiveRegion politeness="assertive">
          {formError ? (
            <Notice tone="danger" title={formError.title}>
              <p>{formError.action}</p>
            </Notice>
          ) : null}
        </LiveRegion>

        {/* noValidate: our own messages replace the browser's, which vary by browser and can't be styled or linked to fields. */}
        <form
          className="sign-in__form"
          noValidate
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <TextField
            ref={fieldRefs.email}
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            error={fieldErrors.email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError("email");
            }}
          />

          <TextField
            ref={fieldRefs.password}
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            value={password}
            error={fieldErrors.password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFieldError("password");
            }}
            action={
              // Lets people check what they typed instead of retyping
              // blind (helpful with long passphrases and on touch
              // keyboards). The accessible name stays "Show password";
              // aria-pressed tells screen readers whether it's on. The
              // space is outside the hidden span so the name isn't read
              // as "Showpassword" (see TextField's error prefix).
              <button
                type="button"
                className="button button--secondary"
                aria-pressed={showPassword}
                onClick={() => {
                  setShowPassword((shown) => !shown);
                }}
              >
                Show <span className="visually-hidden">password</span>
              </button>
            }
          />

          <div>
            <button type="submit" className="button button--primary">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        {/*
          Development builds only. Vite replaces import.meta.env.DEV with
          `false` in production builds and the bundler drops this block, so
          demo credentials never ship in deployed code.
        */}
        {import.meta.env.DEV ? (
          <details className="sign-in__demo">
            <summary>Demo accounts (development only)</summary>
            <p>
              Password for all: <code>password123</code>
            </p>
            <ul>
              <li>
                <code>admin@paysupport.dev</code>: admin
              </li>
              <li>
                <code>engineer@paysupport.dev</code>: engineer, can run sweeps
              </li>
              <li>
                <code>support@paysupport.dev</code>: support, read-only
              </li>
            </ul>
          </details>
        ) : null}
      </div>
    </Page>
  );
}
