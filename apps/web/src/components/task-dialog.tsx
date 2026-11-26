"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  createTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
  updateTaskSchema,
  type Subtask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@tasksight/shared";
import { useAuth } from "@/lib/auth-context";
import { ApiError, fetchApi } from "@/lib/api";
import { useWorkspaceDetail } from "@/lib/use-workspace-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubtaskEditor } from "@/components/subtask-editor";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

function parseLabels(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(",")) {
    const label = part.trim();
    if (label) seen.add(label);
  }
  return Array.from(seen);
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function TaskForm({
  task,
  readOnly,
  onClose,
}: {
  task: Task | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const { workspaceId } = useAuth();
  const { members } = useWorkspaceDetail();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [labelsText, setLabelsText] = useState(task ? task.labels.join(", ") : "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function applyApiError(err: unknown, fallback: string) {
    if (err instanceof ApiError) {
      const next: Record<string, string> = {};
      for (const d of err.details ?? []) {
        const key = d.path.split(".")[0] ?? "";
        if (key && !next[key]) next[key] = d.message;
      }
      setFieldErrors(next);
      setFormError(Object.keys(next).length > 0 ? null : err.message);
    } else {
      setFormError(fallback);
    }
  }

  const saveMutation = useMutation({
    mutationFn: (payload: unknown) =>
      fetchApi<unknown>(
        task ? `/workspaces/${workspaceId}/tasks/${task.id}` : `/workspaces/${workspaceId}/tasks`,
        { method: task ? "PATCH" : "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      onClose();
    },
    onError: (err) => applyApiError(err, "Could not save the task"),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchApi<unknown>(`/workspaces/${workspaceId}/tasks/${task?.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      onClose();
    },
    onError: (err) => applyApiError(err, "Could not delete the task"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;

    const payload = {
      title,
      description,
      status,
      priority,
      dueDate: dueDate ? `${dueDate}T12:00:00.000Z` : null,
      labels: parseLabels(labelsText),
      assigneeId: assigneeId || null,
      subtasks,
    };

    const parsed = task ? updateTaskSchema.safeParse(payload) : createTaskSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    saveMutation.mutate(payload);
  }

  const heading = readOnly ? "Task details" : task ? "Edit task" : "Create task";
  const intro = readOnly
    ? "You have view-only access, so nothing here can be changed."
    : task
      ? "Change any field and save."
      : "Add a new task to your board.";

  const assigneeKnown = !assigneeId || members.some((m) => m.userId === assigneeId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
        <DialogDescription>{intro}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          value={title}
          readOnly={readOnly}
          placeholder="e.g. Fix login bug"
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? "task-title-error" : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        <FieldError id="task-title-error" message={fieldErrors.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          value={description}
          readOnly={readOnly}
          placeholder="Add more details..."
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? "task-description-error" : undefined}
          onChange={(e) => setDescription(e.target.value)}
        />
        <FieldError id="task-description-error" message={fieldErrors.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-status">Status</Label>
          <select
            id="task-status"
            value={status}
            disabled={readOnly}
            className={selectClass}
            onChange={(e) => {
              const r = taskStatusSchema.safeParse(e.target.value);
              if (r.success) setStatus(r.data);
            }}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <FieldError id="task-status-error" message={fieldErrors.status} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-priority">Priority</Label>
          <select
            id="task-priority"
            value={priority}
            disabled={readOnly}
            className={selectClass}
            onChange={(e) => {
              const r = taskPrioritySchema.safeParse(e.target.value);
              if (r.success) setPriority(r.data);
            }}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <FieldError id="task-priority-error" message={fieldErrors.priority} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            disabled={readOnly}
            aria-invalid={Boolean(fieldErrors.dueDate)}
            aria-describedby={fieldErrors.dueDate ? "task-due-error" : undefined}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <FieldError id="task-due-error" message={fieldErrors.dueDate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-assignee">Assignee</Label>
          <select
            id="task-assignee"
            value={assigneeId}
            disabled={readOnly}
            className={selectClass}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {!assigneeKnown && <option value={assigneeId}>Former member</option>}
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
          <FieldError id="task-assignee-error" message={fieldErrors.assigneeId} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-labels">Labels</Label>
        <Input
          id="task-labels"
          value={labelsText}
          readOnly={readOnly}
          placeholder="bug, urgent"
          aria-invalid={Boolean(fieldErrors.labels)}
          aria-describedby={fieldErrors.labels ? "task-labels-error" : "task-labels-help"}
          onChange={(e) => setLabelsText(e.target.value)}
        />
        <p id="task-labels-help" className="text-xs text-muted-foreground">
          Separate with commas (up to 20 labels).
        </p>
        <FieldError id="task-labels-error" message={fieldErrors.labels} />
      </div>

      <SubtaskEditor
        value={subtasks}
        onChange={setSubtasks}
        readOnly={readOnly}
        error={fieldErrors.subtasks}
      />

      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div>
          {task && !readOnly && !confirmDelete && (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          {task && !readOnly && confirmDelete && (
            <span className="flex items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm delete"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : task ? "Save changes" : "Create task"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  readOnly: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <TaskForm
          key={task?.id ?? "new"}
          task={task}
          readOnly={readOnly}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
