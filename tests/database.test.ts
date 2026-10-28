import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { postgresRepository } from "../src/repository.js";
it("runs the actual initial migration and persists feedback through parameterized SQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile("migrations/001_initial.sql", "utf8"));
    await db.exec(await readFile("migrations/002_update_url.sql", "utf8"));
    await db.exec(await readFile("migrations/003_starter_plans.sql", "utf8"));
    const repository = postgresRepository({
      query: async (sql, params) =>
        db.query<Record<string, unknown>>(sql, params),
    });
    await repository.ready();
    expect((await repository.listStarterPlans!()).length).toBe(4);
    await db.query("UPDATE starter_plans SET enabled=false WHERE id=$1", [
      "gentle-start",
    ]);
    expect((await repository.listStarterPlans!()).length).toBe(3);
    expect((await repository.getConfig()).features.aiCoach).toBe(false);
    const id = await repository.saveFeedback({
      category: "bug",
      message: "A button's label needs fixing",
      platform: "android",
      appVersion: "0.1.17",
    });
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    const result = await db.query<{ message: string }>(
      "SELECT message FROM feedback WHERE id=$1",
      [id],
    );
    expect(result.rows[0].message).toBe("A button's label needs fixing");
  } finally {
    await db.close();
  }
});
