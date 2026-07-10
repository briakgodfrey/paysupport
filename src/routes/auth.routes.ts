import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import { login } from "../services/auth.service";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/login
 * Body: { email, password }
 * Returns a JWT for the support/engineer/admin user.
 */
router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { token, user } = await login(email, password);
    res.json({ token, user });
  })
);

export default router;
