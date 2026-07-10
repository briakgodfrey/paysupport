import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import path from "path";
import YAML from "yamljs";

import authRoutes from "./routes/auth.routes";
import accountsRoutes from "./routes/accounts.routes";
import transactionsRoutes from "./routes/transactions.routes";
import ticketsRoutes from "./routes/tickets.routes";
import reconciliationRoutes from "./routes/reconciliation.routes";
import auditRoutes from "./routes/audit.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan(process.env.NODE_ENV === "test" ? "dev" : "combined"));

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "paysupport-api" }));

  try {
    const openapiDoc = YAML.load(path.join(__dirname, "..", "openapi.yaml"));
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
  } catch {
    // openapi.yaml optional at runtime (e.g. inside some test environments)
  }

  app.use("/auth", authRoutes);
  app.use("/accounts", accountsRoutes);
  app.use("/transactions", transactionsRoutes);
  app.use("/tickets", ticketsRoutes);
  app.use("/reconciliation", reconciliationRoutes);
  app.use("/audit-log", auditRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
