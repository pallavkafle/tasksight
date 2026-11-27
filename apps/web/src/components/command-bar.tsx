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

type ParsedTask = { title: string; priority: "low" | "medium" | "high"; dueDate: string | null };

export function CommandBar() {
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmChip, setConfirmChip] = useState<ParsedTask | null>(null);
  const [fallbackTask, setFallbackTask] = useState<Task | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd + K keyboard shortcut
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
      // 1. Call the real AI endpoint
      const parsed = await fetchApi<ParsedTask>("/ai/parse-task", {
        method: "POST",
        body: JSON.stringify({ text: value }),
      });
      setConfirmChip(parsed);
    } catch {
      // 2. Fallback: If AI fails (404, 429, parse error), open manual dialog with prefilled title
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
          title: confirmChip.title,
          priority: confirmChip.priority,
          dueDate: confirmChip.dueDate ? `${confirmChip.dueDate}T12:00:00.000Z` : null,
          status: "todo",
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      setConfirmChip(null);
      setValue("");
    } catch {
      console.error("Failed to save");
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
                <p className="text-sm font-medium">{confirmChip.title}</p>
                <div className="flex gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase text-amber-500 border-amber-500/30"
                  >
                    {confirmChip.priority}
                  </Badge>
                  {confirmChip.dueDate && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {confirmChip.dueDate}
                    </Badge>
                  )}
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
