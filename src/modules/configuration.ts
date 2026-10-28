import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
export function configurationRoutes(
  app: FastifyInstance,
  repository: Repository,
) {
  app.get("/v1/config", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return repository.getConfig();
  });
}
