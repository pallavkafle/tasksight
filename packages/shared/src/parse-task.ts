import { z } from "zod";
import { taskPrioritySchema } from "./tasks";

// IANA timezone, validated with Intl (same pattern as taskStatsQuerySchema).
const tzSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone")
  .default("UTC");

export const parseTaskRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    tz: tzSchema,
    workspaceId: z.string().optional(),
  })
  .strict();
export type ParseTaskRequest = z.infer<typeof parseTaskRequestSchema>;

export const parsedTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    priority: taskPrioritySchema,
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
      .nullable(),
    labels: z.array(z.string().trim().min(1).max(50)).max(20),
  })
  .strip();
export type ParsedTaskFields = z.infer<typeof parsedTaskSchema>;

// Web consumes { task, fromSample }. dueDate is full ISO at noon UTC, or null.
export const parseTaskResponseSchema = z.object({
  task: z.object({
    title: z.string(),
    priority: taskPrioritySchema,
    dueDate: z.string().nullable(),
    labels: z.array(z.string()),
  }),
  fromSample: z.boolean(),
});
export type ParseTaskResponse = z.infer<typeof parseTaskResponseSchema>;
