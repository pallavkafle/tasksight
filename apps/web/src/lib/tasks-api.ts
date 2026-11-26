import { taskListResponseSchema, type Task, type TaskPriority } from "@tasksight/shared";
import { ApiError, fetchApi } from "./api";

export const PAGE_SIZE = 100;
export const MAX_TASKS = 300;

export interface TaskFilters {
  priority: TaskPriority | "";
  assigneeId: string;
  label: string;
}

export const EMPTY_FILTERS: TaskFilters = { priority: "", assigneeId: "", label: "" };

export interface TaskList {
  items: Task[];
  truncated: boolean;
}

// Loads every page up to MAX_TASKS so the board is never silently cut at one page.
export async function fetchAllTasks(workspaceId: string, filters: TaskFilters): Promise<TaskList> {
  const items: Task[] = [];
  let cursor: string | null = null;

  while (items.length < MAX_TASKS) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
    const label = filters.label.trim();
    if (label) params.set("label", label);
    if (cursor) params.set("cursor", cursor);

    const raw = await fetchApi<unknown>(`/workspaces/${workspaceId}/tasks?${params.toString()}`);
    const parsed = taskListResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError("INTERNAL", "Unexpected response from the server");
    }

    items.push(...parsed.data.items);
    cursor = parsed.data.nextCursor;
    if (!cursor) return { items, truncated: false };
  }

  return { items: items.slice(0, MAX_TASKS), truncated: true };
}
