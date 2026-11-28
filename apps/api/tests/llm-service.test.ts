import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { AiLog } from "../src/models/AiLog";
import { ResponseCache } from "../src/llm/cache";
import { LlmLimiter, type ModelLimits } from "../src/llm/limiter";
import { writeAiLog } from "../src/llm/log";
import { sampleFor } from "../src/llm/samples";
import { LlmService, type CachedGenerate } from "../src/llm/service";
import { LlmError } from "../src/llm/types";
import { FakeProvider } from "./helpers/fakeProvider";

const newUser = () => new mongoose.Types.ObjectId().toString();
const reply = (model = "main") => ({ text: "answer", model, tokensIn: 5, tokensOut: 3 });

function build(opts: { limits?: Record<string, ModelLimits>; quota?: number } = {}) {
  const provider = new FakeProvider();
  const cache = new ResponseCache<CachedGenerate>(10, 60_000);
  const service = new LlmService({
    provider,
    cache,
    limiter: new LlmLimiter(opts.limits ?? {}),
    textModel: "main",
    fallbackModel: "fb",
    embedModel: "emb",
    userDailyQuota: opts.quota ?? 30,
  });
  return { provider, cache, service };
}

describe("LlmService.generate", () => {
  it("calls the provider, logs the call, then serves the same prompt from the cache", async () => {
    const { provider, service } = build();
    const userId = newUser();
    const ctx = { userId, feature: "parse_task" as const };

    provider.queueGenerate(reply());
    const first = await service.generate(ctx, { prompt: "hello" });
    expect(first).toMatchObject({ text: "answer", cacheHit: false, fromSample: false });
    expect(await AiLog.findOne({ userId, cacheHit: false })).toMatchObject({
      feature: "parse_task",
      model: "main",
      tokensIn: 5,
      tokensOut: 3,
      success: true,
      estCost: null,
    });

    const second = await service.generate(ctx, { prompt: "hello" });
    expect(second).toMatchObject({ text: "answer", cacheHit: true, tokensIn: 0 });
    expect(provider.generateCalls).toHaveLength(1);
    expect(await AiLog.countDocuments({ userId, cacheHit: true })).toBe(1);
  });

  it("uses the fallback model when the main model is rate limited", async () => {
    const { provider, service } = build({
      limits: { main: { rpm: 1, rpd: 10 }, fb: { rpm: 5, rpd: 10 } },
    });
    const userId = newUser();
    const ctx = { userId, feature: "ask" as const };
    provider.queueGenerate(reply("main"), reply("fb"));

    await service.generate(ctx, { prompt: "a" });
    const out = await service.generate(ctx, { prompt: "b" });

    expect(out.model).toBe("fb");
    expect(provider.generateCalls[1]?.model).toBe("fb");
    expect(await AiLog.countDocuments({ userId, model: "fb", success: true })).toBe(1);
  });

  it("returns a sample, and does not cache it, when every model is limited", async () => {
    const { provider, cache, service } = build({
      limits: { main: { rpm: 1, rpd: 10 }, fb: { rpm: 1, rpd: 10 } },
    });
    const userId = newUser();
    const ctx = { userId, feature: "parse_task" as const };
    provider.queueGenerate(reply("main"), reply("fb"));

    await service.generate(ctx, { prompt: "a" });
    await service.generate(ctx, { prompt: "b" });
    const out = await service.generate(ctx, { prompt: "c" });

    expect(out).toMatchObject({ fromSample: true, text: sampleFor("parse_task") });
    expect(provider.generateCalls).toHaveLength(2);
    expect(cache.size).toBe(2);
    expect(await AiLog.findOne({ userId, fromSample: true })).toMatchObject({
      success: false,
      errorCode: "rate_limited",
    });
  });

  it("returns a sample when the key is missing, after one provider attempt", async () => {
    const { provider, service } = build();
    provider.queueGenerate(new LlmError("unavailable", "no key"));
    const userId = newUser();
    const out = await service.generate({ userId, feature: "ask" }, { prompt: "q" });
    expect(out.fromSample).toBe(true);
    expect(provider.generateCalls).toHaveLength(1);
    expect(await AiLog.findOne({ userId })).toMatchObject({ errorCode: "unavailable" });
  });

  it("throws, and logs a failure, for a feature that has no sample", async () => {
    const { provider, service } = build();
    provider.queueGenerate(new LlmError("provider", "down"), new LlmError("provider", "down"));
    const userId = newUser();
    const err = await service
      .generate({ userId, feature: "agent" }, { prompt: "q" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(await AiLog.findOne({ userId })).toMatchObject({
      success: false,
      fromSample: false,
      errorCode: "provider",
    });
  });
});

describe("per-user daily quota", () => {
  it("uses the sample once the user's real calls reach the quota", async () => {
    const { provider, service } = build({ quota: 2 });
    const userId = newUser();
    for (let i = 0; i < 2; i++) {
      await writeAiLog({ userId, feature: "ask", model: "main", success: true });
    }
    const out = await service.generate({ userId, feature: "ask" }, { prompt: "q" });
    expect(out.fromSample).toBe(true);
    expect(provider.generateCalls).toHaveLength(0);
    expect(await AiLog.findOne({ userId, fromSample: true })).toMatchObject({
      errorCode: "user_quota",
    });
  });

  it("does not count cache hits, samples, failures, embeddings or yesterday", async () => {
    const { provider, service } = build({ quota: 1 });
    const userId = newUser();
    const base = { userId, feature: "ask" as const, model: "main" };
    await writeAiLog({ ...base, success: true, cacheHit: true });
    await writeAiLog({ ...base, success: false, fromSample: true });
    await writeAiLog({ ...base, success: false });
    await writeAiLog({ ...base, feature: "embed", success: true });
    await AiLog.collection.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      feature: "ask",
      model: "main",
      success: true,
      cacheHit: false,
      fromSample: false,
      createdAt: new Date(Date.now() - 3 * 86_400_000),
    });

    provider.queueGenerate(reply());
    const out = await service.generate({ userId, feature: "ask" }, { prompt: "q" });
    expect(out.fromSample).toBe(false);
    expect(provider.generateCalls).toHaveLength(1);
  });
});

describe("LlmService.embed", () => {
  it("logs a successful embedding under the embed feature", async () => {
    const { provider, service } = build();
    const userId = newUser();
    provider.queueEmbed({ vector: [1, 0], model: "emb", tokensIn: 4 });
    const result = await service.embed({ userId }, { text: "x", taskType: "RETRIEVAL_QUERY" });
    expect(result.vector).toEqual([1, 0]);
    expect(await AiLog.findOne({ userId })).toMatchObject({
      feature: "embed",
      success: true,
      tokensIn: 4,
    });
  });

  it("logs and rethrows a provider failure", async () => {
    const { provider, service } = build();
    const userId = newUser();
    provider.queueEmbed(new LlmError("provider", "down"));
    await expect(
      service.embed({ userId }, { text: "x", taskType: "RETRIEVAL_DOCUMENT" }),
    ).rejects.toMatchObject({ reason: "provider" });
    expect(await AiLog.findOne({ userId })).toMatchObject({
      success: false,
      errorCode: "provider",
    });
  });

  it("throws a rate-limit error with the wait time when the limiter blocks", async () => {
    const { provider, service } = build({ limits: { emb: { rpm: 1, rpd: 10 } } });
    const userId = newUser();
    provider.queueEmbed({ vector: [1], model: "emb", tokensIn: 1 });
    await service.embed({ userId }, { text: "a", taskType: "RETRIEVAL_DOCUMENT" });
    const err = await service
      .embed({ userId }, { text: "b", taskType: "RETRIEVAL_DOCUMENT" })
      .catch((e) => e);
    expect(err).toMatchObject({ reason: "rate_limited" });
    expect(err.retryAfterMs).toBeGreaterThan(0);
    expect(provider.embedCalls).toHaveLength(1);
  });
});
