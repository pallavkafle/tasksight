"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Bot, AlertCircle } from "lucide-react";

export interface AgentAction {
  id: string;
  tool: string;
  description: string;
  taskTitle: string;
  before: string;
  after: string;
}

interface DiffViewProps {
  actions: AgentAction[];
  onApprove: () => void;
  onReject: () => void;
}

export function DiffView({ actions, onApprove, onReject }: DiffViewProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  function handleAction(action: "approve" | "reject") {
    setIsProcessing(true);
    setTimeout(() => {
      if (action === "approve") onApprove();
      else onReject();
      setIsProcessing(false);
    }, 800); // Mock network delay
  }

  return (
    <Card className="max-w-2xl mx-auto border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Bot className="h-5 w-5 text-primary" />
          Sathi has proposed {actions.length} changes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Review these changes carefully. Nothing will be saved until you approve.</p>
        </div>

        {actions.map((action) => (
          <div key={action.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-sm">{action.taskTitle}</span>
              <Badge variant="outline" className="text-xs capitalize">
                {action.tool.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{action.description}</p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-md bg-destructive/10 p-2 line-through text-destructive/70">
                {action.before}
              </div>
              <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400 font-medium">
                {action.after}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => handleAction("reject")} disabled={isProcessing}>
          <X className="mr-2 h-4 w-4" /> Reject all
        </Button>
        <Button onClick={() => handleAction("approve")} disabled={isProcessing}>
          <Check className="mr-2 h-4 w-4" /> {isProcessing ? "Applying..." : "Approve all"}
        </Button>
      </CardFooter>
    </Card>
  );
}
