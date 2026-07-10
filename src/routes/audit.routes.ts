import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { query } from "../db/pool";

const router = Router();
router.use(requireAuth);

/** GET /audit-log?entityType=&entityId=&limit=&offset= */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const { entityType, entityId } = req.query;

    if (entityType && entityId) {
      const { rows } = await query(
        `SELECT * FROM audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [entityType, entityId, limit, offset]
      );
      return res.json({ entries: rows, limit, offset });
    }

    const { rows } = await query(
      `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ entries: rows, limit, offset });
  })
);

export default router;
