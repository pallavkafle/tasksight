"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@tasksight/shared";
import { format, parseISO } from "date-fns";
import { CalendarIcon, GripVertical } from "lucide-react";

interface TaskCardProps {
  task: Task;
  disabled?: boolean;
  onOpen?: (task: Task) => void;
  memberNames?: Record<string, string>;
}

const PRIORITY_COLORS: Record<Task["priority"], string> = {
  high: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400 dark:border-red-500/20",
  medium:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400 dark:border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400 dark:border-emerald-500/20",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function TaskCard({ task, disabled, onOpen, memberNames }: TaskCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "Task", task },
    disabled: !!disabled,
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-40 border-2 border-primary/50 bg-card rounded-xl h-[100px]"
      />
    );
  }

  const assigneeName = task.assigneeId ? memberNames?.[task.assigneeId] : undefined;
  const subtaskTotal = task.subtasks.length;
  const subtaskDone = task.subtasks.filter((s) => s.done).length;
  const subtaskPercent = subtaskTotal === 0 ? 0 : Math.round((subtaskDone / subtaskTotal) * 100);
  const overdue =
    task.dueDate !== null && task.status !== "done" && new Date(task.dueDate) < new Date();
  const shownLabels = task.labels.slice(0, 3);
  const extraLabels = task.labels.length - shownLabels.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen?.(task);
      }}
      className={`group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{task.title}</span>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {shownLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shownLabels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {label}
            </span>
          ))}
          {extraLabels > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              +{extraLabels}
            </span>
          )}
        </div>
      )}

      {subtaskTotal > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Subtasks</span>
            <span>
              {subtaskDone}/{subtaskTotal}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Subtask progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={subtaskPercent}
            className="h-1 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary" style={{ width: `${subtaskPercent}%` }} />
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PRIORITY_COLORS[task.priority]}`}
        >
          {task.priority}
        </span>

        {task.dueDate && (
          <span
            className={`flex items-center gap-1 text-xs ${
              overdue ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground"
            }`}
          >
            <CalendarIcon className="h-3 w-3" />
            {format(parseISO(task.dueDate), "MMM d")}
            {overdue && <span className="sr-only"> (overdue)</span>}
          </span>
        )}

        {task.assigneeId && (
          <span
            title={assigneeName ?? "Former member"}
            aria-label={`Assigned to ${assigneeName ?? "a former member"}`}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
          >
            {assigneeName ? initials(assigneeName) : "?"}
          </span>
        )}
      </div>
    </div>
  );
}
