/** Local developer convenience only: never used by Docker or production start. */
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile, mkdir } from "node:fs/promises";
import { buildApp } from "./app.js";
import { postgresRepository } from "./repository.js";
if (process.env.NODE_ENV === "production")
  throw new Error("Embedded database is local-only");
await mkdir("work", { recursive: true });
const db = new PGlite("work/local-postgres");
await db.waitReady;
await db.exec(
  "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
);
for (const name of (await readdir("migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  const applied = await db.query(
    "SELECT name FROM schema_migrations WHERE name=$1",
    [name],
  );
  if (applied.rows.length) continue;
  await db.transaction(async (tx) => {
    await tx.exec(await readFile(`migrations/${name}`, "utf8"));
    await tx.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
  });
}
const app = await buildApp(
  postgresRepository({
    query: async (sql, params) =>
      db.query<Record<string, unknown>>(sql, params),
  }),
);
app.addHook("onClose", async () => db.close());
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ host: "127.0.0.1", port: 3000 });
app.log.info(
  "LOCAL ONLY: embedded PostgreSQL, data in work/local-postgres; Android uses adb reverse tcp:3000 tcp:3000",
);
