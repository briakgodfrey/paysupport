/**
 * Vendor Mock: stands in for a real card network / ACH processor.
 *
 * Real support work means checking internal records against a vendor's
 * system using a mix of SQL and API calls. This service plays the part of
 * that vendor: it holds its own copy of transaction state, and deliberately
 * drifts from the internal DB some percentage of the time (status lag,
 * amount rounding bugs, records that mysteriously vanish) so the
 * reconciliation engine in the main API has real discrepancies to find.
 */
import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

interface VendorTransaction {
  vendorRefId: string;
  status: "pending" | "settled" | "failed";
  amountCents: number;
  network: string;
  updatedAt: string;
}

// In-memory "vendor ledger" seeded to loosely mirror db/seed.sql, plus a
// couple of entries that deliberately disagree with the internal DB.
const vendorLedger = new Map<string, VendorTransaction>([
  ["vtx_1001", { vendorRefId: "vtx_1001", status: "settled", amountCents: 4599, network: "visa", updatedAt: new Date().toISOString() }],
  // Internal DB says "pending" — vendor has actually settled it. Classic
  // "why does the app say pending when the money already moved" ticket.
  ["vtx_1002", { vendorRefId: "vtx_1002", status: "settled", amountCents: 500000, network: "ach", updatedAt: new Date().toISOString() }],
  ["vtx_1003", { vendorRefId: "vtx_1003", status: "settled", amountCents: 12050, network: "mastercard", updatedAt: new Date().toISOString() }],
  // Amount mismatch — vendor applied a $0.50 processing fee the internal
  // ledger never recorded.
  ["vtx_1005", { vendorRefId: "vtx_1005", status: "settled", amountCents: 20050, network: "visa", updatedAt: new Date().toISOString() }],
]);

let requestCount = 0;

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "vendor-mock", ledgerSize: vendorLedger.size });
});

// Look up a single transaction by the vendor's reference id.
app.get("/vendor/transactions/:vendorRefId", (req: Request, res: Response) => {
  requestCount += 1;
  const { vendorRefId } = req.params;
  const record = vendorLedger.get(vendorRefId);

  if (!record) {
    return res.status(404).json({ error: "not_found", vendorRefId });
  }

  // Simulate occasional transient vendor flakiness (~1 in 12 requests) so
  // the client-side vendor.client.ts has a real reason to implement retries.
  if (requestCount % 12 === 0) {
    return res.status(503).json({ error: "vendor_temporarily_unavailable" });
  }

  res.json(record);
});

// Create a new vendor-side record for a freshly created internal transaction.
app.post("/vendor/transactions", (req: Request, res: Response) => {
  const { amountCents, network } = req.body ?? {};
  if (typeof amountCents !== "number" || !network) {
    return res.status(400).json({ error: "amountCents and network are required" });
  }

  const vendorRefId = `vtx_${Math.floor(1000 + Math.random() * 9000)}_${Date.now().toString(36)}`;
  const record: VendorTransaction = {
    vendorRefId,
    status: "pending",
    amountCents,
    network,
    updatedAt: new Date().toISOString(),
  };
  vendorLedger.set(vendorRefId, record);
  res.status(201).json(record);
});

// Support/demo helper: nudge a vendor record to a new status, so you can
// watch the reconciliation engine catch the drift on the next run.
app.patch("/vendor/transactions/:vendorRefId", (req: Request, res: Response) => {
  const { vendorRefId } = req.params;
  const record = vendorLedger.get(vendorRefId);
  if (!record) return res.status(404).json({ error: "not_found" });

  const { status, amountCents } = req.body ?? {};
  if (status) record.status = status;
  if (typeof amountCents === "number") record.amountCents = amountCents;
  record.updatedAt = new Date().toISOString();
  vendorLedger.set(vendorRefId, record);
  res.json(record);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4100;
app.listen(PORT, () => {
  console.log(`[vendor-mock] listening on :${PORT}`);
});
