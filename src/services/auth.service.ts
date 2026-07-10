import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db/pool";
import { env } from "../config/env";
import { AuthUser, UserRole } from "../types";
import { ApiError } from "../middleware/errorHandler";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const { rows } = await query<UserRow>(
    `SELECT id, email, password_hash, role FROM users WHERE email = $1`,
    [email]
  );

  const row = rows[0];
  if (!row) throw new ApiError(401, "invalid_credentials", "Email or password is incorrect");

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw new ApiError(401, "invalid_credentials", "Email or password is incorrect");

  const user: AuthUser = { id: row.id, email: row.email, role: row.role };
  const token = jwt.sign(user, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
  return { token, user };
}
