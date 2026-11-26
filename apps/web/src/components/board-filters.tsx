"use client";

import { useEffect, useState } from "react";
import { TASK_PRIORITIES, taskPrioritySchema, type WorkspaceMember } from "@tasksight/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPTY_FILTERS, type TaskFilters } from "@/lib/tasks-api";

const selectClass =
  "h-8 rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface BoardFiltersProps {
  value: TaskFilters;
  onChange: (next: TaskFilters) => void;
  members: WorkspaceMember[];
}

export function BoardFilters({ value, onChange, members }: BoardFiltersProps) {
  const [labelText, setLabelText] = useState(value.label);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = labelText.trim();
      if (next !== value.label) onChange({ ...value, label: next });
    }, 300);
    return () => clearTimeout(timer);
  }, [labelText, value, onChange]);

  const active = Boolean(value.priority || value.assigneeId || value.label);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter by priority"
        className={selectClass}
        value={value.priority}
        onChange={(e) => {
          const r = taskPrioritySchema.safeParse(e.target.value);
          onChange({ ...value, priority: r.success ? r.data : "" });
        }}
      >
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by assignee"
        className={selectClass}
        value={value.assigneeId}
        onChange={(e) => onChange({ ...value, assigneeId: e.target.value })}
      >
        <option value="">Anyone</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>

      <Input
        aria-label="Filter by label"
        placeholder="Label"
        className="w-36"
        value={labelText}
        onChange={(e) => setLabelText(e.target.value)}
      />

      {active && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setLabelText("");
            onChange(EMPTY_FILTERS);
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
