import { describe, expect, it } from "vitest";
import { GeminiProvider, l2Normalize, type GeminiOptions } from "../src/llm/gemini";
import { LlmError } from "../src/llm/types";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const okText = (text: string) =>
  jsonResponse({
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 },
  });

const okEmbed = (values: number[]) => jsonResponse({ embedding: { values } });

function setup(steps: Array<Response | Error>, overrides: Partial<GeminiOptions> = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const sleeps: number[] = [];
  const queue = [...steps];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const step = queue.shift();
    if (!step) throw new Error("no response queued");
    if (step instanceof Error) throw step;
    return step;
  }) as typeof fetch;
  const provider = new GeminiProvider({
    apiKey: "secret-key",
    textModel: "text-model",
    embedModel: "embed-model",
    dimensions: 3,
    attempts: 3,
    baseDelayMs: 500,
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
    ...overrides,
  });
  return { provider, calls, sleeps };
}

const bodyOf = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));

describe("GeminiProvider.generate", () => {
  it("sends the key only in a header and returns text and token counts", async () => {
    const { provider, calls } = setup([okText("hello")]);
    const result = await provider.generate({ prompt: "hi" });
    expect(result).toEqual({ text: "hello", model: "text-model", tokensIn: 7, tokensOut: 3 });
    const call = calls[0]!;
    expect(call.url).toContain("/models/text-model:generateContent");
    expect(call.url).not.toContain("secret-key");
    expect((call.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
  });

  it("sends json mode, system prompt and limits when asked", async () => {
    const { provider, calls } = setup([okText("{}")]);
    await provider.generate({
      prompt: "p",
      system: "be strict",
      json: true,
      maxOutputTokens: 100,
      temperature: 0,
    });
    const body = bodyOf(calls[0]!);
    expect(body.systemInstruction.parts[0].text).toBe("be strict");
    expect(body.generationConfig).toEqual({
      responseMimeType: "application/json",
      maxOutputTokens: 100,
      temperature: 0,
    });
  });

  it("retries a 429 and waits with jitter, growing each time", async () => {
    const { provider, calls, sleeps } = setup([
      jsonResponse({}, 429),
      jsonResponse({}, 503),
      okText("ok"),
    ]);
    expect((await provider.generate({ prompt: "p" })).text).toBe("ok");
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([250, 500]);
  });

  it("retries a network error", async () => {
    const { provider, calls } = setup([new Error("socket hang up"), okText("ok")]);
    expect((await provider.generate({ prompt: "p" })).text).toBe("ok");
    expect(calls).toHaveLength(2);
  });

  it("honors Retry-After when it is longer than the jitter", async () => {
    const { provider, sleeps } = setup([
      jsonResponse({}, 429, { "retry-after": "2" }),
      okText("ok"),
    ]);
    await provider.generate({ prompt: "p" });
    expect(sleeps).toEqual([2000]);
  });

  it("does not wait when Retry-After is too long, and reports it", async () => {
    const { provider, calls, sleeps } = setup([jsonResponse({}, 429, { "retry-after": "60" })]);
    const err = await provider.generate({ prompt: "p" }).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err).toMatchObject({ reason: "rate_limited", retryAfterMs: 60_000 });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("gives up after the configured attempts", async () => {
    const { provider, calls, sleeps } = setup([
      jsonResponse({}, 503),
      jsonResponse({}, 503),
      jsonResponse({}, 503),
    ]);
    const err = await provider.generate({ prompt: "p" }).catch((e) => e);
    expect(err).toMatchObject({ reason: "provider" });
    expect(calls).toHaveLength(3);
    expect(sleeps).toHaveLength(2);
  });

  it("does not retry other 4xx errors, and the message holds no key or body", async () => {
    const { provider, calls } = setup([jsonResponse({ error: "API key secret-key invalid" }, 403)]);
    const err = await provider.generate({ prompt: "p" }).catch((e) => e);
    expect(err).toMatchObject({ reason: "provider" });
    expect(String(err.message)).not.toContain("secret-key");
    expect(calls).toHaveLength(1);
  });

  it("treats a per-day 429 as quota and does not retry", async () => {
    const { provider, calls } = setup([
      jsonResponse({ error: { message: "Quota exceeded", quotaId: "RequestsPerDay" } }, 429),
    ]);
    const err = await provider.generate({ prompt: "p" }).catch((e) => e);
    expect(err).toMatchObject({ reason: "quota" });
    expect(calls).toHaveLength(1);
  });

  it("reports empty output as invalid_output", async () => {
    const { provider } = setup([jsonResponse({ candidates: [] })]);
    const err = await provider.generate({ prompt: "p" }).catch((e) => e);
    expect(err).toMatchObject({ reason: "invalid_output" });
  });
});

describe("GeminiProvider.embed", () => {
  it("sends task type and dimensions, and returns a unit-length vector", async () => {
    const { provider, calls } = setup([okEmbed([3, 0, 4])]);
    const result = await provider.embed({ text: "hello world", taskType: "RETRIEVAL_QUERY" });
    expect(result.vector[0]).toBeCloseTo(0.6);
    expect(result.vector[1]).toBeCloseTo(0);
    expect(result.vector[2]).toBeCloseTo(0.8);
    expect(result.model).toBe("embed-model");
    const call = calls[0]!;
    expect(call.url).toContain("/models/embed-model:embedContent");
    expect(bodyOf(call)).toMatchObject({
      model: "models/embed-model",
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 3,
      content: { parts: [{ text: "hello world" }] },
    });
  });

  it("rejects a vector with the wrong number of dimensions", async () => {
    const { provider } = setup([okEmbed([1, 2])]);
    const err = await provider.embed({ text: "x", taskType: "RETRIEVAL_DOCUMENT" }).catch((e) => e);
    expect(err).toMatchObject({ reason: "invalid_output" });
  });

  it("backs off and retries a 429 even under quota", async () => {
    const { provider, sleeps } = setup([jsonResponse({}, 429), okEmbed([1, 0, 0])]);
    const result = await provider.embed({ text: "x", taskType: "RETRIEVAL_DOCUMENT" });
    expect(result.vector).toEqual([1, 0, 0]);
    expect(sleeps).toEqual([250]);
  });
});

describe("l2Normalize", () => {
  it("throws on a zero vector", () => {
    expect(() => l2Normalize([0, 0, 0])).toThrow(LlmError);
  });
});
