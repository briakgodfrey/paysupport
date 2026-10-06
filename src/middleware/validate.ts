import { NextFunction, Request, Response } from "express";
import { z, ZodError, ZodTypeAny } from "zod";
import { ApiError } from "./errorHandler";

function formatIssues(error: ZodError, fallbackPath: string): string {
  return error.issues.map((i) => `${i.path.join(".") || fallbackPath}: ${i.message}`).join("; ");
}

/** Validate req.body against a Zod schema, replacing it with the parsed value. */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ApiError(400, "validation_error", formatIssues(result.error, "body")));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate req.params against a Zod schema. Rejects malformed path
 * parameters with a 400 before they reach the database, instead of letting
 * Postgres throw on the UUID cast and surface as a 500.
 */
export function validateParams(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(new ApiError(400, "validation_error", formatIssues(result.error, "params")));
    }
    next();
  };
}

/**
 * Matches the 8-4-4-4-12 hex shape Postgres accepts for a UUID column,
 * without requiring an RFC 4122 version digit. Seed data uses IDs like
 * e1111111-0000-0000-0000-000000000001 (version nibble 0), which a strict
 * validator such as z.string().uuid() could reject.
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Params schema for routes with a single `:id` that refers to a UUID primary key. */
export const idParamsSchema = z.object({
  id: z.string().regex(UUID_SHAPE, "must be a UUID"),
});
