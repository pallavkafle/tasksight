"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CommandBar() {
  const [value, setValue] = useState("");

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          console.log("AI parse:", value);
        }}
        className="relative flex items-center gap-2 rounded-2xl border border-primary/30 bg-background/80 p-2 shadow-[0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-xl transition-all hover:border-primary/50"
      >
        <Sparkles className="ml-2 h-5 w-5 text-primary" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask Sathi or type a task (e.g. 'Submit report Friday high priority')..."
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-base"
        />
        <Button
          type="submit"
          size="icon"
          className="h-8 w-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!value.trim()}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
