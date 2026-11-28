import { z } from "zod";

export const LLM_FEATURES = ["parse_task", "subtasks", "ask", "agent", "embed"] as const;
export const llmFeatureSchema = z.enum(LLM_FEATURES);
export type LlmFeature = z.infer<typeof llmFeatureSchema>;

export const aiUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});
export type AiUsageQuery = z.infer<typeof aiUsageQuerySchema>;

export const aiUsageMetricsSchema = z.object({
  calls: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
  cacheHits: z.number().int().nonnegative(),
  samples: z.number().int().nonnegative(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  estCost: z.number().nonnegative().nullable(),
  p95LatencyMs: z.number().nonnegative().nullable(),
});
export type AiUsageMetrics = z.infer<typeof aiUsageMetricsSchema>;

export const aiUsageResponseSchema = z.object({
  days: z.number().int().min(1).max(30),
  byFeature: z.record(llmFeatureSchema, aiUsageMetricsSchema),
  total: aiUsageMetricsSchema,
  quota: z.object({
    limit: z.number().int().nonnegative(),
    usedToday: z.number().int().nonnegative(),
  }),
});
export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
