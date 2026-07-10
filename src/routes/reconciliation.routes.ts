import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { listDiscrepancies, runReconciliation } from "../services/reconciliation.service";
import { recordAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth);

/**
 * POST /reconciliation/run
 * Sweeps recent transactions against the vendor and records new
 * discrepancies. Restricted to engineer/admin since it's a write action
 * (and could be expensive against a real vendor API).
 */
router.post(
  "/run",
  requireRole("engineer", "admin"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const summary = await runReconciliation(limit);
    await recordAudit(req.user!.id, "reconciliation.run", "system", "batch", summary);
    res.json(summary);
  })
);

/** GET /reconciliation/discrepancies?resolved=true|false */
router.get(
  "/discrepancies",
  asyncHandler(async (req, res) => {
    const resolvedParam = req.query.resolved;
    const resolved = resolvedParam === undefined ? undefined : resolvedParam === "true";
    const discrepancies = await listDiscrepancies(resolved);
    res.json({ discrepancies });
  })
);

export default router;
