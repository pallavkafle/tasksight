import { z } from "zod";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const TASK_SORTS = [
  "createdAt:desc",
  "createdAt:asc",
  "dueDate:asc",
  "dueDate:desc",
] as const;
export const taskSortSchema = z.enum(TASK_SORTS);
export type TaskSort = z.infer<typeof taskSortSchema>;

export const SUBTASK_MAX = 30;

export const subtaskSchema = z.object({
  title: z.string().trim().min(1, "Subtask title is required").max(200),
  done: z.boolean(),
});
export type Subtask = z.infer<typeof subtaskSchema>;

export const subtaskListSchema = z
  .array(subtaskSchema)
  .max(SUBTASK_MAX, `Maximum ${SUBTASK_MAX} subtasks`);

export const taskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().nullable(),
  labels: z.array(z.string()),
  assigneeId: z.string().nullable(),
  subtasks: z.array(subtaskSchema),
  createdBy: z.string(),
  version: z.number().int().nonnegative(),
  embeddingStatus: z.enum(["clean", "dirty"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().max(5000).optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: z.coerce.date().nullable().optional(),
    labels: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    assigneeId: z.string().nullable().optional(),
    subtasks: subtaskListSchema.optional(),
  })
  .strict();
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: z.coerce.date().nullable().optional(),
    labels: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    assigneeId: z.string().nullable().optional(),
    subtasks: subtaskListSchema.optional(),
  })
  .strict();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskListQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().optional(),
  label: z.string().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  sort: taskSortSchema.default("createdAt:desc"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export const taskResponseSchema = z.object({ task: taskSchema });
export type TaskResponse = z.infer<typeof taskResponseSchema>;

export const taskListResponseSchema = z.object({
  items: z.array(taskSchema),
  nextCursor: z.string().nullable(),
});
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;
