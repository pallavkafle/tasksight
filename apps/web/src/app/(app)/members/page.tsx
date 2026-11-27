"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  WORKSPACE_ROLES,
  addMemberSchema,
  createWorkspaceSchema,
  workspaceDetailSchema,
  workspaceRoleSchema,
  type WorkspaceRole,
} from "@tasksight/shared";
import { useAuth } from "@/lib/auth-context";
import { ApiError, fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Shield, UserPlus } from "lucide-react";

const selectClass =
  "h-8 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function MembersPage() {
  const { user, workspaces, workspaceId, refreshWorkspaces } = useAuth();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState("");
  const [newNameError, setNewNameError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const raw = await fetchApi<unknown>(`/workspaces/${workspaceId}`);
      const parsed = workspaceDetailSchema.safeParse(raw);
      if (!parsed.success) throw new ApiError("INTERNAL", "Unexpected response from the server");
      return parsed.data;
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi<{ workspace: { id: string } }>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: async (res) => {
      setNewName("");
      setNewNameError(null);
      await refreshWorkspaces(res.workspace.id);
    },
    onError: (err) => setNewNameError(errorMessage(err, "Could not create the workspace")),
  });

  const inviteMutation = useMutation({
    mutationFn: (input: { email: string; role: WorkspaceRole }) =>
      fetchApi(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      setInviteEmail("");
      setInviteError(null);
    },
    onError: (err) => setInviteError(errorMessage(err, "Failed to invite member")),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      fetchApi(`/workspaces/${workspaceId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
    onError: (err) => setActionError(errorMessage(err, "Could not change the role")),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      fetchApi(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      setActionError(null);
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
    onError: (err) => setActionError(errorMessage(err, "Could not remove the member")),
  });

  const leaveMutation = useMutation({
    mutationFn: () => fetchApi(`/workspaces/${workspaceId}/leave`, { method: "DELETE" }),
    onSuccess: async () => {
      setActionError(null);
      setConfirmingId(null);
      await refreshWorkspaces();
    },
    onError: (err) => setActionError(errorMessage(err, "Could not leave the workspace")),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createWorkspaceSchema.safeParse({ name: newName });
    if (!parsed.success) {
      setNewNameError(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    setNewNameError(null);
    createMutation.mutate(parsed.data.name);
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const parsed = addMemberSchema.safeParse({ email: inviteEmail, role: inviteRole });
    if (!parsed.success) {
      setInviteError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setInviteError(null);
    inviteMutation.mutate(parsed.data);
  }

  const members = data?.members ?? [];
  const me = members.find((m) => m.userId === user?.id);
  const isOwner = me?.role === "owner";
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const currentName = workspaces.find((w) => w.id === workspaceId)?.name;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
        <p className="text-sm text-muted-foreground">
          {currentName ? `Workspace: ${currentName}` : "Manage who has access to a workspace."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create a workspace</CardTitle>
          <CardDescription>You will be its owner and can invite people.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row" noValidate>
            <div className="w-full max-w-md space-y-1">
              <Label htmlFor="workspace-name" className="sr-only">
                Workspace name
              </Label>
              <Input
                id="workspace-name"
                placeholder="Workspace name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                aria-invalid={Boolean(newNameError)}
              />
              {newNameError && (
                <p role="alert" className="text-sm text-destructive">
                  {newNameError}
                </p>
              )}
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {!workspaceId && (
        <p className="text-sm text-muted-foreground">
          You are not in a workspace yet. Create one above.
        </p>
      )}

      {workspaceId && isLoading && <p className="text-muted-foreground">Loading members...</p>}
      {workspaceId && error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error, "Could not load members")}
        </p>
      )}

      {workspaceId && isOwner && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" /> Invite a teammate
            </CardTitle>
            <CardDescription>They must already have a TaskSight account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row" noValidate>
              <Input
                placeholder="colleague@example.com"
                type="email"
                aria-label="Email to invite"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="max-w-md"
                aria-invalid={Boolean(inviteError)}
              />
              <select
                aria-label="Role for the invited person"
                value={inviteRole}
                onChange={(e) => {
                  const r = workspaceRoleSchema.safeParse(e.target.value);
                  if (r.success) setInviteRole(r.data);
                }}
                className={selectClass}
              >
                {WORKSPACE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </form>
            {inviteError && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {inviteError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {workspaceId && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Current Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {actionError && (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            )}
            {members.map((m) => {
              const isSelf = m.userId === user?.id;
              const isLastOwner = m.role === "owner" && ownerCount <= 1;
              const confirming = confirmingId === m.userId;
              return (
                <div
                  key={m.userId}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">
                        {m.name} {isSelf && "(You)"}
                      </p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" /> {m.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isOwner ? (
                      <select
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        disabled={roleMutation.isPending || (isSelf && isLastOwner)}
                        onChange={(e) => {
                          const r = workspaceRoleSchema.safeParse(e.target.value);
                          if (r.success) roleMutation.mutate({ userId: m.userId, role: r.data });
                        }}
                        className={selectClass}
                      >
                        {WORKSPACE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge
                        variant={m.role === "owner" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        <Shield className="mr-1 h-3 w-3" /> {m.role}
                      </Badge>
                    )}

                    {isOwner && !isSelf && !confirming && (
                      <Button size="sm" variant="outline" onClick={() => setConfirmingId(m.userId)}>
                        Remove
                      </Button>
                    )}
                    {isSelf && !isLastOwner && !confirming && (
                      <Button size="sm" variant="outline" onClick={() => setConfirmingId(m.userId)}>
                        Leave
                      </Button>
                    )}
                    {isSelf && isLastOwner && (
                      <span className="text-xs text-muted-foreground">
                        Last owner: make someone else an owner to leave
                      </span>
                    )}
                    {confirming && (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={removeMutation.isPending || leaveMutation.isPending}
                          onClick={() =>
                            isSelf ? leaveMutation.mutate() : removeMutation.mutate(m.userId)
                          }
                        >
                          {isSelf ? "Confirm leave" : "Confirm remove"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmingId(null)}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
