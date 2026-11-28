import type { LlmFeature } from "@tasksight/shared";

// Saved answers used when the AI is rate limited, over quota, has no key, or is down.
// Synthetic data only. When the schema for a feature is defined (tasks 3.3, 3.9), edit its
// sample here and keep a test that the sample passes that schema.
const SAMPLES: Partial<Record<LlmFeature, string>> = {
  parse_task: JSON.stringify({
    title: "Submit the report",
    dueDate: null,
    priority: "high",
    labels: ["work"],
  }),
  subtasks: JSON.stringify({
    subtasks: [
      { title: "Outline the steps" },
      { title: "Do the first step" },
      { title: "Review the result" },
    ],
  }),
  ask: "This is a saved sample answer, shown because the AI service is busy right now. Please try again in a moment.",
};

export function sampleFor(feature: LlmFeature): string | null {
  return Object.hasOwn(SAMPLES, feature) ? (SAMPLES[feature] ?? null) : null;
}
