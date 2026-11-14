import pg from "pg";
import { settings } from "./config.js";

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!runtimeUrl || !migrationUrl)
  throw new Error("DATABASE_URL and MIGRATION_DATABASE_URL are required");

const runtime = new URL(runtimeUrl);
const migration = new URL(migrationUrl);
const decode = (value: string) => decodeURIComponent(value);
const runtimeRole = decode(runtime.username);
const runtimePassword = decode(runtime.password);
const runtimeDatabase = decode(runtime.pathname.slice(1));
const migrationDatabase = decode(migration.pathname.slice(1));

if (
  !runtimeRole ||
  !runtimePassword ||
  runtime.hostname !== migration.hostname ||
  runtime.port !== migration.port ||
  runtimeDatabase !== migrationDatabase ||
  runtimeRole === decode(migration.username)
)
  throw new Error("Runtime and migration database URLs do not match safely");

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
const config = settings({ ...process.env, DATABASE_URL: migrationUrl });
const client = new pg.Client({ connectionString: config.databaseUrl, ssl: config.ssl });

try {
  await client.connect();
  const role = quoteIdentifier(runtimeRole);
  const password = quoteLiteral(runtimePassword);
  const existing = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [runtimeRole]);
  if (existing.rowCount) {
    await client.query(
      `ALTER ROLE ${role} WITH LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`,
    );
  } else {
    await client.query(
      `CREATE ROLE ${role} WITH LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`,
    );
  }

  await client.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(runtimeDatabase)} TO ${role}`);
  await client.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await client.query(`REVOKE CREATE ON SCHEMA public FROM ${role}`);
  await client.query(`GRANT SELECT ON app_config, starter_plans TO ${role}`);
  await client.query(`GRANT SELECT, INSERT ON feedback TO ${role}`);
  await client.query(`REVOKE ALL ON schema_migrations FROM ${role}`);
  console.log("Configured restricted ScreenHabit runtime database role");
} finally {
  await client.end();
}
