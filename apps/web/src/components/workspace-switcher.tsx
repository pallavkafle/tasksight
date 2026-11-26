"use client";

import { useAuth } from "@/lib/auth-context";

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const { workspaces, workspaceId, selectWorkspace } = useAuth();

  if (workspaces.length === 0) return null;

  return (
    <div className={className}>
      <label htmlFor="workspace-switcher" className="sr-only">
        Workspace
      </label>
      <select
        id="workspace-switcher"
        value={workspaceId ?? ""}
        onChange={(e) => selectWorkspace(e.target.value)}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}
