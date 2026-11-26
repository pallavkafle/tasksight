"use client";

import { useQuery } from "@tanstack/react-query";
import { workspaceDetailSchema } from "@tasksight/shared";
import { ApiError, fetchApi } from "./api";
import { useAuth } from "./auth-context";

export function useWorkspaceDetail() {
  const { user, workspaceId } = useAuth();

  const query = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const raw = await fetchApi<unknown>(`/workspaces/${workspaceId}`);
      const parsed = workspaceDetailSchema.safeParse(raw);
      if (!parsed.success) throw new ApiError("INTERNAL", "Unexpected response from the server");
      return parsed.data;
    },
    enabled: !!workspaceId,
  });

  const members = query.data?.members ?? [];
  const role = members.find((m) => m.userId === user?.id)?.role;

  return { members, role, isLoading: query.isLoading, error: query.error };
}
