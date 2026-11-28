"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, ArrowRight, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { TaskDialog } from "@/components/task-dialog";
import { Task } from "@tasksight/shared";

// Frozen 3.3 Contract
type ParsedTaskResponse = {
  task: {
    title: string;
    priority: "low" | "medium" | "high";
    dueDate: string | null;
    labels: string[];
  };
  fromSample: boolean;
};

export function CommandBar() {
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmChip, setConfirmChip] = useState<ParsedTaskResponse | null>(null);
  const [fallbackTask, setFallbackTask] = useState<Task | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || !workspaceId) return;

    setIsParsing(true);
    try {
      const parsed = await fetchApi<ParsedTaskResponse>("/ai/parse-task", {
        method: "POST",
        body: JSON.stringify({
          text: value,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          workspaceId: workspaceId,
        }),
      });
      setConfirmChip(parsed);
    } catch {
      const fakeTask = {
        title: value,
        description: "",
        status: "todo",
        priority: "medium",
        dueDate: null,
        labels: [],
        subtasks: [],
        assigneeId: null,
        id: "",
      } as unknown as Task;
      setFallbackTask(fakeTask);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSave() {
    if (!confirmChip || !workspaceId) return;
    setIsSaving(true);
    try {
      await fetchApi(`/workspaces/${workspaceId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: confirmChip.task.title,
          priority: confirmChip.task.priority,
          dueDate: confirmChip.task.dueDate, // Passed as-is (already ISO)
          labels: confirmChip.task.labels,
          status: "todo",
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      setConfirmChip(null);
      setValue("");
    } catch (err) {
      console.error("Failed to save task", err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <TaskDialog
        open={!!fallbackTask}
        onOpenChange={(open) => !open && setFallbackTask(null)}
        task={fallbackTask}
        readOnly={false}
      />

      <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4 flex flex-col gap-2">
        {confirmChip && (
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-background/90 p-3 shadow-lg backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{confirmChip.task.title}</p>
                  {confirmChip.fromSample && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 h-4 uppercase text-muted-foreground"
                    >
                      Sample
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase text-amber-500 border-amber-500/30"
                  >
                    {confirmChip.task.priority}
                  </Badge>
                  {confirmChip.task.dueDate && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {confirmChip.task.dueDate.split("T")[0]}
                    </Badge>
                  )}
                  {confirmChip.task.labels.map((l) => (
                    <Badge
                      key={l}
                      variant="outline"
                      className="text-[10px] border-primary/30 text-primary"
                    >
                      {l}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmChip(null)}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="relative flex items-center gap-2 rounded-2xl border border-primary/30 bg-background/80 p-2 shadow-[0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-xl transition-all hover:border-primary/50"
        >
          {isParsing ? (
            <Loader2 className="ml-2 h-5 w-5 text-primary animate-spin" />
          ) : (
            <Sparkles className="ml-2 h-5 w-5 text-primary" />
          )}
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask Insight or type a task (Ctrl+K)..."
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-base"
            disabled={isParsing}
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!value.trim() || isParsing}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
