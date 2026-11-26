"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { SUBTASK_MAX, type Subtask } from "@tasksight/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SubtaskEditorProps {
  value: Subtask[];
  onChange: (next: Subtask[]) => void;
  readOnly?: boolean;
  error?: string;
}

export function SubtaskEditor({ value, onChange, readOnly = false, error }: SubtaskEditorProps) {
  const [draft, setDraft] = useState("");

  const done = value.filter((s) => s.done).length;
  const percent = value.length === 0 ? 0 : Math.round((done / value.length) * 100);
  const atLimit = value.length >= SUBTASK_MAX;

  function add() {
    const title = draft.trim();
    if (!title || atLimit) return;
    onChange([...value, { title, done: false }]);
    setDraft("");
  }

  function update(index: number, patch: Partial<Subtask>) {
    onChange(value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Subtasks</span>
        <span className="text-muted-foreground">
          {done}/{value.length} done (max {SUBTASK_MAX})
        </span>
      </div>

      {value.length > 0 && (
        <div
          role="progressbar"
          aria-label="Subtask progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}

      {value.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground">No subtasks.</p>
      )}

      <ul className="space-y-2">
        {value.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-primary"
              checked={s.done}
              disabled={readOnly}
              onChange={(e) => update(i, { done: e.target.checked })}
              aria-label={`Done: subtask ${i + 1}`}
            />
            <Input
              value={s.title}
              readOnly={readOnly}
              aria-label={`Subtask ${i + 1} title`}
              className={s.done ? "text-muted-foreground line-through" : undefined}
              onChange={(e) => update(i, { title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove subtask ${i + 1}`}
                onClick={() => remove(i)}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={draft}
            disabled={atLimit}
            placeholder={atLimit ? `Limit of ${SUBTASK_MAX} reached` : "Add a subtask"}
            aria-label="New subtask"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={add} disabled={atLimit || !draft.trim()}>
            <Plus /> Add
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
