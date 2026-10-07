import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

/*
 * jsdom has a <dialog> element but no showModal() or close(), which every
 * real browser supports. This stand-in covers what our tests rely on:
 * toggling `open` and firing the "close" event. It doesn't emulate the
 * focus trap or Escape handling, so those are checked by hand in the
 * browser, not here. Remove it once jsdom implements dialogs.
 */
if (!Reflect.has(HTMLDialogElement.prototype, "showModal")) {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (!this.open) return;
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
  // Browsers hide a closed dialog by default; match that so queries don't find its buttons.
  const style = document.createElement("style");
  style.textContent = "dialog:not([open]) { display: none; }";
  document.head.append(style);
}

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
