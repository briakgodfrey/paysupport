import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  db: {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "paysupport",
    password: process.env.PGPASSWORD ?? "paysupport",
    database: process.env.PGDATABASE ?? "paysupport",
  },
  vendor: {
    apiUrl: process.env.VENDOR_API_URL ?? "http://localhost:4100",
    apiKey: process.env.VENDOR_API_KEY ?? "vendor-sandbox-key",
  },
};
