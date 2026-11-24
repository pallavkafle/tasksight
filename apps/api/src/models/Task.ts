import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { SUBTASK_MAX, TASK_PRIORITIES, TASK_STATUSES } from "@tasksight/shared";

const subtaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 5000 },
    status: { type: String, enum: TASK_STATUSES, default: "todo", required: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium", required: true },
    dueDate: { type: Date, default: null },
    labels: { type: [String], default: [] },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    subtasks: {
      type: [subtaskSchema],
      default: [],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length <= SUBTASK_MAX,
        message: `Maximum ${SUBTASK_MAX} subtasks`,
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: Number, default: 0, required: true },
    embeddingStatus: { type: String, enum: ["clean", "dirty"], default: "dirty", required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        if (ret.workspaceId) ret.workspaceId = String(ret.workspaceId);
        if (ret.assigneeId) ret.assigneeId = String(ret.assigneeId);
        else ret.assigneeId = null;
        if (ret.createdBy) ret.createdBy = String(ret.createdBy);
        ret.dueDate = ret.dueDate instanceof Date ? ret.dueDate.toISOString() : null;
        if (ret.createdAt instanceof Date) ret.createdAt = ret.createdAt.toISOString();
        if (ret.updatedAt instanceof Date) ret.updatedAt = ret.updatedAt.toISOString();
        return ret;
      },
    },
  },
);

taskSchema.index({ workspaceId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, dueDate: 1 });

export type TaskDoc = HydratedDocument<InferSchemaType<typeof taskSchema>>;
export const Task = model("Task", taskSchema);
