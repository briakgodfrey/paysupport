import { describe, expect, it } from "vitest";

import type { VisibleApiFailure } from "./client";
import { describeApiFailure } from "./failureMessages";

const everyVisibleFailure: VisibleApiFailure[] = [
  { kind: "network" },
  { kind: "timeout" },
  { kind: "unauthorized", detail: null },
  { kind: "forbidden", detail: null },
  { kind: "not_found", detail: null },
  { kind: "validation", detail: null },
  { kind: "server", status: 500, detail: null },
  { kind: "unexpected_status", status: 418, detail: null },
  { kind: "invalid_response" },
];

describe("describeApiFailure", () => {
  it.each(everyVisibleFailure)("gives $kind a specific title and a next step", (failure) => {
    const { title, action } = describeApiFailure(failure);

    expect(title.trim()).not.toBe("");
    expect(action.trim()).not.toBe("");
    expect(title).not.toMatch(/something went wrong/i);
  });

  it("does not echo the API's developer-facing message", () => {
    const { title, action } = describeApiFailure({
      kind: "forbidden",
      detail: { error: "forbidden", message: "Requires role: engineer or admin" },
    });

    expect(`${title} ${action}`).not.toContain("Requires role");
  });
});
