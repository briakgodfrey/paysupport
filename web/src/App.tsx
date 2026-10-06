import { Route, Routes } from "react-router";

import { RequireSession } from "./auth/RequireSession";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./features/home/HomePage";
import { NotFoundPage } from "./features/notFound/NotFoundPage";
import { SignInPage } from "./features/signin/SignInPage";

/**
 * Route table. Everything renders inside AppShell. Signed-in pages sit
 * under RequireSession; sign-in and the not-found page are public.
 *
 * The router and session providers are added in main.tsx (and by the test
 * helper), so tests can swap BrowserRouter for MemoryRouter.
 */
export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="sign-in" element={<SignInPage />} />
        <Route element={<RequireSession />}>
          <Route index element={<HomePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
