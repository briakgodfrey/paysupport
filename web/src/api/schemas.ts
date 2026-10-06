import { z } from "zod";

/*
 * Runtime schemas for every API response. TypeScript types are derived
 * from these with z.infer, so the compile-time types can never drift from
 * what is actually checked at runtime.
 *
 * z.object() strips unknown keys by default. That is deliberate: if the
 * API starts returning extra fields (for example something sensitive added
 * by mistake), they never reach component state.
 */

/** GET /health. "ok" is the only healthy value, so anything else counts as unavailable. */
export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
});

/** A healthy response from GET /health. */
export type Health = z.infer<typeof healthSchema>;
