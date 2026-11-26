"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Task, TaskStatus, taskStatusSchema } from "@tasksight/shared";
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useAuth } from "@/lib/auth-context";
import { ApiError, fetchApi } from "@/lib/api";
import { useWorkspaceDetail } from "@/lib/use-workspace-detail";
import { KanbanColumn } from "@/components/kanban-column";
import { TaskDialog } from "@/components/task-dialog";
import { NoWorkspace } from "@/components/no-workspace";
import { Button } from "@/components/ui/button";

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export default function KanbanPage() {
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  // Until the member list has loaded the role is unknown, so treat the board as read-only.
  const { role } = useWorkspaceDetail();
  const canWrite = role === "owner" || role === "member";

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

  function openCreate() {
    setDialogTask(null);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setDialogTask(task);
    setDialogOpen(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!canWrite) return;

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
          {role === "viewer" && (
            <p className="mt-1 text-sm text-amber-500">
              You have view-only access to this workspace.
            </p>
          )}
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus /> New Task
          </Button>
        )}
      </div>

      {moveError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {moveError}
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex h-full flex-1 items-start gap-6 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={tasks.filter((t) => t.status === col.id)}
              disabled={!canWrite}
              onOpenTask={openEdit}
            />
          ))}
        </div>
      </DndContext>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={dialogTask}
        readOnly={!canWrite}
      />
    </div>
  );
}
