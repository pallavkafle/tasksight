"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { taskListResponseSchema, taskStatsResponseSchema, type Task } from "@tasksight/shared";
import { useAuth } from "@/lib/auth-context";
import { ApiError, fetchApi } from "@/lib/api";
import { useWorkspaceDetail } from "@/lib/use-workspace-detail";
import { DashboardStats } from "@/components/dashboard-stats";
import { DashboardChart } from "@/components/dashboard-chart";
import { TaskDialog } from "@/components/task-dialog";
import { NoWorkspace } from "@/components/no-workspace";
import { Button } from "@/components/ui/button";

const PRIORITY_TEXT: Record<Task["priority"], string> = {
  high: "text-red-700 dark:text-red-400",
  medium: "text-amber-700 dark:text-amber-400",
  low: "text-emerald-700 dark:text-emerald-400",
};

function browserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return "UTC";
    // Some browsers still report the old spelling for Nepal.
    return tz === "Asia/Katmandu" ? "Asia/Kathmandu" : tz;
  } catch {
    return "UTC";
  }
}

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { weekday: "short" });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export default function DashboardPage() {
  const { workspaceId } = useAuth();
  if (!workspaceId) return <NoWorkspace />;
  return <Dashboard key={workspaceId} workspaceId={workspaceId} />;
}

function Dashboard({ workspaceId }: { workspaceId: string }) {
  const { user, workspaces } = useAuth();
  const { role, members } = useWorkspaceDetail();
  const canWrite = role === "owner" || role === "member";
  const memberNames = Object.fromEntries(members.map((m) => [m.userId, m.name]));

  const [tz] = useState(browserTimeZone);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<Task | null>(null);

  // These keys start with ["tasks", workspaceId], so saving or moving a task refreshes them.
  const stats = useQuery({
    queryKey: ["tasks", workspaceId, "stats", tz],
    queryFn: async () => {
      const raw = await fetchApi<unknown>(
        `/workspaces/${workspaceId}/tasks/stats?tz=${encodeURIComponent(tz)}`,
      );
      const parsed = taskStatsResponseSchema.safeParse(raw);
      if (!parsed.success) throw new ApiError("INTERNAL", "Unexpected response from the server");
      return parsed.data;
    },
  });

  const inProgress = useQuery({
    queryKey: ["tasks", workspaceId, "in-progress"],
    queryFn: async () => {
      const raw = await fetchApi<unknown>(
        `/workspaces/${workspaceId}/tasks?status=in_progress&limit=6`,
      );
      const parsed = taskListResponseSchema.safeParse(raw);
      if (!parsed.success) throw new ApiError("INTERNAL", "Unexpected response from the server");
      return parsed.data.items;
    },
  });

  function openTask(task: Task | null) {
    setDialogTask(task);
    setDialogOpen(true);
  }

  const workspaceName = workspaces.find((w) => w.id === workspaceId)?.name;
  const firstName = user?.name.split(" ")[0] ?? "";
  const chartData = (stats.data?.completedByDay ?? []).map((d) => ({
    date: dayLabel(d.date),
    completed: d.count,
  }));
  const failed = stats.error ?? inProgress.error;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Good {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here is a summary of {workspaceName ?? "your workspace"}.
        </p>
      </div>

      {failed && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>
            Could not load the dashboard. {failed instanceof ApiError ? failed.message : ""}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void stats.refetch();
              void inProgress.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {stats.isLoading && (
        <div role="status" className="space-y-4">
          <p className="sr-only">Loading dashboard</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted motion-safe:animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-muted motion-safe:animate-pulse" />
        </div>
      )}

      {stats.data && (
        <>
          <DashboardStats stats={stats.data} />
          <DashboardChart data={chartData} />
        </>
      )}

      <section aria-labelledby="in-progress-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="in-progress-heading" className="text-lg font-semibold tracking-tight">
            In progress
          </h2>
          <Link href="/board" className="text-sm text-primary underline-offset-4 hover:underline">
            Open board
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inProgress.data?.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => openTask(task)}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-sm font-medium leading-tight">{task.title}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span
                  className={`font-semibold uppercase tracking-wider ${PRIORITY_TEXT[task.priority]}`}
                >
                  {task.priority}
                </span>
                {task.dueDate && <span>Due {format(parseISO(task.dueDate), "MMM d")}</span>}
                {task.assigneeId && <span>{memberNames[task.assigneeId] ?? "Former member"}</span>}
              </span>
            </button>
          ))}

          {canWrite && (
            <button
              type="button"
              onClick={() => openTask(null)}
              className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Plus className="h-5 w-5" />
              Add a task
            </button>
          )}
        </div>

        {inProgress.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {inProgress.data && inProgress.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {stats.data?.total === 0
              ? "No tasks yet. Add your first one."
              : "Nothing is in progress right now."}
          </p>
        )}
      </section>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={dialogTask}
        readOnly={!canWrite}
      />
    </div>
  );
}
