"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function WakeScreen({ onWake }: { onWake: () => void }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <Loader2 className="mb-6 h-10 w-10 animate-spin text-primary" />
      <h2 className="text-2xl font-semibold tracking-tight">Waking up the server{dots}</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Our free-tier backend takes about 50 seconds to wake up from sleep. Thanks for your patience
        — we are getting everything ready.
      </p>
      <button
        onClick={onWake}
        className="mt-8 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Retry connection
      </button>
    </div>
  );
}
