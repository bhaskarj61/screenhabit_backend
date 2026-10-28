import type { FastifyInstance } from "fastify";
import type { Feedback, Repository } from "../repository.js";
export function feedbackRoutes(app: FastifyInstance, repository: Repository) {
  app.post<{ Body: Feedback }>(
    "/v1/feedback",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["category", "message", "platform"],
          properties: {
            category: {
              type: "string",
              enum: ["bug", "suggestion", "general"],
            },
            message: {
              type: "string",
              minLength: 1,
              maxLength: 2000,
              pattern: "\\S",
            },
            appVersion: { type: "string", maxLength: 40 },
            platform: { type: "string", const: "android" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = await repository.saveFeedback({
        ...request.body,
        message: request.body.message.trim(),
      });
      request.log.info(
        { event: "feedback_received", feedbackId: id },
        "Feedback saved",
      );
      return reply.code(201).send({ id, status: "received" });
    },
  );
}
