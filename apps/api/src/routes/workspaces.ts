import { Router } from "express";
import {
  addMemberSchema,
  createWorkspaceSchema,
  updateMemberRoleSchema,
  type AddMemberInput,
  type CreateWorkspaceInput,
  type UpdateMemberRoleInput,
} from "@tasksight/shared";
import { param } from "../middleware/param";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import * as service from "../modules/workspaces/service";

export const workspaceRouter = Router();

workspaceRouter.get("/workspaces", requireAuth, async (req, res) => {
  const list = await service.listForUser(req.user!.id);
  res.status(200).json({ workspaces: list });
});

workspaceRouter.post(
  "/workspaces",
  requireAuth,
  validateBody(createWorkspaceSchema),
  async (req, res) => {
    const w = await service.create(req.user!.id, req.valid?.body as CreateWorkspaceInput);
    res.status(201).json({ workspace: w });
  },
);

workspaceRouter.get(
  "/workspaces/:workspaceId",
  requireAuth,
  requireRole("viewer"),
  async (req, res) => {
    const detail = await service.getDetail(param(req, "workspaceId"));
    res.status(200).json(detail);
  },
);

workspaceRouter.post(
  "/workspaces/:workspaceId/members",
  requireAuth,
  requireRole("owner"),
  validateBody(addMemberSchema),
  async (req, res) => {
    await service.addMember(param(req, "workspaceId"), req.valid?.body as AddMemberInput);
    res.status(204).end();
  },
);

workspaceRouter.patch(
  "/workspaces/:workspaceId/members/:userId",
  requireAuth,
  requireRole("owner"),
  validateBody(updateMemberRoleSchema),
  async (req, res) => {
    await service.changeRole(
      param(req, "workspaceId"),
      param(req, "userId"),
      (req.valid?.body as UpdateMemberRoleInput).role,
    );
    res.status(204).end();
  },
);

workspaceRouter.delete(
  "/workspaces/:workspaceId/members/:userId",
  requireAuth,
  requireRole("owner"),
  async (req, res) => {
    await service.removeMember(param(req, "workspaceId"), param(req, "userId"));
    res.status(204).end();
  },
);

workspaceRouter.delete(
  "/workspaces/:workspaceId/leave",
  requireAuth,
  requireRole("viewer"),
  async (req, res) => {
    await service.removeMember(param(req, "workspaceId"), req.user!.id);
    res.status(204).end();
  },
);
