import { privacyRoutes } from "./modules/privacy.js";
import { planRoutes } from "./modules/plans.js";
import Fastify, { LogController, type FastifyError } from "fastify";
import rateLimit from "@fastify/rate-limit";
import type { Repository } from "./repository.js";
import { configurationRoutes } from "./modules/configuration.js";
import { feedbackRoutes } from "./modules/feedback.js";
export async function buildApp(
  repository: Repository,
  options: {
    logger?: boolean;
    logLevel?: string;
    trustProxy?: number;
    logStream?: { write(message: string): void };
  } = {},
) {
  const app = Fastify({
    bodyLimit: 8192,
    trustProxy: options.trustProxy
      ? (_address: string, hop: number) => hop < options.trustProxy!
      : false,
    logger:
      options.logger === false
        ? false
        : { level: options.logLevel ?? "info", stream: options.logStream },
    logController: new LogController({ disableRequestLogging: true }),
    ajv: { customOptions: { removeAdditional: false } },
  });
  await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });
  // Log route templates, never raw URLs, bodies, headers, or client IPs.
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        event: "http_request",
        method: request.method,
        route: request.routeOptions.url ?? "unmatched",
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      "Request completed",
    );
  });
  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    if (!reply.hasHeader("Cache-Control"))
      reply.header("Cache-Control", "no-store");
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500)
      request.log.error(
        { requestId: request.id, errorType: error.name },
        "Request failed",
      );
    return reply.code(status).send({
      error:
        status === 400
          ? "Invalid request"
          : status === 429
            ? "Too many requests"
            : status >= 500
              ? "Service temporarily unavailable"
              : "Request rejected",
      requestId: request.id,
    });
  });
  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await repository.ready();
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "not_ready" });
    }
  });
  privacyRoutes(app);
  configurationRoutes(app, repository);
  feedbackRoutes(app, repository);
  planRoutes(app, repository);
  return app;
}
