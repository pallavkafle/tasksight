"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@tasksight/shared";
import { format, parseISO } from "date-fns";
import { CalendarIcon, GripVertical } from "lucide-react";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task, disabled }: TaskCardProps & { disabled?: boolean }) {
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

  const priorityColors = {
    high: "bg-red-500/10 text-red-500 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{task.title}</span>
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.low
          }`}
        >
          {task.priority}
        </span>

        {task.dueDate && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarIcon className="h-3 w-3" />
            {format(parseISO(task.dueDate), "MMM d")}
          </span>
        )}
      </div>
    </div>
  );
}
