import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { createAccount, getAccountById, getAccountTransactions, listAccounts } from "../services/account.service";
import { recordAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth);

const createAccountSchema = z.object({
  customerName: z.string().min(1),
  email: z.string().email(),
  accountType: z.enum(["checking", "savings", "credit"]),
});

/** GET /accounts?limit=&offset= */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 25), 100);
    const offset = Number(req.query.offset ?? 0);
    const accounts = await listAccounts(limit, offset);
    res.json({ accounts, limit, offset });
  })
);

/** POST /accounts */
router.post(
  "/",
  validateBody(createAccountSchema),
  asyncHandler(async (req, res) => {
    const account = await createAccount(req.body);
    await recordAudit(req.user!.id, "account.created", "account", account.id, { email: account.email });
    res.status(201).json(account);
  })
);

/** GET /accounts/:id */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const account = await getAccountById(req.params.id);
    res.json(account);
  })
);

/** GET /accounts/:id/transactions?limit=&offset= */
router.get(
  "/:id/transactions",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 25), 100);
    const offset = Number(req.query.offset ?? 0);
    const transactions = await getAccountTransactions(req.params.id, limit, offset);
    res.json({ transactions, limit, offset });
  })
);

export default router;
