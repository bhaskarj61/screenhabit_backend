export interface Database {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}
export type AppConfig = {
  minimumVersionCode: number;
  latestVersionCode: number;
  updateMessage: string;
  features: Record<string, boolean>;
  updateUrl?: string;
};
export type Feedback = {
  category: "bug" | "suggestion" | "general";
  message: string;
  appVersion?: string;
  platform: "android";
};
export type StarterPlan = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  activity: string;
};
export interface Repository {
  listStarterPlans?(): Promise<StarterPlan[]>;
  ready(): Promise<void>;
  getConfig(): Promise<AppConfig>;
  saveFeedback(feedback: Feedback): Promise<string>;
}
export function postgresRepository(pool: Database): Repository {
  return {
    async listStarterPlans() {
      const result = await pool.query(
        "SELECT id,title,description,minutes,activity FROM starter_plans WHERE enabled=true ORDER BY position,id LIMIT 20",
      );
      return result.rows.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        description: String(row.description),
        minutes: Number(row.minutes),
        activity: String(row.activity),
      }));
    },
    async ready() {
      await pool.query("SELECT id FROM app_config WHERE id=1");
    },
    async getConfig() {
      const result = await pool.query(
        "SELECT minimum_version_code, latest_version_code, update_message, update_url, features FROM app_config WHERE id=1",
      );
      if (!result.rows[0])
        throw new Error("Configuration missing; run migrations");
      const row = result.rows[0];
      return {
        minimumVersionCode: Number(row.minimum_version_code),
        latestVersionCode: Number(row.latest_version_code),
        updateMessage: String(row.update_message),
        updateUrl: String(row.update_url ?? ""),
        features: row.features as Record<string, boolean>,
      };
    },
    async saveFeedback(f) {
      const result = await pool.query(
        "INSERT INTO feedback(category,message,app_version,platform) VALUES($1,$2,$3,$4) RETURNING id",
        [f.category, f.message, f.appVersion ?? null, f.platform],
      );
      return String(result.rows[0].id);
    },
  };
}
