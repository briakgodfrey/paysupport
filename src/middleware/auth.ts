import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthUser, UserRole } from "../types";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized", message: "Missing bearer token" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
  }
}

/** Role-gate a route. Usage: router.patch('/x', requireAuth, requireRole('admin', 'engineer'), handler) */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden", message: `Requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}
