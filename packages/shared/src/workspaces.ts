import { z } from "zod";

export const WORKSPACE_ROLES = ["owner", "member", "viewer"] as const;
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const workspaceMemberSchema = z.object({
  userId: z.string(),
  role: workspaceRoleSchema,
  name: z.string(),
  email: z.string(),
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: workspaceRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const workspaceListSchema = z.object({
  workspaces: z.array(workspaceSchema),
});
export type WorkspaceList = z.infer<typeof workspaceListSchema>;

export const workspaceDetailSchema = z.object({
  workspace: workspaceSchema,
  members: z.array(workspaceMemberSchema),
});
export type WorkspaceDetail = z.infer<typeof workspaceDetailSchema>;
