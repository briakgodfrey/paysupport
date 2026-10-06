import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { createTransaction, getTransactionById, listTransactions } from "../services/transaction.service";
import { diagnoseTransaction } from "../services/reconciliation.service";
import { recordAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth);

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  cardId: z.string().uuid().nullable().optional(),
  type: z.enum(["card_purchase", "ach_credit", "ach_debit", "transfer"]),
  amountCents: z.number().int().positive(),
  description: z.string().optional(),
});

/** GET /transactions?status=&limit=&offset= */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 25), 100);
    const offset = Number(req.query.offset ?? 0);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const transactions = await listTransactions({ status, limit, offset });
    res.json({ transactions, limit, offset });
  })
);

/** POST /transactions -- creates internally and registers with the vendor. */
router.post(
  "/",
  validateBody(createTransactionSchema),
  asyncHandler(async (req, res) => {
    const transaction = await createTransaction(req.body);
    await recordAudit(req.user!.id, "transaction.created", "transaction", transaction.id, {
      amountCents: transaction.amount_cents,
      type: transaction.type,
    });
    res.status(201).json(transaction);
  })
);

/** GET /transactions/:id */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const transaction = await getTransactionById(req.params.id);
    res.json(transaction);
  })
);

/**
 * GET /transactions/:id/diagnose
 *
 * The centerpiece endpoint: pulls the internal record (with account + card
 * context via SQL joins), calls the vendor live, and returns a structured
  * diff. It turns the "research a customer complaint using SQL and API
  * calls" workflow into one reusable endpoint instead of a one-off manual
  * investigation every time.
 */
router.get(
  "/:id/diagnose",
  asyncHandler(async (req, res) => {
    const report = await diagnoseTransaction(req.params.id);
    await recordAudit(req.user!.id, "transaction.diagnosed", "transaction", req.params.id, {
      outcome: report.outcome,
    });
    res.json(report);
  })
);

export default router;
