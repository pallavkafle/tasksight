import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { LLM_FEATURES } from "@tasksight/shared";

// One row per LLM call. It never stores prompt or response text, only numbers and flags.
const aiLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null },
    feature: { type: String, enum: LLM_FEATURES, required: true },
    model: { type: String, required: true },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    estCost: { type: Number, default: null },
    success: { type: Boolean, required: true },
    cacheHit: { type: Boolean, default: false },
    fromSample: { type: Boolean, default: false },
    errorCode: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiLogSchema.index({ userId: 1, createdAt: -1 });
aiLogSchema.index({ feature: 1, createdAt: -1 });
aiLogSchema.index({ workspaceId: 1, createdAt: -1 });

export type AiLogDoc = HydratedDocument<InferSchemaType<typeof aiLogSchema>>;
export const AiLog = model("AiLog", aiLogSchema);
