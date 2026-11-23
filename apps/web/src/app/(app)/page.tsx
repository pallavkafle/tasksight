"use client";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-text">Welcome, {user?.name}</h1>
      <p className="text-lg text-muted">You are officially logged in to TaskSight.</p>

      <Button onClick={logout} variant="outline" className="mt-4">
        Log out
      </Button>
    </div>
  );
}
