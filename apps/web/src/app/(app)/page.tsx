"use client";

import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Task, TaskStatus } from "@tasksight/shared";
type TaskListResponse = { items: Task[]; nextCursor: string | null };
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires moving 5px before a drag starts (so clicks still work)
      },
    }),
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks", workspaceId],
    queryFn: () => fetchApi<TaskListResponse>(`/workspaces/${workspaceId}/tasks`),
    enabled: !!workspaceId,
  });

  const mutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      fetchApi(`/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ taskId, status }) => {
      // Optimistic Update: Move the card instantly in the UI before the server responds
      await queryClient.cancelQueries({ queryKey: ["tasks", workspaceId] });
      const previousTasks = queryClient.getQueryData<TaskListResponse>(["tasks", workspaceId]);

      if (previousTasks) {
        queryClient.setQueryData<TaskListResponse>(["tasks", workspaceId], {
          ...previousTasks,
          items: previousTasks.items.map((t) => (t.id === taskId ? { ...t, status } : t)),
        });
      }
      return { previousTasks };
    },
    onError: (_err, _newTodo, context) => {
      // If the API fails, rollback to the previous state
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", workspaceId], context.previousTasks);
      }
    },
    onSettled: () => {
      // Refetch to ensure we are in sync with the server
      queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overData = over.data.current as { type?: string; task?: Task } | undefined;

    let newStatus: TaskStatus | null = null;
    if (overData?.type === "Column") {
      newStatus = over.id as TaskStatus;
    } else if (overData?.type === "Task") {
      newStatus = overData.task?.status ?? null;
    }
    if (!newStatus) return;

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
