import { env } from "../config/env";
import { ResponseCache } from "./cache";
import { modelLimitsFromEnv } from "./config";
import { LlmLimiter } from "./limiter";
import { createProviderFromEnv } from "./provider";
import { LlmService, type CachedGenerate } from "./service";

export { LlmService } from "./service";
export type { LlmContext, LlmGenerateOutput } from "./service";
export { LlmError } from "./types";
export type { EmbedRequest, EmbedResult, GenerateRequest } from "./types";

let instance: LlmService | null = null;

export function getLlm(): LlmService {
  instance ??= new LlmService({
    provider: createProviderFromEnv(),
    limiter: new LlmLimiter(modelLimitsFromEnv()),
    cache: new ResponseCache<CachedGenerate>(
      env.LLM_CACHE_MAX_ENTRIES,
      env.LLM_CACHE_TTL_SECONDS * 1000,
    ),
    textModel: env.GEMINI_TEXT_MODEL,
    fallbackModel: env.GEMINI_FALLBACK_MODEL,
    embedModel: env.GEMINI_EMBED_MODEL,
    userDailyQuota: env.LLM_USER_DAILY_QUOTA,
  });
  return instance;
}

// Tests replace the service with one built on a fake provider.
export function setLlmForTests(service: LlmService | null): void {
  instance = service;
}
