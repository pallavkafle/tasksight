import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { WORKSPACE_ROLES } from "@tasksight/shared";

const workspaceMemberSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: WORKSPACE_ROLES, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export type WorkspaceMemberDoc = HydratedDocument<InferSchemaType<typeof workspaceMemberSchema>>;
export const WorkspaceMember = model("WorkspaceMember", workspaceMemberSchema);
