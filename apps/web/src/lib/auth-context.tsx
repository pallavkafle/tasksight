"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, AuthResponse, MeResponse, Workspace, workspaceListSchema } from "@tasksight/shared";
import { ApiError, fetchApi, setAccessToken } from "./api";

const WORKSPACE_KEY = "tasksight.workspaceId";

function readStoredWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_KEY);
  } catch {
    return null;
  }
}

function storeWorkspaceId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(WORKSPACE_KEY, id);
    else window.localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    // Storage can be blocked. The choice is then simply not remembered.
  }
}

interface AuthContextType {
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectWorkspace: (id: string) => void;
  refreshWorkspaces: (preferId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshWorkspaces = useCallback(async (preferId?: string) => {
    const raw = await fetchApi<unknown>("/workspaces");
    const parsed = workspaceListSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError("INTERNAL", "Unexpected response from the server");
    }
    const list = parsed.data.workspaces;
    setWorkspaces(list);
    const wanted = preferId ?? readStoredWorkspaceId();
    const chosen = list.find((w) => w.id === wanted) ?? list[0] ?? null;
    setWorkspaceId(chosen ? chosen.id : null);
    storeWorkspaceId(chosen ? chosen.id : null);
  }, []);

  const selectWorkspace = useCallback((id: string) => {
    setWorkspaceId(id);
    storeWorkspaceId(id);
  }, []);

  useEffect(() => {
    async function checkSession() {
      try {
        const data = await fetchApi<MeResponse>("/auth/me");
        setUser(data.user);
        await refreshWorkspaces();
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    checkSession();
  }, [refreshWorkspaces]);

  const login = async (email: string, password: string) => {
    const data = await fetchApi<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    await refreshWorkspaces();
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await fetchApi<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    await refreshWorkspaces();
  };

  const logout = async () => {
    try {
      await fetchApi("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setAccessToken(null);
      setUser(null);
      setWorkspaces([]);
      setWorkspaceId(null);
      storeWorkspaceId(null);
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        workspaceId,
        isLoading,
        login,
        register,
        logout,
        selectWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
