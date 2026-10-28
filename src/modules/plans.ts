import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
export function planRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/v1/plans", async () =>
    repository.listStarterPlans ? repository.listStarterPlans() : [],
  );
}
