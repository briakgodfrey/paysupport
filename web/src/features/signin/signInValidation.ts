import { z } from "zod";

import type { LoginCredentials } from "../../api/endpoints";

/*
 * Client-side checks for the sign-in form. These exist for the user's
 * benefit (fast, specific feedback without a round trip), not for
 * security: the API validates the same fields again and is the only real
 * boundary.
 *
 * Messages follow the pattern "say what to do", e.g. "Enter your email
 * address", rather than "Email is invalid".
 */

/** RFC 5321 caps a full email address at 254 characters. */
const EMAIL_MAX_LENGTH = 254;

/**
 * Generous enough for any passphrase, but stops a pasted multi-megabyte
 * string from being sent to a bcrypt endpoint. bcrypt is deliberately
 * slow, so huge inputs are a cheap way to load the server.
 */
const PASSWORD_MAX_LENGTH = 1024;

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .max(EMAIL_MAX_LENGTH, `Email addresses can’t be longer than ${String(EMAIL_MAX_LENGTH)} characters.`)
    .pipe(z.email("Enter an email address in the format name@company.com.")),
  // Not trimmed: leading or trailing spaces can be part of a real password.
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(PASSWORD_MAX_LENGTH, `Passwords can’t be longer than ${String(PASSWORD_MAX_LENGTH)} characters.`),
});

/** A sign-in form field that can have an error. */
export type SignInField = keyof LoginCredentials;

/** Field errors keyed by field name. A missing key means that field is fine. */
export type SignInFieldErrors = Partial<Record<SignInField, string>>;

/** Fields in the order they appear on screen, so the first error found is the first one the user sees. */
export const SIGN_IN_FIELD_ORDER: readonly SignInField[] = ["email", "password"];

/**
 * Checks the sign-in form.
 *
 * @returns Cleaned credentials (email trimmed), or one error per invalid field.
 */
export function validateSignIn(
  values: LoginCredentials,
): { ok: true; data: LoginCredentials } | { ok: false; errors: SignInFieldErrors } {
  const result = signInSchema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };

  const errors: SignInFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    // Keep only the first message per field: one clear instruction at a time.
    if ((field === "email" || field === "password") && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
}
