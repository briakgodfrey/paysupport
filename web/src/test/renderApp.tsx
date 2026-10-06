import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { App } from "../App";
import { SessionProvider } from "../auth/SessionContext";
import { TEST_CREDENTIALS } from "./fixtures";

/**
 * Renders the whole app at `path`, with the same providers as main.tsx
 * but an in-memory router, so tests drive it the way a user would.
 */
export function renderApp(path = "/") {
  const user = userEvent.setup();
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>,
  );
  return { user, ...view };
}

/**
 * Fills in and submits the sign-in form, then waits for the signed-in
 * home page. Assumes the app is currently showing sign-in.
 */
export async function signIn(user: ReturnType<typeof userEvent.setup>, credentials = TEST_CREDENTIALS) {
  await user.type(screen.getByLabelText("Email"), credentials.email);
  await user.type(screen.getByLabelText("Password"), credentials.password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("button", { name: "Sign out" });
}
