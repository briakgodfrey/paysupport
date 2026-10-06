import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// "error" fails any test that makes a request without a matching handler,
// so a typo in a URL can't silently pass by hitting nothing.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

// Vitest globals are off (tests import describe/it explicitly), which means
// Testing Library can't register its own automatic cleanup. Do it here.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
