import { env } from "../config/env";
import { logger } from "../utils/logger";
import { VendorTransaction } from "../types";

/**
 * Thin client for the vendor (card/ACH processor) mock API. Kept isolated
 * from route handlers so retry/timeout behavior lives in one place, and so
 * it can be swapped for a real processor SDK without touching callers.
 */
export type VendorLookupResult =
  | { found: true; transaction: VendorTransaction }
  | { found: false; reason: "not_found" | "unavailable" };

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getVendorTransaction(
  vendorRefId: string,
  retries = 1
): Promise<VendorLookupResult> {
  const url = `${env.vendor.apiUrl}/vendor/transactions/${encodeURIComponent(vendorRefId)}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${env.vendor.apiKey}` },
      });

      if (res.status === 404) return { found: false, reason: "not_found" };
      if (!res.ok) {
        logger.warn("vendor_lookup_non_ok", { vendorRefId, status: res.status, attempt });
        if (attempt < retries) continue;
        return { found: false, reason: "unavailable" };
      }

      const transaction = (await res.json()) as VendorTransaction;
      return { found: true, transaction };
    } catch (err) {
      logger.warn("vendor_lookup_failed", { vendorRefId, attempt, error: (err as Error).message });
      if (attempt >= retries) return { found: false, reason: "unavailable" };
    }
  }

  return { found: false, reason: "unavailable" };
}

export async function createVendorTransaction(amountCents: number, network: string): Promise<VendorTransaction> {
  const res = await fetchWithTimeout(`${env.vendor.apiUrl}/vendor/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.vendor.apiKey}` },
    body: JSON.stringify({ amountCents, network }),
  });

  if (!res.ok) {
    throw new Error(`vendor_create_failed: ${res.status}`);
  }

  return (await res.json()) as VendorTransaction;
}
