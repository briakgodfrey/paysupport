import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/button.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("index.html is missing the #root element the app mounts into.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
