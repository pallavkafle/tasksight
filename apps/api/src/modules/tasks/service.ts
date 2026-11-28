import mongoose, { isObjectIdOrHexString, type PipelineStage } from "mongoose";
import type {
  CreateTaskInput,
  TaskListQuery,
  Task as TaskResponse,
  UpdateTaskInput,
} from "@tasksight/shared";
import { AppError } from "../../errors/AppError";
import { Task } from "../../models/Task";
import { WorkspaceMember } from "../../models/WorkspaceMember";

const SENTINEL_MAX = new Date(8640000000000000);
const SENTINEL_MIN = new Date(-8640000000000000);

interface CursorPayload {
  v: string;
  i: string;
}

interface TaskRaw {
  _id: unknown;
  workspaceId: unknown;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: Date | string | null;
  labels?: unknown[];
  assigneeId?: unknown;
  subtasks?: Array<{ title: string; done: boolean }>;
  createdBy: unknown;
  version: number;
  embeddingStatus: "clean" | "dirty";
  completedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function encodeCursor(v: Date, i: string): string {
  const payload: CursorPayload = { v: v.toISOString(), i };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(s: string): { v: Date; i: string } {
  try {
    const payload = JSON.parse(Buffer.from(s, "base64url").toString()) as CursorPayload;
    const v = new Date(payload.v);
    if (Number.isNaN(v.getTime()) || !isObjectIdOrHexString(payload.i)) {
      throw new Error("bad cursor");
    }
    return { v, i: payload.i };
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid cursor");
  }
}

function toTaskResponse(t: TaskRaw): TaskResponse {
  return {
    id: String(t._id),
    workspaceId: String(t.workspaceId),
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    labels: Array.isArray(t.labels) ? t.labels.map(String) : [],
    assigneeId: t.assigneeId ? String(t.assigneeId) : null,
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.map((s) => ({ title: s.title, done: s.done }))
      : [],
    createdBy: String(t.createdBy),
    version: t.version,
    embeddingStatus: t.embeddingStatus,
    completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
  };
}

async function assertAssigneeExists(
  workspaceId: string,
  assigneeId: string | null | undefined,
): Promise<void> {
  if (!assigneeId) return;
  const msg = "Assignee must be a member of this workspace";
  const details = [{ path: "assigneeId", message: msg }];
  if (!isObjectIdOrHexString(assigneeId)) {
    throw new AppError("VALIDATION_ERROR", msg, details);
  }
  const isMember = await WorkspaceMember.exists({ workspaceId, userId: assigneeId });
  if (!isMember) {
    throw new AppError("VALIDATION_ERROR", msg, details);
  }
}

export async function create(
  workspaceId: string,
  userId: string,
  input: CreateTaskInput,
): Promise<TaskResponse> {
  await assertAssigneeExists(workspaceId, input.assigneeId);
  const doc = await Task.create({
    workspaceId,
    createdBy: userId,
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    dueDate: input.dueDate ?? null,
    labels: input.labels ?? [],
    assigneeId: input.assigneeId ?? null,
    subtasks: input.subtasks ?? [],
    completedAt: input.status === "done" ? new Date() : null,
  });
  return toTaskResponse(doc.toObject() as unknown as TaskRaw);
}

export async function getById(workspaceId: string, taskId: string): Promise<TaskResponse> {
  if (!isObjectIdOrHexString(taskId)) throw new AppError("NOT_FOUND", "Task not found");
  const doc = await Task.findOne({ _id: taskId, workspaceId });
  if (!doc) throw new AppError("NOT_FOUND", "Task not found");
  return toTaskResponse(doc.toObject() as unknown as TaskRaw);
}

export async function update(
  workspaceId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskResponse> {
  if (!isObjectIdOrHexString(taskId)) throw new AppError("NOT_FOUND", "Task not found");
  const current = await Task.findOne({ _id: taskId, workspaceId });
  if (!current) throw new AppError("NOT_FOUND", "Task not found");

  await assertAssigneeExists(workspaceId, input.assigneeId);

  const prevDesc = current.description ?? "";
  const prevSub = (current.subtasks ?? []).map((s) => ({ title: s.title, done: s.done }));
  const titleChanged = input.title !== undefined && input.title !== current.title;
  const descChanged = input.description !== undefined && input.description !== prevDesc;
  const subChanged =
    input.subtasks !== undefined && JSON.stringify(input.subtasks) !== JSON.stringify(prevSub);

  const set: Record<string, unknown> = {};
  if (input.title !== undefined) set.title = input.title;
  if (input.description !== undefined) set.description = input.description;
  if (input.status !== undefined) set.status = input.status;
  if (input.priority !== undefined) set.priority = input.priority;
  if (input.dueDate !== undefined) set.dueDate = input.dueDate;
  if (input.labels !== undefined) set.labels = input.labels;
  if (input.assigneeId !== undefined) set.assigneeId = input.assigneeId ?? null;
  if (input.subtasks !== undefined) set.subtasks = input.subtasks;

  if (input.status === "done" && current.status !== "done") set.completedAt = new Date();
  else if (input.status !== undefined && input.status !== "done" && current.status === "done") {
    set.completedAt = null;
  }

  if (titleChanged || descChanged || subChanged) set.embeddingStatus = "dirty";

  const doc = await Task.findOneAndUpdate(
    { _id: taskId, workspaceId },
    { $set: set, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true },
  );
  if (!doc) throw new AppError("NOT_FOUND", "Task not found");

  return toTaskResponse(doc.toObject() as unknown as TaskRaw);
}

export async function remove(workspaceId: string, taskId: string): Promise<void> {
  if (!isObjectIdOrHexString(taskId)) throw new AppError("NOT_FOUND", "Task not found");
  const res = await Task.deleteOne({ _id: taskId, workspaceId });
  if (res.deletedCount === 0) throw new AppError("NOT_FOUND", "Task not found");
}

export interface ListResult {
  items: TaskResponse[];
  nextCursor: string | null;
}

export async function list(workspaceId: string, q: TaskListQuery): Promise<ListResult> {
  if (!isObjectIdOrHexString(workspaceId)) throw new AppError("NOT_FOUND", "Workspace not found");

  const [sortField, sortDirStr] = (q.sort as string).split(":") as [string, string];
  const dir = sortDirStr === "asc" ? 1 : -1;

  const match: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
  };
  if (q.status) match.status = q.status;
  if (q.priority) match.priority = q.priority;
  if (q.assigneeId) {
    if (!isObjectIdOrHexString(q.assigneeId)) {
      throw new AppError("VALIDATION_ERROR", "Invalid assigneeId filter");
    }
    match.assigneeId = new mongoose.Types.ObjectId(q.assigneeId);
  }
  if (q.label) match.labels = q.label;
  if (q.dueFrom || q.dueTo) {
    const dueFilter: Record<string, Date> = {};
    if (q.dueFrom) dueFilter.$gte = q.dueFrom;
    if (q.dueTo) dueFilter.$lte = q.dueTo;
    match.dueDate = dueFilter;
  }

  const sortValExpr =
    sortField === "createdAt"
      ? "$createdAt"
      : { $ifNull: ["$dueDate", dir === 1 ? SENTINEL_MAX : SENTINEL_MIN] };

  const pipeline: Record<string, unknown>[] = [
    { $match: match },
    { $addFields: { __sortVal: sortValExpr } },
  ];

  if (q.cursor) {
    const c = decodeCursor(q.cursor);
    const op = dir === 1 ? "$gt" : "$lt";
    pipeline.push({
      $match: {
        $or: [
          { __sortVal: { [op]: c.v } },
          { __sortVal: c.v, _id: { [op]: new mongoose.Types.ObjectId(c.i) } },
        ],
      },
    });
  }

  pipeline.push({ $sort: { __sortVal: dir, _id: dir } });
  pipeline.push({ $limit: q.limit + 1 });

  const docs = (await Task.aggregate(
    pipeline as unknown as PipelineStage[],
  )) as unknown as TaskRaw[];
  const hasMore = docs.length > q.limit;
  const sliced = hasMore ? docs.slice(0, q.limit) : docs;

  let nextCursor: string | null = null;
  if (hasMore && sliced.length > 0) {
    const last = sliced[sliced.length - 1]!;
    const lastSort = (last as unknown as { __sortVal: Date }).__sortVal;
    nextCursor = encodeCursor(lastSort, String(last._id));
  }

  return {
    items: sliced.map(toTaskResponse),
    nextCursor,
  };
}
