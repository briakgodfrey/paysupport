import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it.each([
    { state: { from: "/" }, expected: "/" },
    { state: { from: "/diagnose/e1111111-0000-0000-0000-000000000002" }, expected: "/diagnose/e1111111-0000-0000-0000-000000000002" },
    { state: { from: "/reconciliation?resolved=false" }, expected: "/reconciliation?resolved=false" },
  ])("keeps the in-app path $state.from", ({ state, expected }) => {
    expect(safeRedirectPath(state)).toBe(expected);
  });

  it.each([
    { label: "no state", state: null },
    { label: "a non-string path", state: { from: 42 } },
    { label: "an absolute URL", state: { from: "https://evil.example/login" } },
    { label: "a protocol-relative URL", state: { from: "//evil.example" } },
    { label: "a backslash trick", state: { from: "/\\evil.example" } },
    { label: "a relative path", state: { from: "diagnose" } },
    { label: "the sign-in page itself", state: { from: "/sign-in" } },
  ])("falls back to home for $label", ({ state }) => {
    expect(safeRedirectPath(state)).toBe("/");
  });
});
