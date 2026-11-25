"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, ApiError } from "@/lib/api";
import { Workspace } from "@tasksight/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, Shield } from "lucide-react";

interface Member {
  userId: string;
  role: string;
  name: string;
  email: string;
}

export default function MembersPage() {
  const { workspaceId, user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  // Fetch workspace details (which includes members)
  const { data, isLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () =>
      fetchApi<{ workspace: Workspace; members: Member[] }>(`/workspaces/${workspaceId}`),
    enabled: !!workspaceId,
  });

  const inviteMutation = useMutation({
    mutationFn: (newEmail: string) =>
      fetchApi(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: newEmail, role: "member" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      setEmail("");
      setError("");
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Failed to invite member");
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMutation.mutate(email.trim());
  }

  if (!workspaceId) return <div className="p-8">Loading workspace...</div>;
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading members...</div>;

  const members = data?.members || [];
  const isOwner = members.find((m) => m.userId === user?.id)?.role === "owner";

  return (
    <div className="flex h-full flex-col max-w-4xl mx-auto w-full">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-sm text-muted-foreground">Manage who has access to this workspace.</p>
        </div>
      </div>

      {isOwner && (
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Invite a teammate
            </CardTitle>
            <CardDescription>They must already have a TaskSight account to join.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-4">
              <Input
                placeholder="colleague@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="max-w-md"
                required
              />
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.name} {member.userId === user?.id && "(You)"}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {member.email}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={member.role === "owner" ? "default" : "secondary"}
                  className="capitalize"
                >
                  <Shield className="mr-1 h-3 w-3" /> {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
