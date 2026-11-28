import { Router } from "express";
import {
  aiUsageQuerySchema,
  parseTaskRequestSchema,
  type AiUsageQuery,
  type ParseTaskRequest,
} from "@tasksight/shared";
import { isObjectIdOrHexString } from "mongoose";
import { AppError } from "../errors/AppError";
import { requireAuth } from "../middleware/requireAuth";
import { validateBody } from "../middleware/validate";
import { validateQuery } from "../middleware/validateQuery";
import { getLlm } from "../llm";
import { WorkspaceMember } from "../models/WorkspaceMember";
import { getAiUsage } from "../modules/ai/usage";
import { parseTask } from "../modules/ai/parseTask";

export const aiRouter = Router();

aiRouter.get("/ai/usage", requireAuth, validateQuery(aiUsageQuerySchema), async (req, res) => {
  const input = req.valid?.query as AiUsageQuery;
  const userId = req.user!.id;
  const [usage, quota] = await Promise.all([
    getAiUsage(userId, input.days),
    getLlm().getUserQuota(userId),
  ]);
  res.status(200).json({ ...usage, quota });
});

aiRouter.post(
  "/ai/parse-task",
  requireAuth,
  validateBody(parseTaskRequestSchema),
  async (req, res) => {
    const input = req.valid?.body as ParseTaskRequest;
    if (input.workspaceId) {
      if (!isObjectIdOrHexString(input.workspaceId)) {
        throw new AppError("FORBIDDEN", "Not a member of this workspace");
      }
      const member = await WorkspaceMember.exists({
        workspaceId: input.workspaceId,
        userId: req.user!.id,
      });
      if (!member) throw new AppError("FORBIDDEN", "Not a member of this workspace");
    }
    const result = await parseTask(input, req.user!.id);
    res.status(200).json(result);
  },
);
