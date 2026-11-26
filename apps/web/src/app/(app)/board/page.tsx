"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  EMPTY_FILTERS,
  MAX_TASKS,
  fetchAllTasks,
  type TaskFilters,
  type TaskList,
} from "@/lib/tasks-api";
import { useWorkspaceDetail } from "@/lib/use-workspace-detail";
import { BoardFilters } from "@/components/board-filters";
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
  if (!workspaceId) return <NoWorkspace />;
  return <Board key={workspaceId} workspaceId={workspaceId} />;
}

function Board({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTask, setDialogTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  // Until the member list has loaded the role is unknown, so treat the board as read-only.
  const { role, members } = useWorkspaceDetail();
  const canWrite = role === "owner" || role === "member";
  const memberNames = Object.fromEntries(members.map((m) => [m.userId, m.name]));

  const tasksKey = ["tasks", workspaceId, filters] as const;

  const { data, isLoading, error } = useQuery({
    queryKey: tasksKey,
    queryFn: () => fetchAllTasks(workspaceId, filters),
    placeholderData: keepPreviousData,
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
      const previousData = queryClient.getQueryData<TaskList>(tasksKey);

      if (previousData) {
        queryClient.setQueryData<TaskList>(tasksKey, {
          ...previousData,
          items: previousData.items.map((t) => (t.id === taskId ? { ...t, status } : t)),
        });
      }
      return { previousData };
    },
    onError: (err, _vars, context) => {
      setMoveError(err instanceof ApiError ? err.message : "Could not move the task");
      if (context?.previousData) {
        queryClient.setQueryData(tasksKey, context.previousData);
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

  const tasks = data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Board</h1>
          {role === "viewer" && (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
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

      <BoardFilters value={filters} onChange={setFilters} members={members} />

      {moveError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {moveError}
        </p>
      )}

      {data?.truncated && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          Showing the first {MAX_TASKS} tasks. Use the filters to narrow the list.
        </p>
      )}

      {isLoading && <p className="text-muted-foreground">Loading tasks...</p>}

      {error && !isLoading && (
        <p role="alert" className="text-destructive">
          Could not load tasks. {error instanceof ApiError ? error.message : ""}
        </p>
      )}

      {!isLoading && !error && (
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
                memberNames={memberNames}
              />
            ))}
          </div>
        </DndContext>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={dialogTask}
        readOnly={!canWrite}
      />
    </div>
  );
}
