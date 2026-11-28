import { z } from "zod";

export const LLM_FEATURES = ["parse_task", "subtasks", "ask", "agent", "embed"] as const;
export const llmFeatureSchema = z.enum(LLM_FEATURES);
export type LlmFeature = z.infer<typeof llmFeatureSchema>;
