import type { WorkspaceRole } from "@tasksight/shared";

declare global {
  namespace Express {
    interface Request {
      valid?: { body?: unknown; query?: unknown; params?: unknown };
      user?: { id: string; name: string; email: string };
      workspaceMember?: { role: WorkspaceRole };
    }
  }
}

export {};
