import type { RequestHandler } from "express";
import { isObjectIdOrHexString } from "mongoose";
import type { WorkspaceRole } from "@tasksight/shared";
import { AppError } from "../errors/AppError";
import { WorkspaceMember } from "../models/WorkspaceMember";
import { param } from "./param";

const ROLE_ORDER: Record<WorkspaceRole, number> = { viewer: 0, member: 1, owner: 2 };

export function requireRole(min: WorkspaceRole): RequestHandler {
  return async (req, _res, next) => {
    try {
      const workspaceId = param(req, "workspaceId");
      const userId = req.user?.id;
      if (!userId) throw new AppError("UNAUTHORIZED", "Missing user");
      if (!isObjectIdOrHexString(workspaceId)) {
        throw new AppError("NOT_FOUND", "Workspace not found");
      }
      const member = await WorkspaceMember.findOne({ workspaceId, userId });
      if (!member) throw new AppError("FORBIDDEN", "Not a member of this workspace");
      const role = member.role as WorkspaceRole;
      if (ROLE_ORDER[role] < ROLE_ORDER[min]) {
        throw new AppError("FORBIDDEN", "Insufficient role");
      }
      req.workspaceMember = { role };
      next();
    } catch (err) {
      next(err);
    }
  };
}
