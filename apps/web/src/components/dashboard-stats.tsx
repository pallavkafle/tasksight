"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Clock, ListTodo, TrendingUp } from "lucide-react";
import type { TaskStatsResponse } from "@tasksight/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/sparkline";

interface StatCardProps {
  title: string;
  value: number;
  hint: string;
  icon: ReactNode;
  children?: ReactNode;
}

function StatCard({ title, value, hint, icon, children }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardStats({ stats }: { stats: TaskStatsResponse }) {
  const week = stats.completedByDay.map((d) => d.count);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total tasks"
        value={stats.total}
        hint="Across all statuses"
        icon={<ListTodo className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="In progress"
        value={stats.counts.in_progress}
        hint="Currently being worked on"
        icon={<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
      />
      <StatCard
        title="Done"
        value={stats.counts.done}
        hint="All time"
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
      />
      <StatCard
        title="Done this week"
        value={stats.completedLast7Days}
        hint="Last 7 days"
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
      >
        <Sparkline
          values={week}
          label={`Tasks completed per day over the last 7 days: ${week.join(", ")}`}
        />
      </StatCard>
    </div>
  );
}
