import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { AiLog } from "../src/models/AiLog";
import { writeAiLog } from "../src/llm/log";
import { estimateCost } from "../src/llm/pricing";
import { LlmError } from "../src/llm/types";
import { FakeProvider } from "./helpers/fakeProvider";

describe("estimateCost", () => {
  it("returns null for an unknown model, never 0", () => {
    expect(estimateCost("no-such-model", 1000, 1000)).toBeNull();
    expect(estimateCost("constructor", 1000, 1000)).toBeNull();
  });
});

describe("writeAiLog", () => {
  it("stores the numbers and flags", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await writeAiLog({
      userId,
      feature: "parse_task",
      model: "m",
      tokensIn: 10,
      tokensOut: 5,
      latencyMs: 120,
      estCost: null,
      success: true,
    });
    const row = await AiLog.findOne({ userId });
    expect(row).toMatchObject({
      feature: "parse_task",
      tokensIn: 10,
      tokensOut: 5,
      estCost: null,
      cacheHit: false,
      fromSample: false,
      success: true,
    });
  });

  it("never throws when the write fails", async () => {
    await expect(
      writeAiLog({ userId: "not-an-id", feature: "ask", model: "m", success: false }),
    ).resolves.toBeUndefined();
    expect(await AiLog.countDocuments()).toBe(0);
  });
});

describe("LlmError and FakeProvider", () => {
  it("carries a reason and an optional retry delay", () => {
    const err = new LlmError("rate_limited", "slow down", 2000);
    expect(err.reason).toBe("rate_limited");
    expect(err.retryAfterMs).toBe(2000);
    expect(new LlmError("provider", "x").retryAfterMs).toBeNull();
  });

  it("returns queued results in order and throws queued errors", async () => {
    const fake = new FakeProvider()
      .queueGenerate({ text: "a", model: "m", tokensIn: 1, tokensOut: 1 })
      .queueGenerate(new LlmError("provider", "boom"));
    expect((await fake.generate({ prompt: "p" })).text).toBe("a");
    await expect(fake.generate({ prompt: "p" })).rejects.toThrow("boom");
    expect(fake.generateCalls).toHaveLength(2);
  });
});
