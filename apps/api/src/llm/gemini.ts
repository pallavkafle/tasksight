import { z } from "zod";
import {
  LlmError,
  type EmbedRequest,
  type EmbedResult,
  type GenerateRequest,
  type GenerateResult,
  type LlmProvider,
} from "./types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Never make a request wait longer than this because of a retry.
const MAX_WAIT_MS = 15_000;

export interface GeminiOptions {
  apiKey: string;
  textModel: string;
  embedModel: string;
  dimensions: number;
  attempts: number;
  baseDelayMs: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

type Outcome =
  | { kind: "ok"; json: unknown }
  | { kind: "retry"; error: LlmError; retryAfterMs: number | null }
  | { kind: "fatal"; error: LlmError };

const generateResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
    })
    .optional(),
});

const embedResponseSchema = z.object({
  embedding: z.object({ values: z.array(z.number()) }),
});

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : null;
}

// Vectors smaller than the model's full size must be normalized in code.
export function l2Normalize(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    throw new LlmError("invalid_output", "Embedding has zero length");
  }
  return values.map((v) => v / norm);
}

export class GeminiProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly textModel: string;
  private readonly embedModel: string;
  private readonly dimensions: number;
  private readonly attempts: number;
  private readonly baseDelayMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(opts: GeminiOptions) {
    this.apiKey = opts.apiKey;
    this.textModel = opts.textModel;
    this.embedModel = opts.embedModel;
    this.dimensions = opts.dimensions;
    this.attempts = opts.attempts;
    this.baseDelayMs = opts.baseDelayMs;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = opts.random ?? Math.random;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const model = req.model ?? this.textModel;
    const body = {
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      generationConfig: {
        ...(req.json ? { responseMimeType: "application/json" } : {}),
        ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      },
    };

    const json = await this.post(model, "generateContent", body);
    const parsed = generateResponseSchema.safeParse(json);
    if (!parsed.success) throw new LlmError("invalid_output", "Unexpected Gemini response");

    const parts = parsed.data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("");
    if (!text.trim()) throw new LlmError("invalid_output", "Gemini returned no text");

    return {
      text,
      model,
      tokensIn: parsed.data.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: parsed.data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  async embed(req: EmbedRequest): Promise<EmbedResult> {
    const body = {
      model: `models/${this.embedModel}`,
      content: { parts: [{ text: req.text }] },
      taskType: req.taskType,
      outputDimensionality: this.dimensions,
    };

    const json = await this.post(this.embedModel, "embedContent", body);
    const parsed = embedResponseSchema.safeParse(json);
    if (!parsed.success) throw new LlmError("invalid_output", "Unexpected Gemini response");

    const values = parsed.data.embedding.values;
    if (values.length !== this.dimensions) {
      throw new LlmError(
        "invalid_output",
        `Expected ${this.dimensions} dimensions but got ${values.length}`,
      );
    }

    // embedContent does not report tokens, so this is a rough estimate (about 4 characters each).
    return {
      vector: l2Normalize(values),
      model: this.embedModel,
      tokensIn: Math.ceil(req.text.length / 4),
    };
  }

  private async post(
    model: string,
    method: "generateContent" | "embedContent",
    body: unknown,
  ): Promise<unknown> {
    const url = `${BASE_URL}/models/${encodeURIComponent(model)}:${method}`;

    for (let attempt = 1; ; attempt++) {
      const outcome = await this.attempt(url, body);
      if (outcome.kind === "ok") return outcome.json;
      if (outcome.kind === "fatal") throw outcome.error;

      const hinted = outcome.retryAfterMs;
      if (attempt >= this.attempts || (hinted !== null && hinted > MAX_WAIT_MS)) {
        throw new LlmError(outcome.error.reason, outcome.error.message, hinted);
      }

      // Exponential backoff with full jitter, but never shorter than the server's hint.
      const ceiling = Math.min(MAX_WAIT_MS, this.baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(this.random() * ceiling);
      await this.sleep(Math.max(hinted ?? 0, jitter));
    }
  }

  private async attempt(url: string, body: unknown): Promise<Outcome> {
    let res: Response;
    try {
      res = await this.send(url, body);
    } catch {
      return {
        kind: "retry",
        error: new LlmError("provider", "Network error calling Gemini"),
        retryAfterMs: null,
      };
    }

    if (res.ok) {
      try {
        return { kind: "ok", json: await res.json() };
      } catch {
        return {
          kind: "fatal",
          error: new LlmError("provider", "Gemini returned an unreadable response"),
        };
      }
    }

    const status = res.status;
    const text = await res.text().catch(() => "");
    const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));

    if (status === 429 && /PerDay/i.test(text)) {
      return { kind: "fatal", error: new LlmError("quota", "Gemini daily quota reached") };
    }
    if (status === 429) {
      return {
        kind: "retry",
        error: new LlmError("rate_limited", "Gemini rate limit (HTTP 429)"),
        retryAfterMs,
      };
    }
    if (status >= 500) {
      return {
        kind: "retry",
        error: new LlmError("provider", `Gemini returned HTTP ${status}`),
        retryAfterMs,
      };
    }
    return { kind: "fatal", error: new LlmError("provider", `Gemini returned HTTP ${status}`) };
  }

  private async send(url: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
