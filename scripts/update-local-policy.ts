/** Stop the local server before modifying its embedded database. Never targets production. */
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
const [mode, versionText, url = ""] = process.argv.slice(2);
const version = Number(versionText);
if (
  !["none", "soft", "hard"].includes(mode) ||
  !Number.isInteger(version) ||
  version < 1
)
  throw new Error(
    "Usage: npm run config:local -- none|soft|hard VERSION_CODE [UPDATE_URL]",
  );
if (url) {
  const parsed = new URL(url);
  if (
    parsed.username ||
    parsed.password ||
    !(
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        ["127.0.0.1", "localhost", "10.0.2.2"].includes(parsed.hostname))
    )
  )
    throw new Error("Use HTTPS or local loopback HTTP");
}
let running = false;
try {
  await fetch("http://127.0.0.1:3000/health/live", {
    signal: AbortSignal.timeout(1000),
  });
  running = true;
} catch {}
if (running)
  throw new Error(
    "Stop the backend with Ctrl+C before editing the local embedded database.",
  );
const db = new PGlite("work/local-postgres");
try {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      (
        await db.query("SELECT name FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows.length
    )
      continue;
    await db.transaction(async (tx) => {
      await tx.exec(await readFile(`migrations/${name}`, "utf8"));
      await tx.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    });
  }
  await db.query(
    "UPDATE app_config SET minimum_version_code=$1, latest_version_code=$2, update_message=$3, update_url=$4, updated_at=now() WHERE id=1",
    [
      mode === "hard" ? version : 1,
      version,
      mode === "none"
        ? ""
        : mode === "hard"
          ? "Please update ScreenHabit to continue."
          : "A newer ScreenHabit version is available.",
      url,
    ],
  );
  console.log(
    `Saved ${mode} policy for version code ${version}. Start the backend and reopen the app.`,
  );
} finally {
  await db.close();
}
