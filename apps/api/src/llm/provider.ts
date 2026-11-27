import { env } from "../config/env";
import { GeminiProvider } from "./gemini";
import { LlmError, type EmbedResult, type GenerateResult, type LlmProvider } from "./types";

class UnavailableProvider implements LlmProvider {
  async generate(): Promise<GenerateResult> {
    throw new LlmError("unavailable", "GEMINI_API_KEY is not set");
  }

  async embed(): Promise<EmbedResult> {
    throw new LlmError("unavailable", "GEMINI_API_KEY is not set");
  }
}

export function createProviderFromEnv(): LlmProvider {
  if (!env.GEMINI_API_KEY) return new UnavailableProvider();
  return new GeminiProvider({
    apiKey: env.GEMINI_API_KEY,
    textModel: env.GEMINI_TEXT_MODEL,
    embedModel: env.GEMINI_EMBED_MODEL,
    dimensions: env.EMBED_DIMENSIONS,
    attempts: env.LLM_RETRY_ATTEMPTS,
    baseDelayMs: env.LLM_RETRY_BASE_MS,
  });
}
