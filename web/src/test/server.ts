import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/**
 * Mock API for tests. MSW intercepts real fetch calls at the network
 * layer, so tests exercise the actual API client (URL building, timeouts,
 * Zod validation) instead of a mocked module.
 */
export const server = setupServer(...handlers);
