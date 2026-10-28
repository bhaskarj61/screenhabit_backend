import pg from "pg";
import { settings } from "./config.js";
import { postgresRepository } from "./repository.js";
import { buildApp } from "./app.js";
const config = settings();
const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.ssl,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 5000,
});
const app = await buildApp(postgresRepository(pool), {
  logLevel: config.logLevel,
  trustProxy: config.trustProxy,
});
pool.on("error", () => app.log.error("Idle database connection failed"));
app.addHook("onClose", async () => {
  await pool.end();
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    void app.close();
  });
try {
  await app.listen({ port: config.port, host: config.host });
} catch {
  app.log.error("Server failed to start");
  await app.close();
  process.exitCode = 1;
}
