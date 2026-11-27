"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ChartPoint {
  date: string;
  completed: number;
}

export function DashboardChart({ data }: { data: ChartPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.completed, 0);
  const summary = data.map((d) => `${d.date}: ${d.completed}`).join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly progress</CardTitle>
        <CardDescription>Tasks completed per day, last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={`Tasks completed per day. ${summary}`} className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                itemStyle={{ color: "var(--text)" }}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke="var(--brand)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCompleted)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {total === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Nothing completed in the last 7 days yet. Tasks finished before this chart existed are
            not counted.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
