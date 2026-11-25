"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task } from "@tasksight/shared";
import { TaskCard } from "./task-card";

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
}

export function KanbanColumn({ id, title, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: { type: "Column", id },
  });

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col rounded-xl bg-muted/50">
      <div className="flex items-center justify-between p-4 pb-2">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-3 overflow-y-auto p-3 pt-0 transition-colors ${
          isOver ? "bg-primary/5 rounded-b-xl" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed text-sm text-muted-foreground">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
