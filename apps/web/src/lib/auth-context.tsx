"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, AuthResponse, MeResponse } from "@tasksight/shared";
import { fetchApi, setAccessToken } from "./api";

interface AuthContextType {
  user: User | null;
  workspaceId: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchWorkspace() {
    const res = await fetchApi<{ workspaces: { id: string }[] }>("/workspaces");
    const firstWorkspace = res.workspaces?.[0];
    if (firstWorkspace) {
      setWorkspaceId(firstWorkspace.id);
    }
  }

  useEffect(() => {
    async function checkSession() {
      try {
        const data = await fetchApi<MeResponse>("/auth/me");
        setUser(data.user);
        await fetchWorkspace();
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await fetchApi<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    await fetchWorkspace();
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await fetchApi<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    await fetchWorkspace();
  };

  const logout = async () => {
    try {
      await fetchApi("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setAccessToken(null);
      setUser(null);
      setWorkspaceId(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, workspaceId, isLoading, login, register, logout }}>
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
