import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { settings } from "./config.js";
const config = settings();
const client = new pg.Client({
  connectionString: config.databaseUrl,
  ssl: config.ssl,
});
try {
  await client.connect();
  await client.query("SELECT pg_advisory_lock(741821)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const existing = await client.query(
      "SELECT name FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (existing.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(`migrations/${name}`, "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        name,
      ]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
