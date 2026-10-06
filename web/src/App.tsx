import { AppShell } from "./components/AppShell";

/**
 * Root component. For now it renders a static landing page inside the
 * shell; routing and the sign-in gate replace this content in piece 3.
 */
export function App() {
  return (
    <AppShell>
      <h1>Transaction support</h1>
      <p>
        Look up a transaction to see whether our ledger and the payment processor agree, and what to do if
        they don’t.
      </p>
    </AppShell>
  );
}
