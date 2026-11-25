"use client";

import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Task, TaskStatus } from "@tasksight/shared";
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/kanban-column";

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export default function KanbanPage() {
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks", workspaceId],
    queryFn: () => fetchApi<{ items: Task[] }>(`/workspaces/${workspaceId}/tasks`),
    enabled: !!workspaceId,
  });

  const mutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      fetchApi(`/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", workspaceId] });
      const previousData = queryClient.getQueryData<{ items: Task[] }>(["tasks", workspaceId]);

      if (previousData) {
        queryClient.setQueryData<{ items: Task[] }>(["tasks", workspaceId], {
          ...previousData,
          items: previousData.items.map((t) => (t.id === taskId ? { ...t, status } : t)),
        });
      }
      return { previousData };
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["tasks", workspaceId], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = data?.items.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      mutation.mutate({ taskId, status: newStatus });
    }
  }

  if (!workspaceId) return <div className="p-8 text-muted-foreground">Loading workspace...</div>;
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading tasks...</div>;
  if (error) return <div className="p-8 text-red-500">Error loading tasks</div>;

  const tasks = data?.items || [];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Project Board</h1>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-6 overflow-x-auto pb-4 items-start h-full">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={tasks.filter((t) => t.status === col.id)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
