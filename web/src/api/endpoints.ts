import { getJson, type ApiResult, type RequestOptions } from "./client";
import { healthSchema, type Health } from "./schemas";

/*
 * One typed function per API endpoint. Components and hooks import from
 * here and never build URLs themselves, which keeps path encoding and
 * schema choice in one reviewable place.
 */

/**
 * Checks whether the API process is up. This does not check the database
 * or the vendor: the backend's /health only proves the server is answering.
 */
export function getHealth(options?: RequestOptions): Promise<ApiResult<Health>> {
  return getJson("/health", healthSchema, options);
}
