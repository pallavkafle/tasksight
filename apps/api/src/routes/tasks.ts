import { Router } from "express";
import {
  createTaskSchema,
  taskListQuerySchema,
  updateTaskSchema,
  type CreateTaskInput,
  type TaskListQuery,
  type UpdateTaskInput,
} from "@tasksight/shared";
import { param } from "../middleware/param";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import { validateQuery } from "../middleware/validateQuery";
import * as service from "../modules/tasks/service";

export const taskRouter = Router();

taskRouter.get(
  "/workspaces/:workspaceId/tasks",
  requireAuth,
  requireRole("viewer"),
  validateQuery(taskListQuerySchema),
  async (req, res) => {
    const result = await service.list(param(req, "workspaceId"), req.valid?.query as TaskListQuery);
    res.status(200).json(result);
  },
);

taskRouter.post(
  "/workspaces/:workspaceId/tasks",
  requireAuth,
  requireRole("member"),
  validateBody(createTaskSchema),
  async (req, res) => {
    const task = await service.create(
      param(req, "workspaceId"),
      req.user!.id,
      req.valid?.body as CreateTaskInput,
    );
    res.status(201).json({ task });
  },
);

taskRouter.get(
  "/workspaces/:workspaceId/tasks/:taskId",
  requireAuth,
  requireRole("viewer"),
  async (req, res) => {
    const task = await service.getById(param(req, "workspaceId"), param(req, "taskId"));
    res.status(200).json({ task });
  },
);

taskRouter.patch(
  "/workspaces/:workspaceId/tasks/:taskId",
  requireAuth,
  requireRole("member"),
  validateBody(updateTaskSchema),
  async (req, res) => {
    const task = await service.update(
      param(req, "workspaceId"),
      param(req, "taskId"),
      req.valid?.body as UpdateTaskInput,
    );
    res.status(200).json({ task });
  },
);

taskRouter.delete(
  "/workspaces/:workspaceId/tasks/:taskId",
  requireAuth,
  requireRole("member"),
  async (req, res) => {
    await service.remove(param(req, "workspaceId"), param(req, "taskId"));
    res.status(204).end();
  },
);
