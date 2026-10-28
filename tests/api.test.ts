import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import type { Repository } from "../src/repository.js";
const repository: Repository = {
  async ready() {},
  async getConfig() {
    return {
      minimumVersionCode: 1,
      latestVersionCode: 17,
      updateMessage: "",
      features: { aiCoach: false },
    };
  },
  async saveFeedback() {
    return "test-id";
  },
};
describe("API boundaries", () => {
  it("serves config and accepts valid feedback", async () => {
    const app = await buildApp(repository, { logger: false });
    try {
      expect((await app.inject("/v1/config")).json().features.aiCoach).toBe(
        false,
      );
      const response = await app.inject({
        method: "POST",
        url: "/v1/feedback",
        payload: {
          category: "bug",
          message: "A button did not work",
          platform: "android",
        },
      });
      expect(response.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });
  it("rejects empty feedback, unexpected data and oversized bodies", async () => {
    const app = await buildApp(repository, { logger: false });
    try {
      for (const payload of [
        { category: "bug", message: "   ", platform: "android" },
        {
          category: "bug",
          message: "hello",
          platform: "android",
          usageHistory: [],
        },
        { category: "bug", message: "x".repeat(9000), platform: "android" },
      ]) {
        const response = await app.inject({
          method: "POST",
          url: "/v1/feedback",
          payload,
        });
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      }
    } finally {
      await app.close();
    }
  });
  it("limits public feedback writes", async () => {
    const app = await buildApp(repository, { logger: false });
    try {
      let status = 0;
      for (let i = 0; i < 6; i++)
        status = (
          await app.inject({
            method: "POST",
            url: "/v1/feedback",
            payload: {
              category: "general",
              message: "hello",
              platform: "android",
            },
          })
        ).statusCode;
      expect(status).toBe(429);
    } finally {
      await app.close();
    }
  });
  it("reports database failure without exposing details", async () => {
    const app = await buildApp(
      {
        ...repository,
        async ready() {
          throw new Error("secret");
        },
        async saveFeedback() {
          throw new Error("secret");
        },
      },
      { logger: false },
    );
    try {
      expect((await app.inject("/health/ready")).statusCode).toBe(503);
      const response = await app.inject({
        method: "POST",
        url: "/v1/feedback",
        payload: { category: "bug", message: "hello", platform: "android" },
      });
      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain("secret");
    } finally {
      await app.close();
    }
  });
});

it("logs request outcomes and feedback receipt without message, URL query or headers", async () => {
  const lines: string[] = [];
  const app = await buildApp(repository, {
    logStream: {
      write(line) {
        lines.push(line);
      },
    },
  });
  try {
    await app.inject({
      method: "POST",
      url: "/v1/feedback?token=private-query",
      headers: { authorization: "Bearer private-token" },
      payload: {
        category: "general",
        message: "private-feedback-text",
        platform: "android",
      },
    });
    const logs = lines.join("");
    expect(logs).toContain("feedback_received");
    expect(logs).toContain("http_request");
    expect(logs).toContain("test-id");
    expect(logs).toContain("201");
    expect(logs).not.toContain("private-feedback-text");
    expect(logs).not.toContain("private-query");
    expect(logs).not.toContain("private-token");
  } finally {
    await app.close();
  }
});

it("serves the public starter catalogue without requiring or accepting user history", async () => {
  const item = {
    id: "one",
    title: "One small change",
    description: "Try a comfortable budget",
    minutes: 30,
    activity: "Read",
  };
  const app = await buildApp(
    {
      ...repository,
      async listStarterPlans() {
        return [item];
      },
    },
    { logger: false },
  );
  try {
    const response = await app.inject("/v1/plans");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([item]);
  } finally {
    await app.close();
  }
});
