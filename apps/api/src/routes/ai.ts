import { Router } from "express";
import { parseTaskRequestSchema, type ParseTaskRequest } from "@tasksight/shared";
import { isObjectIdOrHexString } from "mongoose";
import { AppError } from "../errors/AppError";
import { requireAuth } from "../middleware/requireAuth";
import { validateBody } from "../middleware/validate";
import { WorkspaceMember } from "../models/WorkspaceMember";
import { parseTask } from "../modules/ai/parseTask";

export const aiRouter = Router();

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
