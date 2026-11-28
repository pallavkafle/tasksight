import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import mongoose from "mongoose";
import { aiUsageResponseSchema } from "@tasksight/shared";
import { createApp } from "../src/app";
import { AiLog } from "../src/models/AiLog";
import { setLlmForTests } from "../src/llm";
import { ResponseCache } from "../src/llm/cache";
import { LlmLimiter } from "../src/llm/limiter";
import { LlmService, type CachedGenerate } from "../src/llm/service";
import { FakeProvider } from "./helpers/fakeProvider";

let app: Express;
let token: string;
let userId: string;

function makeLlmService(): LlmService {
  return new LlmService({
    provider: new FakeProvider(),
    limiter: new LlmLimiter({}),
    cache: new ResponseCache<CachedGenerate>(10, 60_000),
    textModel: "main",
    fallbackModel: "fallback",
    embedModel: "embedding",
    userDailyQuota: 30,
  });
}

beforeEach(async () => {
  app = createApp();
  const email = `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.local`;
  const register = await request(app)
    .post("/auth/register")
    .send({ name: "Usage", email, password: "Password123!" });
  expect(register.status).toBe(201);
  token = register.body.accessToken as string;
  userId = register.body.user.id as string;
  setLlmForTests(makeLlmService());
});

afterEach(() => {
  setLlmForTests(null);
});

describe("GET /ai/usage", () => {
  it("aggregates only the caller's rows and uses nearest-rank p95 for real model attempts", async () => {
    const ownUserId = new mongoose.Types.ObjectId(userId);
    const createdAt = new Date(Date.now() - 60_000);
    const realCalls = Array.from({ length: 20 }, (_, index) => ({
      userId: ownUserId,
      workspaceId: null,
      feature: "parse_task" as const,
      model: "main",
      tokensIn: 1,
      tokensOut: 2,
      latencyMs: index + 1,
      estCost: null,
      success: true,
      cacheHit: false,
      fromSample: false,
      createdAt,
    }));

    await AiLog.insertMany([
      ...realCalls,
      {
        userId: ownUserId,
        workspaceId: null,
        feature: "parse_task",
        model: "main",
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 1_000,
        estCost: 0,
        success: true,
        cacheHit: true,
        fromSample: false,
        createdAt,
      },
      {
        userId: ownUserId,
        workspaceId: null,
        feature: "parse_task",
        model: "sample",
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 2_000,
        estCost: 0,
        success: false,
        cacheHit: false,
        fromSample: true,
        createdAt,
      },
      {
        userId: ownUserId,
        workspaceId: null,
        feature: "ask",
        model: "main",
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 40,
        estCost: null,
        success: false,
        cacheHit: false,
        fromSample: false,
        errorCode: "provider",
        createdAt,
      },
      {
        userId: ownUserId,
        workspaceId: null,
        feature: "embed",
        model: "embedding",
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 5_000,
        estCost: null,
        success: false,
        cacheHit: false,
        fromSample: false,
        errorCode: "rate_limited",
        createdAt,
      },
      {
        userId: ownUserId,
        workspaceId: null,
        feature: "embed",
        model: "embedding",
        tokensIn: 2,
        tokensOut: 0,
        latencyMs: 30,
        estCost: null,
        success: true,
        cacheHit: false,
        fromSample: false,
        createdAt,
      },
      {
        userId: new mongoose.Types.ObjectId(),
        workspaceId: null,
        feature: "parse_task",
        model: "main",
        tokensIn: 100,
        tokensOut: 100,
        latencyMs: 10_000,
        estCost: 5,
        success: true,
        cacheHit: false,
        fromSample: false,
        createdAt,
      },
    ]);

    const res = await request(app).get("/ai/usage?days=7").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const result = aiUsageResponseSchema.parse(res.body);
    expect(result.byFeature.parse_task).toEqual({
      calls: 22,
      failures: 1,
      cacheHits: 1,
      samples: 1,
      tokensIn: 20,
      tokensOut: 40,
      estCost: 0,
      p95LatencyMs: 19,
    });
    expect(result.byFeature.ask).toMatchObject({
      calls: 1,
      failures: 1,
      estCost: null,
      p95LatencyMs: 40,
    });
    expect(result.byFeature.embed).toMatchObject({
      calls: 2,
      failures: 1,
      p95LatencyMs: 30,
    });
    expect(result.total).toEqual({
      calls: 25,
      failures: 3,
      cacheHits: 1,
      samples: 1,
      tokensIn: 22,
      tokensOut: 40,
      estCost: 0,
      p95LatencyMs: 30,
    });
    expect(result.quota).toEqual({ limit: 30, usedToday: 20 });
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/ai/usage");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("defaults to 7 days, accepts 30, and rejects days outside 1 through 30", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const defaultResponse = await request(app).get("/ai/usage").set(auth);
    expect(defaultResponse.status).toBe(200);
    expect(defaultResponse.body.days).toBe(7);

    const maximumResponse = await request(app).get("/ai/usage?days=30").set(auth);
    expect(maximumResponse.status).toBe(200);
    expect(maximumResponse.body.days).toBe(30);

    for (const days of [0, 31]) {
      const invalidResponse = await request(app).get(`/ai/usage?days=${days}`).set(auth);
      expect(invalidResponse.status).toBe(400);
      expect(invalidResponse.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
