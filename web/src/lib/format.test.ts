import { describe, expect, it } from "vitest";

import { describeAmountDifference, formatCents, formatDateTime, formatStatus } from "./format";
import { isTransactionId, normalizeTransactionId } from "./ids";

describe("money", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(20050)).toMatch(/200\.50/);
    expect(formatCents(4599)).toMatch(/45\.99/);
  });

  it("describes the processor's amount relative to the ledger", () => {
    expect(describeAmountDifference(20000, 20050)).toMatch(/0\.50 higher$/);
    expect(describeAmountDifference(20050, 20000)).toMatch(/0\.50 lower$/);
    expect(describeAmountDifference(100, 100)).toBe("The same amount");
  });
});

describe("display text", () => {
  it("capitalises statuses, including ones it hasn't seen before", () => {
    expect(formatStatus("pending")).toBe("Pending");
    expect(formatStatus("captured")).toBe("Captured");
    expect(formatStatus("  ")).toBe("Unknown");
  });

  it("includes the year in timestamps and tolerates bad input", () => {
    expect(formatDateTime("2026-10-06T21:40:12.345Z")).toMatch(/2026/);
    expect(formatDateTime("not a date")).toBe("not a date");
  });
});

describe("transaction IDs", () => {
  it("accepts seed-style IDs and cleans up pasted values", () => {
    expect(isTransactionId(normalizeTransactionId("  E1111111-0000-0000-0000-000000000002 "))).toBe(true);
  });

  it.each(["", "not-an-id", "t1111111-0000-0000-0000-000000000002", "e1111111-0000-0000-0000-00000000000"])(
    "rejects %j",
    (value) => {
      expect(isTransactionId(normalizeTransactionId(value))).toBe(false);
    },
  );
});
