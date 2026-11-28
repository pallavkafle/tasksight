import { env } from "../config/env";
import type { ModelLimits } from "./limiter";

export function modelLimitsFromEnv(): Record<string, ModelLimits> {
  return {
    [env.GEMINI_FALLBACK_MODEL]: { rpm: env.LLM_FALLBACK_RPM, rpd: env.LLM_FALLBACK_RPD },
    [env.GEMINI_TEXT_MODEL]: { rpm: env.LLM_TEXT_RPM, rpd: env.LLM_TEXT_RPD },
    [env.GEMINI_EMBED_MODEL]: { rpm: env.LLM_EMBED_RPM, rpd: env.LLM_EMBED_RPD },
  };
}
