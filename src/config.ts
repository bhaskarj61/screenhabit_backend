import { readFileSync } from "node:fs";
export function settings(env: NodeJS.ProcessEnv = process.env) {
  const integer = (name: string, fallback: number, max: number) => {
    const n = Number(env[name] ?? fallback);
    if (!Number.isInteger(n) || n < 0 || n > max)
      throw new Error(`Invalid ${name}`);
    return n;
  };
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (env.DATABASE_SSL && !["true", "false"].includes(env.DATABASE_SSL))
    throw new Error("Invalid DATABASE_SSL");
  return {
    databaseUrl: env.DATABASE_URL,
    port: integer("PORT", 3000, 65535),
    host: env.HOST ?? "0.0.0.0",
    logLevel: env.LOG_LEVEL ?? "info",
    trustProxy: integer("TRUST_PROXY_HOPS", 0, 5),
    ssl:
      env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ...(env.DATABASE_CA_FILE
              ? { ca: readFileSync(env.DATABASE_CA_FILE, "utf8") }
              : {}),
          }
        : (false as false),
  };
}
