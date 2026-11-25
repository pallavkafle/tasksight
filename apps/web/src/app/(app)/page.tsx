"use client";

import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Task } from "@tasksight/shared";
import { DashboardStats } from "@/components/dashboard-stats";
import { DashboardChart } from "@/components/dashboard-chart";

export default function DashboardPage() {
  const { user, workspaceId } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", workspaceId],
    queryFn: () => fetchApi<{ items: Task[] }>(`/workspaces/${workspaceId}/tasks?limit=100`),
    enabled: !!workspaceId,
  });

  if (!workspaceId || isLoading) {
    return <div className="p-8 text-muted-foreground">Loading dashboard...</div>;
  }

  const tasks = data?.items || [];
  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const completed = tasks.filter((t) => t.status === "done").length;

  // Generate chart data for the last 7 days based on completedAt
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0] ?? "";

    // Count tasks completed on this day
    const count = tasks.filter((t) => {
      // If completedAt exists and matches the date string
      const completedAt = (t as Task & { completedAt?: string }).completedAt;
      return completedAt && completedAt.startsWith(dateStr);
    }).length;

    return {
      date: d.toLocaleDateString("en-US", { weekday: "short" }),
      completed: count,
    };
  });

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Good{" "}
          {new Date().getHours() < 12
            ? "morning"
            : new Date().getHours() < 18
              ? "afternoon"
              : "evening"}
          , {user?.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">Here is a summary of your workspace.</p>
      </div>

      <DashboardStats total={total} inProgress={inProgress} completed={completed} />

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardChart data={chartData} />

        {/* Placeholder for Recent Activity or Tasks */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="font-semibold leading-none tracking-tight mb-4">Focus for today</h3>
          <div className="space-y-4">
            {tasks
              .filter((t) => t.status !== "done")
              .slice(0, 4)
              .map((task) => (
                <div key={task.id} className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="truncate">{task.title}</span>
                </div>
              ))}
            {tasks.filter((t) => t.status !== "done").length === 0 && (
              <p className="text-sm text-muted-foreground">All caught up! No pending tasks.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
