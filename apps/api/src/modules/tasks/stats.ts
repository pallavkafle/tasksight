import mongoose, { type PipelineStage } from "mongoose";
import type { TaskStatsResponse } from "@tasksight/shared";
import { Task } from "../../models/Task";

const DAYS = 7;
const DAY_MS = 86_400_000;

// en-CA formats a date as YYYY-MM-DD.
function localDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function getTaskStats(workspaceId: string, tz: string): Promise<TaskStatsResponse> {
  const wsId = new mongoose.Types.ObjectId(workspaceId);
  const now = new Date();
  // One extra day covers the largest timezone offset.
  const since = new Date(now.getTime() - (DAYS + 1) * DAY_MS);

  const statusPipeline = [
    { $match: { workspaceId: wsId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ] as unknown as PipelineStage[];

  const dayPipeline = [
    { $match: { workspaceId: wsId, completedAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt", timezone: tz } },
        count: { $sum: 1 },
      },
    },
  ] as unknown as PipelineStage[];

  const [byStatus, byDay] = await Promise.all([
    Task.aggregate<{ _id: string; count: number }>(statusPipeline),
    Task.aggregate<{ _id: string; count: number }>(dayPipeline),
  ]);

  const counts = { todo: 0, in_progress: 0, done: 0 };
  for (const row of byStatus) {
    if (row._id === "todo" || row._id === "in_progress" || row._id === "done") {
      counts[row._id] = row.count;
    }
  }

  const countByDate = new Map<string, number>(byDay.map((r): [string, number] => [r._id, r.count]));
  const completedByDay: { date: string; count: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = localDateString(new Date(now.getTime() - i * DAY_MS), tz);
    completedByDay.push({ date, count: countByDate.get(date) ?? 0 });
  }

  return {
    counts,
    total: counts.todo + counts.in_progress + counts.done,
    completedByDay,
    completedLast7Days: completedByDay.reduce((sum, d) => sum + d.count, 0),
  };
}
