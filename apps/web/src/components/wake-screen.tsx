"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface WakeScreenProps {
  failed?: boolean;
  onRetry: () => void;
}

export function WakeScreen({ failed = false, onRetry }: WakeScreenProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (failed) return;
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [failed]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center"
    >
      {!failed && <Loader2 className="mb-6 h-10 w-10 text-primary motion-safe:animate-spin" />}
      <h2 className="text-2xl font-semibold tracking-tight">
        {failed ? "The server did not respond" : `Waking up the server${dots}`}
      </h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        {failed
          ? "It may still be starting. Wait a moment and try again."
          : "The free-tier backend sleeps when idle and takes up to a minute to wake up. Thanks for your patience."}
      </p>
      {failed && (
        <button
          onClick={onRetry}
          className="mt-8 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      )}
    </div>
  );
}
