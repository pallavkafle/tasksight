import type { AuthResponse } from "@tasksight/shared";

let inMemoryToken: string | null = null;
let refreshPromise: Promise<RefreshOutcome> | null = null;
let authFailureHandler: (() => void) | null = null;

// "ok": a new access token. "rejected": the server says the session is over (401 or 403).
// "unreachable": network error, 429 or 5xx. That does not prove the session is over.
type RefreshOutcome =
  { status: "ok"; token: string } | { status: "rejected" } | { status: "unreachable" };

const UNAVAILABLE_MESSAGE = "The server is not available right now. Please try again.";

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
}

export function getAccessToken() {
  return inMemoryToken;
}

// The auth provider registers this. A dead session then clears the app state and the
// protected layout sends the user to /login.
export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler;
}

function notifyAuthFailure() {
  inMemoryToken = null;
  authFailureHandler?.();
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

function isAuthEndpoint(endpoint: string): boolean {
  return (
    endpoint.startsWith("/auth/login") ||
    endpoint.startsWith("/auth/register") ||
    endpoint.startsWith("/auth/refresh")
  );
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return {} as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data.error || {};
    throw new ApiError(
      err.code || "INTERNAL",
      err.message || "An unexpected error occurred",
      err.details,
    );
  }
  return data as T;
}

async function send(
  endpoint: string,
  options: RequestInit,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    return await fetch(`/api${endpoint}`, { ...options, headers, credentials: "include" });
  } catch {
    throw new ApiError("NETWORK", UNAVAILABLE_MESSAGE);
  }
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const tokenUsed = inMemoryToken;
  const res = await send(endpoint, options, tokenUsed);

  if (res.status !== 401 || isAuthEndpoint(endpoint)) {
    return handleResponse<T>(res);
  }

  // The access token is missing or expired. Refresh once, then replay the request once.
  // If another request already refreshed in the meantime, just replay with the new token.
  const outcome: RefreshOutcome =
    inMemoryToken && inMemoryToken !== tokenUsed
      ? { status: "ok", token: inMemoryToken }
      : await handleRefresh();

  if (outcome.status === "unreachable") {
    throw new ApiError("NETWORK", UNAVAILABLE_MESSAGE);
  }
  if (outcome.status === "rejected") {
    notifyAuthFailure();
    return handleResponse<T>(res);
  }

  const retry = await send(endpoint, options, outcome.token);
  if (retry.status === 401) notifyAuthFailure();
  return handleResponse<T>(retry);
}

// SINGLE-FLIGHT REFRESH: requests that get a 401 at the same time share one refresh call.
function handleRefresh(): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<RefreshOutcome> => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) return { status: "rejected" };
      if (!res.ok) return { status: "unreachable" };

      const data = (await res.json()) as AuthResponse;
      inMemoryToken = data.accessToken;
      return { status: "ok", token: data.accessToken };
    } catch {
      return { status: "unreachable" };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function pingHealth(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Wakes a sleeping free-tier API. Calls onSlow once if the first check fails, keeps trying
// until maxMs, and returns whether the API is up.
export async function waitForApi(onSlow: () => void, maxMs = 90_000): Promise<boolean> {
  const started = Date.now();
  let reportedSlow = false;

  while (Date.now() - started < maxMs) {
    if (await pingHealth(5_000)) return true;
    if (!reportedSlow) {
      reportedSlow = true;
      onSlow();
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}
