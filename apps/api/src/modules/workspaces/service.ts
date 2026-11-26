import type { AddMemberInput, CreateWorkspaceInput, WorkspaceRole } from "@tasksight/shared";
import { AppError } from "../../errors/AppError";
import { Workspace, type WorkspaceDoc } from "../../models/Workspace";
import { WorkspaceMember } from "../../models/WorkspaceMember";
import { Task } from "../../models/Task";
import { User } from "../../models/User";

export interface WorkspaceResponse {
  id: string;
  name: string;
  ownerId: string;
}

export interface MemberResponse {
  userId: string;
  role: WorkspaceRole;
  name: string;
  email: string;
}

export interface WorkspaceDetailResponse {
  workspace: WorkspaceResponse;
  members: MemberResponse[];
}

function toWorkspace(w: WorkspaceDoc): WorkspaceResponse {
  return { id: w.id, name: w.name, ownerId: String(w.ownerId) };
}

export async function listForUser(userId: string): Promise<WorkspaceResponse[]> {
  const memberships = await WorkspaceMember.find({ userId }).select("workspaceId");
  const ids = memberships.map((m) => m.workspaceId);
  if (ids.length === 0) return [];
  // $or instead of $in: sanitizeFilter wraps $in as $eq and breaks ObjectId cast.
  const workspaces = await Workspace.find({ $or: ids.map((id) => ({ _id: id })) }).sort({
    createdAt: -1,
  });
  return workspaces.map(toWorkspace);
}

export async function create(
  userId: string,
  input: CreateWorkspaceInput,
): Promise<WorkspaceResponse> {
  const workspace = await Workspace.create({ name: input.name, ownerId: userId });
  await WorkspaceMember.create({ workspaceId: workspace._id, userId, role: "owner" });
  return toWorkspace(workspace);
}

export async function getDetail(workspaceId: string): Promise<WorkspaceDetailResponse> {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new AppError("NOT_FOUND", "Workspace not found");
  const members = await WorkspaceMember.find({ workspaceId });
  const userIds = members.map((m) => String(m.userId));
  const users = userIds.length ? await User.find({ $or: userIds.map((id) => ({ _id: id })) }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return {
    workspace: toWorkspace(workspace),
    members: members.map((m) => {
      const uid = String(m.userId);
      const u = userMap.get(uid);
      return {
        userId: uid,
        role: m.role as WorkspaceRole,
        name: u?.name ?? "",
        email: u?.email ?? "",
      };
    }),
  };
}

export async function addMember(workspaceId: string, input: AddMemberInput): Promise<void> {
  const targetUser = await User.findOne({ email: input.email });
  if (!targetUser) throw new AppError("NOT_FOUND", "No user with that email");
  const existing = await WorkspaceMember.findOne({ workspaceId, userId: targetUser.id });
  if (existing) throw new AppError("CONFLICT", "User is already a member of this workspace");
  await WorkspaceMember.create({ workspaceId, userId: targetUser.id, role: input.role });
}

export async function changeRole(
  workspaceId: string,
  targetUserId: string,
  role: WorkspaceRole,
): Promise<void> {
  const target = await WorkspaceMember.findOne({ workspaceId, userId: targetUserId });
  if (!target) throw new AppError("NOT_FOUND", "Member not found");
  if (target.role === "owner" && role !== "owner") {
    const owners = await WorkspaceMember.countDocuments({ workspaceId, role: "owner" });
    if (owners <= 1) throw new AppError("FORBIDDEN", "Cannot demote the last owner");
  }
  target.role = role;
  await target.save();
}

export async function removeMember(workspaceId: string, targetUserId: string): Promise<void> {
  const target = await WorkspaceMember.findOne({ workspaceId, userId: targetUserId });
  if (!target) throw new AppError("NOT_FOUND", "Member not found");
  if (target.role === "owner") {
    const owners = await WorkspaceMember.countDocuments({ workspaceId, role: "owner" });
    if (owners <= 1) throw new AppError("FORBIDDEN", "Cannot remove the last owner");
  }
  await WorkspaceMember.deleteOne({ _id: target._id });
  // Unassign tasks that pointed at the removed member so nothing dangles.
  await Task.updateMany(
    { workspaceId, assigneeId: targetUserId },
    { $set: { assigneeId: null }, $inc: { version: 1 } },
  );
}
