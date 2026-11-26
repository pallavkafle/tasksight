"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, fetchApi } from "@/lib/api";
import { Task, TaskStatus, Workspace, taskStatusSchema } from "@tasksight/shared";
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/kanban-column";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { NoWorkspace } from "@/components/no-workspace";

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export default function KanbanPage() {
  const { workspaceId, user } = useAuth();
  const queryClient = useQueryClient();
  const [moveError, setMoveError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  // Fetch workspace to find the current user's role
  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () =>
      fetchApi<{ workspace: Workspace; members: { userId: string; role: string }[] }>(
        `/workspaces/${workspaceId}`,
      ),
    enabled: !!workspaceId,
  });

  const currentUserRole = workspaceData?.members.find((m) => m.userId === user?.id)?.role;
  const isViewer = currentUserRole === "viewer";

  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks", workspaceId],
    queryFn: () => fetchApi<{ items: Task[] }>(`/workspaces/${workspaceId}/tasks?limit=100`),
    enabled: !!workspaceId,
  });

  const mutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      fetchApi(`/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ taskId, status }) => {
      setMoveError(null);
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
    onError: (err, _newTodo, context) => {
      setMoveError(err instanceof ApiError ? err.message : "Could not move the task");
      if (context?.previousData) {
        queryClient.setQueryData(["tasks", workspaceId], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    if (isViewer) return; // Block drag for viewers

    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    // Dropping on a card reports that card's id, so use the card's own column instead.
    const overData = over.data.current;
    const target = overData?.type === "Task" ? overData.task?.status : over.id;
    const parsed = taskStatusSchema.safeParse(target);
    if (!parsed.success) return;
    const newStatus = parsed.data;

    const task = data?.items.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      mutation.mutate({ taskId, status: newStatus });
    }
  }

  if (!workspaceId) return <NoWorkspace />;
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading tasks...</div>;
  if (error) return <div className="p-8 text-red-500">Error loading tasks</div>;

  const tasks = data?.items || [];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Board</h1>
          {isViewer && (
            <p className="text-sm text-amber-500 mt-1">
              You have view-only access to this workspace.
            </p>
          )}
        </div>
        {!isViewer && <CreateTaskDialog />}
      </div>

      {moveError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {moveError}
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-6 overflow-x-auto pb-4 items-start h-full">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={tasks.filter((t) => t.status === col.id)}
              disabled={isViewer}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
