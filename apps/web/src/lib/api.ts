import { AuthResponse } from "@tasksight/shared";

let inMemoryToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
}

export function getAccessToken() {
  return inMemoryToken;
}

export class ApiError extends Error {
  code: string;
  details?: { path: string; message: string }[];

  constructor(code: string, message: string, details?: { path: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return {} as T;
  
  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    const err = data.error || {};
    throw new ApiError(
      err.code || "INTERNAL",
      err.message || "An unexpected error occurred",
      err.details
    );
  }
  return data as T;
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  
  if (inMemoryToken) {
    headers.set("Authorization", `Bearer ${inMemoryToken}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // If 401 and this isn't the login/refresh route itself, try to refresh
  if (
    res.status === 401 &&
    !endpoint.startsWith("/auth/login") &&
    !endpoint.startsWith("/auth/register") &&
    !endpoint.startsWith("/auth/refresh")
  ) {
    const newToken = await handleRefresh();
    
    if (newToken) {
      // Replay the original request with the new token
      headers.set("Authorization", `Bearer ${newToken}`);
      const retryRes = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
        credentials: "include",
      });
      return handleResponse<T>(retryRes);
    }
  }

  return handleResponse<T>(res);
}

// SINGLE-FLIGHT REFRESH: If multiple requests get a 401 at the same time,
// they all wait on this exact same promise instead of triggering multiple refreshes.
async function handleRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        inMemoryToken = null;
        // If refresh fails, clear queue and redirect logic will kick in on the UI side
        return null;
      }

      const data = (await res.json()) as AuthResponse;
      inMemoryToken = data.accessToken;
      return inMemoryToken;
    } catch {
      inMemoryToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}