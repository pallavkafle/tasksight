"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, AuthResponse, MeResponse } from "@tasksight/shared";
import { fetchApi, setAccessToken, ApiError } from "./api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app load, check if the user has a valid refresh cookie
  useEffect(() => {
    async function checkSession() {
      try {
        // fetchApi will automatically handle the 401 -> refresh -> retry flow
        const data = await fetchApi<MeResponse>("/auth/me");
        setUser(data.user);
      } catch {
        // If refresh fails, user is not logged in. That's fine.
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
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await fetchApi<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetchApi("/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors on logout
    } finally {
      setAccessToken(null);
      setUser(null);
      // Note: We will add React Query cache clearing here later
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
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