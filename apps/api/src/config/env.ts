import { z } from "zod";

// Tests set NODE_ENV=test and pass env vars in-process, so skip .env loading there.
if (process.env.NODE_ENV !== "test") {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file: fine
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  APP_VERSION: z.string().default("0.0.0"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_ENABLED: z.enum(["true", "false"]).default("true"),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  AUTH_BRUTE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_BRUTE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_ACCESS_SECRET: z.string().default(""),
  JWT_REFRESH_SECRET: z.string().default(""),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),
  REFRESH_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(10),

  // LLM. The key is optional: without it every call returns the sample fallback.
  GEMINI_API_KEY: z.string().trim().default(""),
  GEMINI_TEXT_MODEL: z.string().min(1).default("gemini-3.1-flash-lite"),
  GEMINI_FALLBACK_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  GEMINI_EMBED_MODEL: z.string().min(1).default("gemini-embedding-001"),
  EMBED_DIMENSIONS: z.coerce.number().int().positive().default(768),
  LLM_TEXT_RPM: z.coerce.number().int().positive().default(15),
  LLM_TEXT_RPD: z.coerce.number().int().positive().default(500),
  LLM_FALLBACK_RPM: z.coerce.number().int().positive().default(5),
  LLM_FALLBACK_RPD: z.coerce.number().int().positive().default(20),
  LLM_EMBED_RPM: z.coerce.number().int().positive().default(100),
  LLM_EMBED_RPD: z.coerce.number().int().positive().default(1000),
  LLM_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(6).default(3),
  LLM_RETRY_BASE_MS: z.coerce.number().int().positive().default(500),
  LLM_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  LLM_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  LLM_USER_DAILY_QUOTA: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
