import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler";
import { idParamsSchema, validateBody, validateParams } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { createTicket, getTicketById, listTickets, updateTicket } from "../services/ticket.service";
import { recordAudit } from "../utils/audit";

const router = Router();
router.use(requireAuth);

const createTicketSchema = z.object({
  accountId: z.string().uuid(),
  transactionId: z.string().uuid().nullable().optional(),
  subject: z.string().min(1),
  description: z.string().optional(),
});

const updateTicketSchema = z.object({
  status: z.enum(["open", "investigating", "resolved"]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

/** GET /tickets?status=&limit=&offset= */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 25), 100);
    const offset = Number(req.query.offset ?? 0);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const tickets = await listTickets(status, limit, offset);
    res.json({ tickets, limit, offset });
  })
);

router.post(
  "/",
  validateBody(createTicketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await createTicket(req.body);
    await recordAudit(req.user!.id, "ticket.created", "support_ticket", ticket.id, { subject: ticket.subject });
    res.status(201).json(ticket);
  })
);

router.get(
  "/:id",
  validateParams(idParamsSchema),
  asyncHandler(async (req, res) => {
    const ticket = await getTicketById(req.params.id);
    res.json(ticket);
  })
);

/** PATCH /tickets/:id -- assign or resolve. */
router.patch(
  "/:id",
  validateParams(idParamsSchema),
  validateBody(updateTicketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await updateTicket(req.params.id, req.body);
    await recordAudit(req.user!.id, "ticket.updated", "support_ticket", ticket.id, req.body);
    res.json(ticket);
  })
);

export default router;
