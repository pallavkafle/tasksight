import type { LlmFeature } from "@tasksight/shared";

export type { LlmFeature };

export type LlmErrorReason =
  "rate_limited" | "quota" | "provider" | "invalid_output" | "unavailable";

export class LlmError extends Error {
  readonly reason: LlmErrorReason;
  readonly retryAfterMs: number | null;

  constructor(reason: LlmErrorReason, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = "LlmError";
    this.reason = reason;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface GenerateRequest {
  prompt: string;
  system?: string;
  json?: boolean;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbedRequest {
  text: string;
  taskType: EmbedTaskType;
}

export interface EmbedResult {
  vector: number[];
  model: string;
  tokensIn: number;
}

// The only surface the rest of the API sees. Nothing outside src/llm calls a provider directly.
export interface LlmProvider {
  generate(req: GenerateRequest): Promise<GenerateResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
}
